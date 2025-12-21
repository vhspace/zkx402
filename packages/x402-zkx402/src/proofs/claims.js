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

/**
 * Parse legacy `zkproofOf(...)` strings into canonical claims.
 *
 * Chain-only v1:
 * - "zkproofOf(human)" -> { type: "human" }
 *
 * Everything else becomes a canonical but NOT_IMPLEMENTED claim so the router
 * can return structured "not implemented" outcomes.
 */
export function parseLegacyZkProofToClaim(proofString) {
  const raw = String(proofString || "").trim();
  const normalized = raw.toLowerCase();

  if (normalized === "zkproofof(human)") {
    return { type: ClaimType.HUMAN };
  }

  const m = normalized.match(/^zkproofof\((.*)\)$/);
  const inner = m?.[1]?.trim() || "";

  // minimal forward-compat: recognize obvious rule-y patterns without enforcing
  // (still chain-only, so router will respond NOT_IMPLEMENTED)
  const ageMatch = inner.match(/^age\s*>=\s*(\d+)$/);
  if (ageMatch) {
    return { type: ClaimType.AGE_GTE, age: Number(ageMatch[1]) };
  }

  if (
    inner.startsWith("excludedcountries=") ||
    inner.startsWith("excluded_countries=")
  ) {
    const list = inner.split("=", 2)[1] || "";
    const countries = list
      .replace(/^\[|\]$/g, "")
      .split(/[,\s]+/)
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    return { type: ClaimType.EXCLUDED_COUNTRIES_NOT_CONTAINS, countries };
  }

  if (inner === "ofac" || inner === "ofac_clear") {
    return { type: ClaimType.OFAC_CLEAR };
  }

  // unknown legacy proof -> treat as unknown claim (not implemented)
  return { type: inner ? `legacy:${inner}` : "legacy:unknown", raw };
}
