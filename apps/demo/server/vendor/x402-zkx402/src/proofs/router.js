import { ClaimType } from "./claims.js";

export const VerifyStatus = {
  VERIFIED: "verified",
  NOT_VERIFIED: "not_verified",
  NOT_IMPLEMENTED: "not_implemented",
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
      reason: `Claim not implemented in chain-only mode: ${claim.type}`,
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

  for (const provider of finalProviders) {
    const fn = provider?.[methodName];
    if (typeof fn !== "function") continue;
    const result = await fn({ ...(context || {}), claim, policy });
    if (!result?.ok) {
      // continue trying other providers in chain-only mode
      continue;
    }
    return result.verified
      ? { status: VerifyStatus.VERIFIED, provider: provider.name }
      : { status: VerifyStatus.NOT_VERIFIED, provider: provider.name };
  }

  return {
    status: VerifyStatus.ERROR,
    reason: "All providers failed or were not configured",
  };
}
