export const ClaimType = {
  HUMAN: "human",
  AGE_GTE: "age_gte",
  EXCLUDED_COUNTRIES_NOT_CONTAINS: "excluded_countries_not_contains",
  OFAC_CLEAR: "ofac_clear",
  // Vendor-neutral claim: subject can prove access to an HTTP GET resource.
  // Verified either via a vendor API verifier (e.g., vouch) or by checking an on-chain
  // attestation/registry that a valid proof was recorded.
  ORIGIN_HTTP_GET: "origin_http_get",
};

export function claimKey(claim) {
  if (!claim || !claim.type) return "unknown";
  switch (claim.type) {
    case ClaimType.HUMAN:
      return "human";
    case ClaimType.AGE_GTE:
      return `age_gte:${claim.age ?? "?"}`;
    case ClaimType.EXCLUDED_COUNTRIES_NOT_CONTAINS:
      return `excluded_countries_not_contains:${(claim.countries || []).join(
        ","
      )}`;
    case ClaimType.OFAC_CLEAR:
      return "ofac_clear";
    case ClaimType.ORIGIN_HTTP_GET:
      // Intentionally do not include URL in the key (it can be large/unbounded).
      // Costs should be schedulable per-claim-type, not per-resource.
      return "origin_http_get";
    default:
      return String(claim.type);
  }
}
