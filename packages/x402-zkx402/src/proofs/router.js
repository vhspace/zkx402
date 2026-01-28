import { ClaimType } from "./claims.js";

export const VerifyStatus = {
  VERIFIED: "verified",
  NOT_VERIFIED: "not_verified",
  NOT_IMPLEMENTED: "not_implemented",
  NOT_CONFIGURED: "not_configured",
  ERROR: "error",
};

function methodForClaim(claim) {
  switch (claim?.type) {
    case ClaimType.HUMAN:
      return "verifyHuman";
    case ClaimType.AGE_GTE:
      return "verifyAgeGte";
    case ClaimType.EXCLUDED_COUNTRIES_NOT_CONTAINS:
      return "verifyExcludedCountriesNotContains";
    case ClaimType.OFAC_CLEAR:
      return "verifyOfacClear";
    case ClaimType.ORIGIN_HTTP_GET:
      return "verifyOriginHttpGet";
    default:
      return null;
  }
}

/**
 * Proof router.
 *
 * - Supports a small set of canonical claim types (see `ClaimType`)
 * - Routes each claim to the first provider (in policy order) that can verify it
 */
export async function verifyClaimWithPolicy({
  claim,
  policy,
  providers,
  context,
}) {
  if (!claim || !claim.type) {
    return { status: VerifyStatus.ERROR, reason: "Missing claim" };
  }

  const methodName = methodForClaim(claim);
  if (!methodName) {
    return {
      status: VerifyStatus.NOT_IMPLEMENTED,
      reason: `Claim type not implemented: ${claim.type}`,
    };
  }

  const preference = Array.isArray(policy?.preferenceOrder)
    ? policy.preferenceOrder
    : [];
  const allowed = Array.isArray(policy?.allowedProviders)
    ? policy.allowedProviders
    : [];

  const orderedProviders = preference.length
    ? preference
        .map((name) => providers.find((p) => p.name === name))
        .filter(Boolean)
    : providers;

  const finalProviders = allowed.length
    ? orderedProviders.filter((p) => allowed.includes(p.name))
    : orderedProviders;

  if (!finalProviders.length) {
    return {
      status: VerifyStatus.ERROR,
      reason: "No providers available after policy filtering",
    };
  }

  const attempts = [];
  let sawNotVerified = false;
  let sawNonConfiguredFailure = false;
  let lastNotVerifiedProvider = null;

  for (const provider of finalProviders) {
    const fn = provider?.[methodName];
    if (typeof fn !== "function") continue;
    const result = await fn({ ...(context || {}), claim, policy });
    if (!result?.ok) {
      const status = String(result?.status ?? VerifyStatus.ERROR);
      attempts.push({
        provider: provider?.name ?? "unknown",
        ok: false,
        status,
        reason: result?.reason ?? "provider_error",
      });
      if (status !== VerifyStatus.NOT_CONFIGURED) {
        sawNonConfiguredFailure = true;
      }
      continue;
    }
    attempts.push({
      provider: provider?.name ?? "unknown",
      ok: true,
      status: result?.verified ? VerifyStatus.VERIFIED : VerifyStatus.NOT_VERIFIED,
    });
    if (result.verified) {
      return { status: VerifyStatus.VERIFIED, provider: provider.name, attempts };
    }
    // If this provider says "not verified", try the next provider in policy order.
    sawNotVerified = true;
    lastNotVerifiedProvider = provider?.name ?? null;
  }

  if (attempts.length === 0) {
    return {
      status: VerifyStatus.ERROR,
      reason: "No provider implemented the required verification method",
      attempts,
    };
  }

  // If every provider failed only due to missing configuration, surface that explicitly.
  const allNotConfigured = attempts.every(
    (a) => a?.ok === false && String(a?.status) === VerifyStatus.NOT_CONFIGURED
  );
  if (allNotConfigured) {
    return {
      status: VerifyStatus.NOT_CONFIGURED,
      reason: "All providers were not configured",
      attempts,
    };
  }

  // If at least one provider produced a definitive "not verified" result, surface NOT_VERIFIED.
  if (sawNotVerified && !sawNonConfiguredFailure) {
    return {
      status: VerifyStatus.NOT_VERIFIED,
      reason: "No provider verified the claim",
      provider: lastNotVerifiedProvider || undefined,
      attempts,
    };
  }

  // Mixed failures (API errors, invalid input, etc.) are treated as ERROR to avoid false negatives.
  return {
    status: VerifyStatus.ERROR,
    reason: "All providers failed",
    attempts,
  };
}
