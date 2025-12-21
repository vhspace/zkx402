/**
 * Proof policy is a portable, versioned object that drives verification routing.
 *
 * This is intentionally minimal for v1. We will extend it as we add more claims/providers.
 */

export const DEFAULT_PROOF_POLICY = Object.freeze({
  version: 1,
  scope: "zkx402",
  // canonical claims (preferred), but we also support legacy requestedProofs strings.
  claims: [{ type: "human" }],
  // provider selection (chain-only v1)
  allowedProviders: ["self"],
  preferenceOrder: ["self"],
  // "none" means: do not fallback to off-chain verification in v1
  fallback: "none",
});

export function normalizeProofPolicy(policy) {
  if (!policy || typeof policy !== "object") return { ...DEFAULT_PROOF_POLICY };
  return {
    version: Number(policy.version ?? DEFAULT_PROOF_POLICY.version),
    scope: String(policy.scope ?? DEFAULT_PROOF_POLICY.scope),
    claims: Array.isArray(policy.claims) ? policy.claims : DEFAULT_PROOF_POLICY.claims,
    allowedProviders: Array.isArray(policy.allowedProviders)
      ? policy.allowedProviders.map(String)
      : [...DEFAULT_PROOF_POLICY.allowedProviders],
    preferenceOrder: Array.isArray(policy.preferenceOrder)
      ? policy.preferenceOrder.map(String)
      : [...DEFAULT_PROOF_POLICY.preferenceOrder],
    fallback: String(policy.fallback ?? DEFAULT_PROOF_POLICY.fallback),
  };
}

/**
 * Deterministic-ish JSON stringify for hashing/logging.
 * (Enough for audit/debug; cryptographic canonicalization can be added later.)
 */
export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",")}}`;
}



