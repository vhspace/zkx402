import { ClaimType } from "./claims.js";

export const VerifyStatus = {
  VERIFIED: "verified",
  NOT_VERIFIED: "not_verified",
  NOT_IMPLEMENTED: "not_implemented",
  ERROR: "error",
};

/**
 * Chain-only router.
 *
 * - Only supports ClaimType.HUMAN via chain providers
 * - All other claims -> NOT_IMPLEMENTED
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

  if (claim.type !== ClaimType.HUMAN) {
    return {
      status: VerifyStatus.NOT_IMPLEMENTED,
      reason: `Claim not implemented in chain-only mode: ${claim.type}`,
    };
  }

  const preference = Array.isArray(policy?.preferenceOrder) ? policy.preferenceOrder : [];
  const allowed = Array.isArray(policy?.allowedProviders) ? policy.allowedProviders : [];

  const orderedProviders = preference.length
    ? preference
        .map((name) => providers.find((p) => p.name === name))
        .filter(Boolean)
    : providers;

  const finalProviders = allowed.length
    ? orderedProviders.filter((p) => allowed.includes(p.name))
    : orderedProviders;

  if (!finalProviders.length) {
    return { status: VerifyStatus.ERROR, reason: "No providers available after policy filtering" };
  }

  for (const provider of finalProviders) {
    if (typeof provider.verifyHuman !== "function") continue;
    const result = await provider.verifyHuman(context);
    if (!result?.ok) {
      // continue trying other providers in chain-only mode
      continue;
    }
    return result.verified
      ? { status: VerifyStatus.VERIFIED, provider: provider.name }
      : { status: VerifyStatus.NOT_VERIFIED, provider: provider.name };
  }

  return { status: VerifyStatus.ERROR, reason: "All providers failed or were not configured" };
}


