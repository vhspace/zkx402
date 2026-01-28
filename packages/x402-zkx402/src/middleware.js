import { getAddress } from "viem";
import { exact } from "x402/schemes";
import {
  computeRoutePatterns,
  findMatchingPaymentRequirements,
  findMatchingRoute,
  processPriceToAtomicAmount,
  toJsonSafe,
} from "x402/shared";
import { getPaywallHtml } from "x402/paywall";
import {
  settleResponseHeader,
  SupportedEVMNetworks,
  SupportedSVMNetworks,
} from "x402/types";
import { useFacilitator } from "x402/verify";
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
import { computeVerificationCostUsdMicros, proofCostsHash } from "./proofs/costs.js";

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
  const a = typeof amountAtomic === "bigint" ? amountAtomic : safeBigInt(amountAtomic) ?? 0n;
  const d = Number.isFinite(Number(decimals)) ? Math.max(0, Math.trunc(Number(decimals))) : 0;
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
 *
 * @example
 * ```javascript
 * // Simple configuration - All endpoints are protected by $0.01 of USDC on base-sepolia
 * app.use(paymentMiddleware(
 *   '0x123...', // payTo address
 *   {
 *     price: '$0.01', // USDC amount in dollars
 *     network: 'base-sepolia'
 *   },
 *   // Optional facilitator configuration. Defaults to x402.org/facilitator for testnet usage
 * ));
 *
 * // Advanced configuration - Endpoint-specific payment requirements & custom facilitator
 * app.use(paymentMiddleware('0x123...', // payTo: The address to receive payments*    {
 *   {
 *     '/weather/*': {
 *       price: '$0.001', // USDC amount in dollars
 *       network: 'base',
 *       config: {
 *         description: 'Access to weather data'
 *       }
 *     }
 *   },
 *   {
 *     url: 'https://facilitator.example.com',
 *     createAuthHeaders: async () => ({
 *       verify: { "Authorization": "Bearer token" },
 *       settle: { "Authorization": "Bearer token" }
 *     })
 *   },
 *   {
 *     cdpClientKey: 'your-cdp-client-key',
 *     appLogo: '/images/logo.svg',
 *     appName: 'My App',
 *   }
 * ));
 * ```
 */
export function paymentMiddleware(payTo, routes, facilitator, paywall) {
  const useLocalFacilitator =
    facilitator &&
    typeof facilitator.verify === "function" &&
    typeof facilitator.settle === "function";
  const { verify, settle, supported } = useLocalFacilitator
    ? facilitator
    : useFacilitator(facilitator);
  const x402Version = 1;
  const auditEnabled = process.env.ZKX402_AUDIT_LOG === "true";
  const debugEnabled = process.env.ZKX402_DEBUG_LOG === "true";

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
      req.method.toUpperCase()
    );

    if (!matchingRoute) {
      return next();
    }

    const { price, network, config = {} } = matchingRoute.config;
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

    // Presence of X-PAYMENT gates whether we should do potentially costly checks.
    // NOTE: x402 itself supports a 402 negotiation step; when no payment is present we prefer
    // to avoid vendor API calls and return a price quote instead (see proof verification below).
    const payment = req.header("X-PAYMENT");

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
        extra && typeof extra === "object" && extra.accessControl && typeof extra.accessControl === "object"
          ? extra.accessControl
          : null;

      const requiredClaims =
        normalizeRequiredClaims(accessControl?.requiredClaims).length > 0
          ? normalizeRequiredClaims(accessControl?.requiredClaims)
          : normalizeRequiredClaims(extra?.requiredClaims);

      const mode = String(accessControl?.mode ?? "deny");
      const enabled = requiredClaims.length > 0 && mode !== "off" && mode !== "none";
      const statusCode = Number(accessControl?.statusCode ?? 403);

      return { enabled, mode, statusCode, requiredClaims };
    }

    const accessControl = resolveAccessControl(extraConfig);

    // Custom function to verify claims (discount tiers and hard-gating)
    /**
     * Verifies whether `requiredClaims` are verified under the route policy.
     *
     * @param {Array} presentedClaims - Array of canonical claim objects the user intends to use.
     * @param {Array} requiredClaims - Array of canonical claim objects required by this tier.
     * @param {Object} options
     * @param {boolean} options.requirePresentation - If true, claims must be declared in `presentedClaims` (discount intent).
     * @returns {Promise<Object>} Verification result with isValid flag and details
     */
    async function verifyClaimsForTier(presentedClaims, requiredClaims, options = {}) {
      const requirePresentation = options?.requirePresentation !== false;
      const presented = Array.isArray(presentedClaims) ? presentedClaims : [];
      const required = Array.isArray(requiredClaims) ? requiredClaims : [];
      const presentedKeys = claimKeySet(presented);

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

          // Client can optionally constrain which provider to use (soft checks).
          // Shape:
          // - { provider: "self" } => applies to all claims
          // - { providers: { "human": "self_api" } } => per-claim key
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

          // Quote mode (no payment): avoid vendor API calls, but still allow the client
          // to discover the *price* (including verification fees/commission).
          let routed = null;
          let durationMs = 0;
          const quoteOnly = !payment;
          const providerObj = selectedProvider
            ? proofProviders.find((p) => p.name === selectedProvider)
            : null;
          const isApiProvider = providerObj?.kind === "api";

          if (quoteOnly && isApiProvider) {
            routed = {
              status: VerifyStatus.VERIFIED,
              provider: selectedProvider,
              quoted: true,
              attempts: [
                {
                  provider: selectedProvider,
                  ok: true,
                  status: VerifyStatus.VERIFIED,
                  reason: "quoted",
                },
              ],
            };
          } else {
            const startedAt = Date.now();
            routed = await verifyClaimWithPolicy({
              claim,
              policy: routedPolicy,
              providers: proofProviders,
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
            { enabled: debugEnabled }
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
            { enabled: auditEnabled }
          );

          if (routed.status === VerifyStatus.NOT_IMPLEMENTED) {
            return {
              claimKey: ck,
              claim,
              verified: false,
              status: VerifyStatus.NOT_IMPLEMENTED,
              reason: "not_implemented",
              attempts: Array.isArray(routed.attempts) ? routed.attempts : undefined,
            };
          }
          if (routed.status === VerifyStatus.NOT_CONFIGURED) {
            return {
              claimKey: ck,
              claim,
              verified: false,
              status: VerifyStatus.NOT_CONFIGURED,
              reason: routed.reason || "not_configured",
              attempts: Array.isArray(routed.attempts) ? routed.attempts : undefined,
            };
          }
          if (routed.status === VerifyStatus.ERROR) {
            return {
              claimKey: ck,
              claim,
              verified: false,
              status: VerifyStatus.ERROR,
              reason: routed.reason || "verification_error",
              attempts: Array.isArray(routed.attempts) ? routed.attempts : undefined,
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
            attempts: Array.isArray(routed.attempts) ? routed.attempts : undefined,
          };
        })
      );

      // Check if all claims are verified
      const allVerified = verificationResults.every(
        (result) => result.verified
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

    // Compute base amount once. From here on, prefer atomic units (no floats).
    const baseAtomicAmountForAsset = processPriceToAtomicAmount(price, network);
    if ("error" in baseAtomicAmountForAsset) {
      throw new Error(baseAtomicAmountForAsset.error);
    }
    const baseMaxAmountRequired = baseAtomicAmountForAsset.maxAmountRequired;
    const baseAsset = baseAtomicAmountForAsset.asset;

    // Verify claims against variableAmountRequired and adjust amount if qualified.
    // SECURITY: discounts require `proofPolicy`.

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
      // Check each discount option
      for (const discountOption of variableAmountRequired) {
        const requiredClaims = Array.isArray(discountOption.requiredClaims)
          ? discountOption.requiredClaims
          : [];
        const discountedAmountAtomic = safeBigInt(discountOption.amountRequired);
        if (discountedAmountAtomic === null) {
          dbg("discount_amount_invalid", {
            correlationId,
            amountRequired: discountOption.amountRequired,
          });
          continue;
        }

        // Use custom verification function to verify claims (now async)
        const verificationResult = await verifyClaimsForTier(
          presentedClaims,
          requiredClaims
        );

        dbg("claim_verification_result", {
          requiredClaimKeys: verificationResult?.requiredClaimKeys,
          isValid: verificationResult?.isValid,
        });

        // Check if user has all required proofs for this discount
        if (verificationResult.isValid) {
          dbg("discount_applied", {
            requiredClaimKeys: verificationResult?.requiredClaimKeys,
          });

          // Compute verification fee (USD micros). In v1 we assume USDC (6 decimals),
          // so USD micros map 1:1 to USDC atomic units.
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

          const discountedTotalAtomic = discountedAmountAtomic + verificationFeeAtomic;
          finalMaxAmountRequired = discountedTotalAtomic.toString();

          verificationMetadata = {
            qualified: true,
            discountApplied: true,
            requiredClaims,
            discountedAmount: discountedAmountAtomic.toString(),
            discountedPrice: formatUsdLikePriceFromAtomic(
              discountedTotalAtomic,
              baseAsset?.decimals ?? 6
            ),
            verificationFeeAtomic: verificationFeeAtomic.toString(),
            presentedClaims,
            verificationResult: verificationResult,
          };
          break; // Use first matching discount
        }
      }

      if (!verificationMetadata) {
        dbg("discount_not_qualified", { correlationId });
        verificationMetadata = {
          qualified: false,
          discountApplied: false,
          presentedClaims,
          verificationResult: null,
        };
      }
      }
    }

    // Store verification metadata for use in route handler
    req.verificationMetadata = verificationMetadata;
    const maxAmountRequired = finalMaxAmountRequired;
    const asset = baseAsset;

    const resourceUrl =
      resource || `${req.protocol}://${req.headers.host}${req.path}`;

    let paymentRequirements = [];

    // TODO: create a shared middleware function to build payment requirements
    // evm networks
    if (SupportedEVMNetworks.includes(network)) {
      paymentRequirements.push({
        scheme: "exact",
        network,
        maxAmountRequired,
        resource: resourceUrl,
        description: description ?? "",
        mimeType: mimeType ?? "",
        payTo: getAddress(payTo),
        maxTimeoutSeconds: maxTimeoutSeconds ?? 60,
        asset: getAddress(assetOverride || asset.address),
        // TODO: Rename outputSchema to requestStructure
        outputSchema: {
          input: {
            type: "http",
            method: req.method.toUpperCase(),
            discoverable: discoverable ?? true,
            ...inputSchema,
          },
          output: outputSchema,
        },
        extra: {
          ...asset.eip712,
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
          // Proof cost metadata (never include secret API keys here).
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
            ? { proofVerificationFeeAtomic: verificationMetadata.verificationFeeAtomic }
            : {}),
        },
        // TODO: add zk requests here
      });
    }

    // svm networks
    else if (SupportedSVMNetworks.includes(network)) {
      // get the supported payments from the facilitator
      const paymentKinds = await supported();

      // find the payment kind that matches the network and scheme
      let feePayer;
      for (const kind of paymentKinds.kinds) {
        if (kind.network === network && kind.scheme === "exact") {
          feePayer = kind?.extra?.feePayer;
          break;
        }
      }

      // if no fee payer is found, throw an error
      if (!feePayer) {
        throw new Error(
          `The facilitator did not provide a fee payer for network: ${network}.`
        );
      }

      paymentRequirements.push({
        scheme: "exact",
        network,
        maxAmountRequired,
        resource: resourceUrl,
        description: description ?? "",
        mimeType: mimeType ?? "",
        payTo: payTo,
        maxTimeoutSeconds: maxTimeoutSeconds ?? 60,
        asset: asset.address,
        // TODO: Rename outputSchema to requestStructure
        outputSchema: {
          input: {
            type: "http",
            method: req.method.toUpperCase(),
            discoverable: discoverable ?? true,
            ...inputSchema,
          },
          output: outputSchema,
        },
        extra: {
          feePayer,
        },
      });
    } else {
      throw new Error(`Unsupported network: ${network}`);
    }

    const userAgent = req.header("User-Agent") || "";
    const acceptHeader = req.header("Accept") || "";
    const isWebBrowser =
      acceptHeader.includes("text/html") && userAgent.includes("Mozilla");

    if (!payment) {
      // TODO handle paywall html for solana
      if (isWebBrowser) {
        // Best-effort: use the computed atomic requirement for display, so the paywall
        // reflects any proof-gated discounts. This is only UI and may lose precision.
        const displayAmount = Number(
          formatAtomicToFixedDecimalString(
            safeBigInt(maxAmountRequired) ?? 0n,
            asset?.decimals ?? 6
          )
        );

        const html =
          customPaywallHtml ||
          getPaywallHtml({
            amount: displayAmount,
            paymentRequirements: toJsonSafe(paymentRequirements),
            currentUrl: req.originalUrl,
            testnet: network === "base-sepolia",
            cdpClientKey: paywall?.cdpClientKey,
            appName: paywall?.appName,
            appLogo: paywall?.appLogo,
            sessionTokenEndpoint: paywall?.sessionTokenEndpoint,
          });
        res.status(402).send(html);
        return;
      }
      res.status(402).json({
        x402Version,
        error: "X-PAYMENT header is required",
        accepts: toJsonSafe(paymentRequirements),
      });
      return;
    }

    let decodedPayment;
    try {
      decodedPayment = exact.evm.decodePayment(payment);
      decodedPayment.x402Version = x402Version;
    } catch (error) {
      console.error(error);
      res.status(402).json({
        x402Version,
        error: error || "Invalid or malformed payment header",
        accepts: toJsonSafe(paymentRequirements),
      });
      return;
    }

    const selectedPaymentRequirements = findMatchingPaymentRequirements(
      paymentRequirements,
      decodedPayment
    );
    if (!selectedPaymentRequirements) {
      res.status(402).json({
        x402Version,
        error: "Unable to find matching payment requirements",
        accepts: toJsonSafe(paymentRequirements),
      });
      return;
    }

    try {
      const response = await verify(
        decodedPayment,
        selectedPaymentRequirements
      );
      if (!response.isValid) {
        res.status(402).json({
          x402Version,
          error: response.invalidReason,
          accepts: toJsonSafe(paymentRequirements),
          payer: response.payer,
        });
        return;
      }
    } catch (error) {
      console.error(error);
      res.status(402).json({
        x402Version,
        error,
        accepts: toJsonSafe(paymentRequirements),
      });
      return;
    }

    // Hard proof-gated access control: after payment is verified, deny access unless required claims verify.
    if (accessControl?.enabled) {
      if (!extraConfig?.proofPolicy) {
        dbg("access_control_missing_proof_policy", { correlationId });
        res.status(500).json({
          x402Version,
          error: "proofPolicy_required_for_access_control",
        });
        return;
      }

      const accessVerification = await verifyClaimsForTier(
        presentedClaims,
        accessControl.requiredClaims,
        { requirePresentation: false }
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

    // Intercept and buffer all core methods that can commit response to client
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

    // Proceed to the next middleware or route handler
    await next();

    // If the response from the protected route is >= 400, do not settle payment
    if (res.statusCode >= 400) {
      settled = true; // stop intercepting calls
      res.writeHead = originalWriteHead;
      res.write = originalWrite;
      res.end = originalEnd;
      res.flushHeaders = originalFlushHeaders;
      // Replay all buffered calls in order
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
      const settleResponse = await settle(
        decodedPayment,
        selectedPaymentRequirements
      );
      const responseHeader = settleResponseHeader(settleResponse);
      res.setHeader("X-PAYMENT-RESPONSE", responseHeader);

      // if the settle fails, return an error
      if (!settleResponse.success) {
        bufferedCalls = [];
        res.status(402).json({
          x402Version,
          error: settleResponse.errorReason,
          accepts: toJsonSafe(paymentRequirements),
        });
        return;
      }
    } catch (error) {
      console.error(error);
      // If settlement fails and the response hasn't been sent yet, return an error
      if (!res.headersSent) {
        bufferedCalls = [];
        res.status(402).json({
          x402Version,
          error,
          accepts: toJsonSafe(paymentRequirements),
        });
        return;
      }
    } finally {
      settled = true;
      res.writeHead = originalWriteHead;
      res.write = originalWrite;
      res.end = originalEnd;
      res.flushHeaders = originalFlushHeaders;

      // Replay all buffered calls in order
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
