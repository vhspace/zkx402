export const ClaimType = {
  HUMAN: "human",
  AGE_GTE: "age_gte",
  EXCLUDED_COUNTRIES_NOT_CONTAINS: "excluded_countries_not_contains",
  OFAC_CLEAR: "ofac_clear",
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
    default:
      return String(claim.type);
  }
}
