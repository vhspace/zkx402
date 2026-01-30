import { getAddress } from "viem";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import {
  computeRoutePatterns,
  findMatchingRoute,
  processPriceToAtomicAmount,
  toJsonSafe,
} from "x402/shared"; // TODO: these are still from v1, need to check if they moved
import { createPaywall } from "@x402/paywall";
import { evmPaywall } from "@x402/paywall/evm";
import { svmPaywall } from "@x402/paywall/svm";
import { claimKey } from "./proofs/claims.js";
import { normalizeProofPolicy } from "./proofs/policy.js";
import {
  getCorrelationId,
  logAuditEvent,
  logDebug,
  policyHash,
} from "./proofs/audit.js";
import { createSelfChainProvider } from "./proofs/providers/self_chain.js";
import { createSelfApiProvider } from "./proofs/providers/self_api.js";
import { createVlayerChainProvider } from "./proofs/providers/vlayer_chain.js";
import { createVlayerApiProvider } from "./proofs/providers/vlayer_api.js";
import { verifyClaimWithPolicy, VerifyStatus } from "./proofs/router.js";
import {
  computeVerificationCostUsdMicros,
  proofCostsHash,
} from "./proofs/costs.js";
import { normalizeNetwork, toLegacyNetwork } from "./x402/networks.js";

// Proof-gated pricing should be driven by `proofPolicy` + provider routing.

function safeBigInt(v) {
  try {
    if (typeof v === "bigint") return v;
    const s = String(v ?? "").trim();
    if (!s) return null;
    // Only allow base-10 integers for config inputs
    if (!/^\d+$/.test(s)) return null;
    return BigInt(s);
  } catch {
    return null;
  }
}

function formatAtomicToFixedDecimalString(amountAtomic, decimals) {
  const a =
    typeof amountAtomic === "bigint"
      ? amountAtomic
      : (safeBigInt(amountAtomic) ?? 0n);
  const d = Number.isFinite(Number(decimals))
    ? Math.max(0, Math.trunc(Number(decimals)))
    : 0;
  const base = 10n ** BigInt(d);
  const i = a / base;
  const f = a % base;
  const frac = d === 0 ? "" : `.${f.toString().padStart(d, "0")}`;
  return `${i.toString()}${frac}`;
}

function formatUsdLikePriceFromAtomic(amountAtomic, decimals) {
  // NOTE: This is a display helper only. The actual payment requirement uses atomic units.
  return `$${formatAtomicToFixedDecimalString(amountAtomic, decimals)}`;
}

/**
 * Creates a payment middleware factory for Express
 *
 * @param payTo - The address to receive payments
 * @param routes - Configuration for protected routes and their payment requirements
 * @param facilitator - Optional configuration for the payment facilitator service
 * @param paywall - Optional configuration for the default paywall
 * @returns An Express middleware handler
 */
export function paymentMiddleware(payTo, routes, facilitator, paywall) {
  const x402Version = 2;
  const auditEnabled = process.env.ZKX402_AUDIT_LOG === "true";
  const debugEnabled = process.env.ZKX402_DEBUG_LOG === "true";

  function buildResourceServer() {
    // Support legacy test facilitators (verify/settle) to keep unit tests offline.
    if (
      facilitator &&
      typeof facilitator.verify === "function" &&
      typeof facilitator.settle === "function"
    ) {
      return {
        createPaymentRequiredResponse(requirements, resource) {
          return {
            x402Version,
            error: "Payment Required",
            resource,
            accepts: requirements,
          };
        },
        async verifyPayment(paymentPayload, requirement) {
          const response = await facilitator.verify(
            paymentPayload,
            requirement,
          );
          if (response && typeof response === "object") return response;
          return { isValid: Boolean(response) };
        },
        async settlePayment(paymentPayload, requirement) {
          const response = await facilitator.settle(
            paymentPayload,
            requirement,
          );
          if (response && typeof response === "object") return response;
          return { success: Boolean(response) };
        },
      };
    }

    // Initialize v2 Resource Server
    const facilitatorUrl = facilitator?.url || "https://x402.org/facilitator";
    const facilitatorClient = new HTTPFacilitatorClient({
      url: facilitatorUrl,
    });
    return new x402ResourceServer(facilitatorClient)
      .register("eip155:8453", new ExactEvmScheme())
      .register("eip155:84532", new ExactEvmScheme())
      .register("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", new ExactSvmScheme())
      .register(
        "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
        new ExactSvmScheme(),
      );
  }

  const resourceServer = buildResourceServer();

  const paywallProvider =
    paywall && typeof paywall.generateHtml === "function"
      ? paywall
      : createPaywall()
          .withNetwork(evmPaywall)
          .withNetwork(svmPaywall)
          .withConfig(paywall && typeof paywall === "object" ? paywall : {})
          .build();

  const proofProviders = [
    createSelfChainProvider(),
    createSelfApiProvider(),
    createVlayerChainProvider(),
    createVlayerApiProvider(),
  ];
  const dbg = (message, data) =>
    logDebug(message, data, { enabled: debugEnabled });

  // Pre-compile route patterns to regex and extract verbs
  const routePatterns = computeRoutePatterns(routes);

  return async function paymentMiddleware(req, res, next) {
    const matchingRoute = findMatchingRoute(
      routePatterns,
      req.path,
      req.method.toUpperCase(),
    );

    if (!matchingRoute) {
      return next();
    }

    const {
      price,
      network: rawNetwork,
      accepts: acceptsConfig,
      config = {},
    } = matchingRoute.config;
    const primaryAccept = Array.isArray(acceptsConfig)
      ? acceptsConfig[0]
      : null;
    const network = normalizeNetwork(rawNetwork || primaryAccept?.network);
    const {
      description,
      mimeType,
      maxTimeoutSeconds,
      inputSchema,
      outputSchema,
      customPaywallHtml,
      resource,
      discoverable,
      extra: extraConfig,
      asset: assetOverride,
    } = config;

    const correlationId = getCorrelationId(req);

    // v2: read PAYMENT-SIGNATURE or legacy X-PAYMENT
    const payment = req.header("PAYMENT-SIGNATURE") || req.header("X-PAYMENT");

    // Read user proofs from header for verification and dynamic pricing
    let presentedClaims = [];
    const presentedClaimsHeader = req.headers["x-proof-claims"];
    if (presentedClaimsHeader) {
      try {
        const parsed = JSON.parse(String(presentedClaimsHeader));
        presentedClaims = Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        dbg("x_proof_claims_parse_failed", {
          correlationId,
          error: error?.message || String(error),
        });
      }
    }

    const walletAddress =
      req.headers["x-wallet-address"] ||
      req.query?.wallet ||
      req.query?.address ||
      null;

    let selfProof = null;
    const selfProofHeader =
      req.headers["x-self-proof"] ||
      req.headers["x-self-xyz-proof"] ||
      req.headers["x-selfxyz-proof"] ||
      null;
    if (selfProofHeader) {
      try {
        selfProof = JSON.parse(String(selfProofHeader));
      } catch (error) {
        dbg("x_self_proof_parse_failed", {
          correlationId,
          error: error?.message || String(error),
        });
      }
    }

    let vlayerProof = null;
    const vlayerProofHeader =
      req.headers["x-vlayer-proof"] ||
      req.headers["x-vlayer-presentation"] ||
      req.headers["x-vlayer-presentation-json"] ||
      null;
    if (vlayerProofHeader) {
      try {
        vlayerProof = JSON.parse(String(vlayerProofHeader));
      } catch (error) {
        // Allow non-JSON payloads (e.g., hex-encoded proof blobs) as raw strings.
        vlayerProof = String(vlayerProofHeader);
        dbg("x_vlayer_proof_parse_failed", {
          correlationId,
          error: error?.message || String(error),
        });
      }
    }

    let proofPlan = null;
    const proofPlanHeader = req.headers["x-zk-proof-plan"] || null;
    if (proofPlanHeader) {
      try {
        proofPlan = JSON.parse(String(proofPlanHeader));
      } catch (error) {
        dbg("x_zk_proof_plan_parse_failed", {
          correlationId,
          error: error?.message || String(error),
        });
      }
    }

    function claimKeySet(claims) {
      const s = new Set();
      for (const c of Array.isArray(claims) ? claims : []) {
        s.add(claimKey(c));
      }
      return s;
    }

    function normalizeRequiredClaims(v) {
      return Array.isArray(v) ? v : [];
    }

    function resolveAccessControl(extra) {
      const accessControl =
        extra &&
        typeof extra === "object" &&
        extra.accessControl &&
        typeof extra.accessControl === "object"
          ? extra.accessControl
          : null;

      const requiredClaims =
        normalizeRequiredClaims(accessControl?.requiredClaims).length > 0
          ? normalizeRequiredClaims(accessControl?.requiredClaims)
          : normalizeRequiredClaims(extra?.requiredClaims);

      const mode = String(accessControl?.mode ?? "deny");
      const enabled =
        requiredClaims.length > 0 && mode !== "off" && mode !== "none";
      const statusCode = Number(accessControl?.statusCode ?? 403);

      return { enabled, mode, statusCode, requiredClaims };
    }

    const accessControl = resolveAccessControl(extraConfig);

    // Custom function to verify claims (discount tiers and hard-gating)
    async function verifyClaimsForTier(
      presentedClaims,
      requiredClaims,
      options = {},
    ) {
      const requirePresentation = options?.requirePresentation !== false;
      const presented = Array.isArray(presentedClaims) ? presentedClaims : [];
      const required = Array.isArray(requiredClaims) ? requiredClaims : [];
      const presentedKeys = claimKeySet(presented);

      function providerSupportsClaim(provider, claim) {
        if (!provider || !claim) return false;
        if (!Array.isArray(provider.supportsClaims)) return true;
        return provider.supportsClaims.includes(claim.type);
      }

      function filterProvidersForClaim(providers, policy, claim) {
        const allowed = Array.isArray(policy?.allowedProviders)
          ? new Set(policy.allowedProviders)
          : null;
        return (providers || []).filter((p) => {
          if (allowed && !allowed.has(p.name)) return false;
          return providerSupportsClaim(p, claim);
        });
      }

      function filterPolicyForProviders(policy, providers) {
        const names = (providers || []).map((p) => p.name);
        return {
          ...policy,
          allowedProviders: names,
          preferenceOrder: (policy?.preferenceOrder || []).filter((n) =>
            names.includes(n),
          ),
        };
      }

      function pickPreferredProvider(policy, providers) {
        const names = (providers || []).map((p) => p.name);
        const preferred =
          (policy?.preferenceOrder || []).find((n) => names.includes(n)) ||
          null;
        return preferred || names[0] || null;
      }

      function buildQuotedResult(providerName) {
        return {
          status: VerifyStatus.VERIFIED,
          provider: providerName || undefined,
          quoted: true,
          attempts: providerName
            ? [
                {
                  provider: providerName,
                  ok: true,
                  status: VerifyStatus.VERIFIED,
                  reason: "quoted",
                },
              ]
            : [],
        };
      }

      const normalizedPolicy = normalizeProofPolicy(extraConfig?.proofPolicy);
      const pHash = policyHash(normalizedPolicy);
      const costs = extraConfig?.proofCosts || null;
      const cHash = proofCostsHash(costs);

      // Check each required claim
      const verificationResults = await Promise.all(
        required.map(async (claim) => {
          const ck = claimKey(claim);
          const presentedByClient = presentedKeys.has(ck);
          if (requirePresentation && !presentedByClient) {
            return {
              claimKey: ck,
              claim,
              verified: false,
              status: VerifyStatus.NOT_VERIFIED,
              reason: "not_presented",
              quoted: false,
              attempts: [],
            };
          }

          const planProvider =
            typeof proofPlan?.provider === "string" ? proofPlan.provider : null;
          const planProviders =
            proofPlan?.providers && typeof proofPlan.providers === "object"
              ? proofPlan.providers
              : null;
          const selectedProvider =
            (planProviders && typeof planProviders[ck] === "string"
              ? planProviders[ck]
              : null) || planProvider;

          const routedPolicy = selectedProvider
            ? {
                ...normalizedPolicy,
                allowedProviders: [selectedProvider],
                preferenceOrder: [selectedProvider],
              }
            : normalizedPolicy;

          let routed = null;
          let durationMs = 0;
          const quoteOnly = !payment;
          const eligibleProviders = filterProvidersForClaim(
            proofProviders,
            routedPolicy,
            claim,
          );
          const chainProviders = eligibleProviders.filter(
            (p) => p.kind !== "api",
          );
          const apiProviders = eligibleProviders.filter(
            (p) => p.kind === "api",
          );

          if (quoteOnly) {
            if (chainProviders.length > 0) {
              const startedAt = Date.now();
              routed = await verifyClaimWithPolicy({
                claim,
                policy: filterPolicyForProviders(routedPolicy, chainProviders),
                providers: chainProviders,
                context: {
                  walletAddress,
                  selfProof,
                  vlayerProof,
                  correlationId,
                },
              });
              durationMs = Date.now() - startedAt;

              if (
                (routed.status === VerifyStatus.NOT_CONFIGURED ||
                  routed.status === VerifyStatus.NOT_IMPLEMENTED) &&
                apiProviders.length > 0
              ) {
                routed = buildQuotedResult(
                  pickPreferredProvider(routedPolicy, apiProviders),
                );
              }
            } else if (apiProviders.length > 0) {
              routed = buildQuotedResult(
                pickPreferredProvider(routedPolicy, apiProviders),
              );
            } else {
              const startedAt = Date.now();
              routed = await verifyClaimWithPolicy({
                claim,
                policy: routedPolicy,
                providers: eligibleProviders,
                context: {
                  walletAddress,
                  selfProof,
                  vlayerProof,
                  correlationId,
                },
              });
              durationMs = Date.now() - startedAt;
            }
          } else {
            const startedAt = Date.now();
            routed = await verifyClaimWithPolicy({
              claim,
              policy: routedPolicy,
              providers: eligibleProviders,
              context: { walletAddress, selfProof, vlayerProof, correlationId },
            });
            durationMs = Date.now() - startedAt;
          }

          logDebug(
            "proof_check",
            {
              correlationId,
              claimKey: ck,
              claim,
              routed,
              durationMs,
              policyHash: pHash,
            },
            { enabled: debugEnabled },
          );

          logAuditEvent(
            {
              correlationId,
              scope: normalizedPolicy.scope,
              policyHash: pHash,
              proofCostsHash: cHash,
              claimKey: ck,
              claim,
              provider: routed.provider || null,
              status: routed.status,
              durationMs,
            },
            { enabled: auditEnabled },
          );

          if (routed.status === VerifyStatus.NOT_IMPLEMENTED) {
            return {
              claimKey: ck,
              claim,
              verified: false,
              status: VerifyStatus.NOT_IMPLEMENTED,
              reason: "not_implemented",
              attempts: Array.isArray(routed.attempts)
                ? routed.attempts
                : undefined,
            };
          }
          if (routed.status === VerifyStatus.NOT_CONFIGURED) {
            return {
              claimKey: ck,
              claim,
              verified: false,
              status: VerifyStatus.NOT_CONFIGURED,
              reason: routed.reason || "not_configured",
              attempts: Array.isArray(routed.attempts)
                ? routed.attempts
                : undefined,
            };
          }
          if (routed.status === VerifyStatus.ERROR) {
            return {
              claimKey: ck,
              claim,
              verified: false,
              status: VerifyStatus.ERROR,
              reason: routed.reason || "verification_error",
              attempts: Array.isArray(routed.attempts)
                ? routed.attempts
                : undefined,
            };
          }

          let verificationCost = null;
          if (costs && routed.provider) {
            verificationCost = computeVerificationCostUsdMicros({
              claims: [claim],
              provider: routed.provider,
              costs,
            });
          }

          return {
            claimKey: ck,
            claim,
            verified: routed.status === VerifyStatus.VERIFIED,
            status: routed.status,
            provider: routed.provider,
            verificationCost,
            quoted: Boolean(routed.quoted),
            attempts: Array.isArray(routed.attempts)
              ? routed.attempts
              : undefined,
          };
        }),
      );

      const allVerified = verificationResults.every(
        (result) => result.verified,
      );
      const missingClaims = verificationResults
        .filter((result) => !result.verified)
        .map((result) => result.claimKey);

      return {
        isValid: allVerified,
        hasAllProofs: allVerified,
        missingClaimKeys: missingClaims,
        presentedClaimKeys: Array.from(presentedKeys),
        requiredClaimKeys: required.map((c) => claimKey(c)),
        verifiedCount: required.length - missingClaims.length,
        totalRequired: required.length,
        verificationDetails: verificationResults,
      };
    }

    const acceptsList =
      Array.isArray(acceptsConfig) && acceptsConfig.length > 0
        ? acceptsConfig
        : null;
    const primaryAcceptConfig = acceptsList ? acceptsList[0] : null;

    let baseMaxAmountRequired = null;
    let baseAsset = null;

    if (
      price ||
      (!primaryAcceptConfig?.amount && !primaryAcceptConfig?.maxAmountRequired)
    ) {
      if (!price) {
        throw new Error("Missing price for route without accepts amount");
      }
      // v1 compat: processPriceToAtomicAmount still used for now
      const pricingNetwork = toLegacyNetwork(rawNetwork || network);
      const baseAtomicAmountForAsset = processPriceToAtomicAmount(
        price,
        pricingNetwork,
      );
      if ("error" in baseAtomicAmountForAsset) {
        throw new Error(baseAtomicAmountForAsset.error);
      }
      baseMaxAmountRequired = baseAtomicAmountForAsset.maxAmountRequired;
      baseAsset = baseAtomicAmountForAsset.asset;
    } else {
      baseMaxAmountRequired = String(
        primaryAcceptConfig.amount ?? primaryAcceptConfig.maxAmountRequired,
      );
      const acceptAsset = primaryAcceptConfig.asset || assetOverride || null;
      if (acceptAsset) {
        baseAsset = {
          address: acceptAsset,
          decimals: primaryAcceptConfig.extra?.decimals ?? 6,
          eip712: primaryAcceptConfig.extra?.eip712 ?? {},
        };
      }
    }

    if (!baseMaxAmountRequired) {
      throw new Error("Missing amount in accepts[] configuration");
    }

    if (primaryAcceptConfig?.asset && baseAsset) {
      baseAsset = {
        ...baseAsset,
        address: primaryAcceptConfig.asset,
        eip712: primaryAcceptConfig.extra?.eip712 ?? baseAsset.eip712,
      };
    }

    let finalMaxAmountRequired = baseMaxAmountRequired;
    let verificationMetadata = null;

    if (presentedClaims.length > 0 && extraConfig?.variableAmountRequired) {
      const variableAmountRequired = extraConfig.variableAmountRequired;

      if (!extraConfig?.proofPolicy) {
        verificationMetadata = {
          qualified: false,
          discountApplied: false,
          presentedClaims,
          verificationResult: {
            isValid: false,
            hasAllProofs: false,
            missingClaimKeys: [],
            presentedClaimKeys: Array.from(claimKeySet(presentedClaims)),
            requiredClaimKeys: [],
            verifiedCount: 0,
            totalRequired: 0,
            verificationDetails: [],
            reason: "proofPolicy_required",
          },
        };
      } else {
        for (const discountOption of variableAmountRequired) {
          const requiredClaims = Array.isArray(discountOption.requiredClaims)
            ? discountOption.requiredClaims
            : [];
          const discountedAmountAtomic = safeBigInt(
            discountOption.amountRequired,
          );
          if (discountedAmountAtomic === null) {
            dbg("discount_amount_invalid", {
              correlationId,
              amountRequired: discountOption.amountRequired,
            });
            continue;
          }

          const verificationResult = await verifyClaimsForTier(
            presentedClaims,
            requiredClaims,
          );

          if (verificationResult.isValid) {
            let verificationFeeAtomic = 0n;
            try {
              const details = verificationResult?.verificationDetails || [];
              for (const d of details) {
                const totalUsdMicros =
                  d?.verificationCost?.totalUsdMicros ?? null;
                if (totalUsdMicros != null) {
                  verificationFeeAtomic += BigInt(String(totalUsdMicros));
                }
              }
            } catch (_) {
              verificationFeeAtomic = 0n;
            }

            const discountedTotalAtomic =
              discountedAmountAtomic + verificationFeeAtomic;
            finalMaxAmountRequired = discountedTotalAtomic.toString();

            verificationMetadata = {
              qualified: true,
              discountApplied: true,
              requiredClaims,
              discountedAmount: discountedAmountAtomic.toString(),
              discountedPrice: formatUsdLikePriceFromAtomic(
                discountedTotalAtomic,
                baseAsset?.decimals ?? 6,
              ),
              verificationFeeAtomic: verificationFeeAtomic.toString(),
              presentedClaims,
              verificationResult: verificationResult,
            };
            break;
          }
        }

        if (!verificationMetadata) {
          verificationMetadata = {
            qualified: false,
            discountApplied: false,
            presentedClaims,
            verificationResult: null,
          };
        }
      }
    }

    req.verificationMetadata = verificationMetadata;
    const maxAmountRequired = finalMaxAmountRequired;
    const asset = baseAsset;

    // v2: Respect proxy headers for resource URL
    const proto = req.header("X-Forwarded-Proto") || req.protocol;
    const host = req.header("X-Forwarded-Host") || req.headers.host;
    const resourceUrl = resource || `${proto}://${host}${req.originalUrl}`;
    const extraBase = {
      ...extraConfig,
      ...(accessControl?.enabled
        ? {
            accessControl: {
              mode: accessControl.mode,
              statusCode: accessControl.statusCode,
              requiredClaims: accessControl.requiredClaims,
            },
          }
        : {}),
      ...(extraConfig?.proofCosts
        ? {
            proofCostsHash: proofCostsHash(extraConfig.proofCosts),
            proofCostsCurrency: extraConfig.proofCosts.currency || "usd_micros",
            proofCostsDefaultCommissionBps:
              extraConfig.proofCosts.defaultCommissionBps ?? 0,
          }
        : {}),
      ...(proofPlan ? { proofPlan } : {}),
      ...(verificationMetadata?.verificationFeeAtomic
        ? {
            proofVerificationFeeAtomic:
              verificationMetadata.verificationFeeAtomic,
          }
        : {}),
    };

    function buildPaymentRequirement(accept = {}) {
      const requirementAmount = String(
        accept.amount ?? accept.maxAmountRequired ?? maxAmountRequired,
      );
      const requirementAsset =
        accept.asset || assetOverride || baseAsset?.address;
      if (!requirementAsset) {
        throw new Error("Missing asset for payment requirement");
      }
      const requirementExtra = {
        ...(accept.extra?.eip712 ?? baseAsset?.eip712 ?? {}),
        ...(accept.extra || {}),
        ...extraBase,
      };
      return {
        scheme: accept.scheme || "exact",
        network: normalizeNetwork(accept.network || network),
        amount: requirementAmount,
        payTo: getAddress(accept.payTo || payTo),
        asset: getAddress(requirementAsset),
        maxTimeoutSeconds: accept.maxTimeoutSeconds ?? maxTimeoutSeconds ?? 60,
        extra: requirementExtra,
      };
    }

    // When variable-amount discount applied, primary requirement must show discounted amount
    const primaryAcceptOverride =
      verificationMetadata?.discountApplied &&
      acceptsList?.length > 0
        ? { ...acceptsList[0], amount: maxAmountRequired }
        : null;
    const paymentRequirements = acceptsList
      ? acceptsList.map((accept, i) =>
          buildPaymentRequirement(
            i === 0 && primaryAcceptOverride ? primaryAcceptOverride : accept,
          ),
        )
      : [buildPaymentRequirement()];

    function selectPaymentRequirement(requirements, paymentPayload) {
      if (!Array.isArray(requirements) || requirements.length === 0)
        return null;
      const paymentNetwork = normalizeNetwork(paymentPayload?.network);
      if (paymentNetwork) {
        const match = requirements.find((r) => r.network === paymentNetwork);
        if (match) return match;
      }
      return requirements[0];
    }

    let paymentRequirement = paymentRequirements[0];

    const userAgent = req.header("User-Agent") || "";
    const acceptHeader = req.header("Accept") || "";
    const isWebBrowser =
      acceptHeader.includes("text/html") && userAgent.includes("Mozilla");

    if (!payment) {
      // v2: createPaymentRequiredResponse + PAYMENT-REQUIRED header
      const paymentRequired = resourceServer.createPaymentRequiredResponse(
        paymentRequirements,
        {
          url: resourceUrl,
          description: description ?? "",
          mimeType: mimeType ?? "",
        },
      );

      if (isWebBrowser) {
        const html =
          customPaywallHtml ||
          paywallProvider.generateHtml(paymentRequired, {
            currentUrl: resourceUrl,
            testnet: network.includes("sepolia") || network.includes("devnet"),
            appName: paywall?.appName,
            appLogo: paywall?.appLogo,
          });
        res.status(402).send(html);
        return;
      }

      const requirementsHeader = Buffer.from(
        JSON.stringify(paymentRequired),
      ).toString("base64");

      res.status(402);
      res.set("PAYMENT-REQUIRED", requirementsHeader);
      res.json({
        x402Version,
        error: "Payment Required",
        message: "This endpoint requires payment",
        accepts: paymentRequirements, // v1 compat
      });
      return;
    }

    let decodedPayment;
    try {
      // v2: base64 decode payment signature
      decodedPayment = JSON.parse(
        Buffer.from(payment, "base64").toString("utf-8"),
      );
      decodedPayment.x402Version = x402Version;
      paymentRequirement =
        selectPaymentRequirement(paymentRequirements, decodedPayment) ||
        paymentRequirement;
    } catch (error) {
      res.status(402).json({
        x402Version,
        error: "Invalid or malformed payment header",
        accepts: paymentRequirements,
      });
      return;
    }

    try {
      // v2: resourceServer.verifyPayment
      const response = await resourceServer.verifyPayment(
        decodedPayment,
        paymentRequirement,
      );
      if (!response.isValid) {
        res.status(402).json({
          x402Version,
          error: response.invalidReason,
          accepts: paymentRequirements,
          payer: response.payer,
        });
        return;
      }
    } catch (error) {
      res.status(402).json({
        x402Version,
        error: error?.message || String(error),
        accepts: paymentRequirements,
      });
      return;
    }

    // Access control check
    if (accessControl?.enabled) {
      const accessVerification = await verifyClaimsForTier(
        presentedClaims,
        accessControl.requiredClaims,
        { requirePresentation: false },
      );

      req.accessControlMetadata = {
        mode: accessControl.mode,
        requiredClaims: accessControl.requiredClaims,
        verificationResult: accessVerification,
      };

      if (!accessVerification?.isValid) {
        res.status(accessControl.statusCode).json({
          x402Version,
          error: "proofs_required",
          message: "Access denied: required proofs missing or unverified",
          requiredClaims: accessControl.requiredClaims,
          verificationResult: accessVerification,
        });
        return;
      }
    }

    // Intercept and buffer response
    const originalWriteHead = res.writeHead.bind(res);
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    const originalFlushHeaders = res.flushHeaders.bind(res);

    let bufferedCalls = [];
    let settled = false;

    res.writeHead = function (...args) {
      if (!settled) {
        bufferedCalls.push(["writeHead", args]);
        return res;
      }
      return originalWriteHead(...args);
    };

    res.write = function (...args) {
      if (!settled) {
        bufferedCalls.push(["write", args]);
        return true;
      }
      return originalWrite(...args);
    };

    res.end = function (...args) {
      if (!settled) {
        bufferedCalls.push(["end", args]);
        return res;
      }
      return originalEnd(...args);
    };

    res.flushHeaders = function () {
      if (!settled) {
        bufferedCalls.push(["flushHeaders", []]);
        return;
      }
      return originalFlushHeaders();
    };

    await next();

    if (res.statusCode >= 400) {
      settled = true;
      res.writeHead = originalWriteHead;
      res.write = originalWrite;
      res.end = originalEnd;
      res.flushHeaders = originalFlushHeaders;
      for (const [method, args] of bufferedCalls) {
        if (method === "writeHead") originalWriteHead(...args);
        else if (method === "write") originalWrite(...args);
        else if (method === "end") originalEnd(...args);
        else if (method === "flushHeaders") originalFlushHeaders();
      }
      bufferedCalls = [];
      return;
    }

    try {
      // v2: resourceServer.settlePayment
      const settleResponse = await resourceServer.settlePayment(
        decodedPayment,
        paymentRequirement,
      );

      const responseHeader = Buffer.from(
        JSON.stringify(settleResponse),
      ).toString("base64");
      res.setHeader("PAYMENT-RESPONSE", responseHeader);
      res.setHeader("X-PAYMENT-RESPONSE", responseHeader); // v1 compat

      if (!settleResponse.success) {
        bufferedCalls = [];
        res.status(402).json({
          x402Version,
          error: settleResponse.errorReason,
          accepts: paymentRequirements,
        });
        return;
      }
    } catch (error) {
      if (!res.headersSent) {
        bufferedCalls = [];
        res.status(402).json({
          x402Version,
          error: error?.message || String(error),
          accepts: paymentRequirements,
        });
        return;
      }
    } finally {
      settled = true;
      res.writeHead = originalWriteHead;
      res.write = originalWrite;
      res.end = originalEnd;
      res.flushHeaders = originalFlushHeaders;

      for (const [method, args] of bufferedCalls) {
        if (method === "writeHead") originalWriteHead(...args);
        else if (method === "write") originalWrite(...args);
        else if (method === "end") originalEnd(...args);
        else if (method === "flushHeaders") originalFlushHeaders();
      }
      bufferedCalls = [];
    }
  };
}
