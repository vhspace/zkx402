import test from "node:test";
import assert from "node:assert/strict";
import { ClaimType, parseLegacyZkProofToClaim, claimKey } from "../src/proofs/claims.js";

test("parseLegacyZkProofToClaim: human", () => {
  const c = parseLegacyZkProofToClaim("zkproofOf(human)");
  assert.equal(c.type, ClaimType.HUMAN);
  assert.equal(claimKey(c), "human");
});

test("parseLegacyZkProofToClaim: age>=21 (canonical but not implemented)", () => {
  const c = parseLegacyZkProofToClaim("zkproofOf(age>=21)");
  assert.equal(c.type, ClaimType.AGE_GTE);
  assert.equal(c.age, 21);
});

test("parseLegacyZkProofToClaim: excludedCountries list", () => {
  const c = parseLegacyZkProofToClaim("zkproofOf(excludedCountries=[US,RU])");
  assert.equal(c.type, ClaimType.EXCLUDED_COUNTRIES_NOT_CONTAINS);
  assert.deepEqual(c.countries, ["US", "RU"]);
});

test("parseLegacyZkProofToClaim: ofac", () => {
  const c = parseLegacyZkProofToClaim("zkproofOf(ofac)");
  assert.equal(c.type, ClaimType.OFAC_CLEAR);
});

test("parseLegacyZkProofToClaim: unknown", () => {
  const c = parseLegacyZkProofToClaim("zkproofOf(institution=NYT)");
  assert.equal(c.type, "legacy:institution=nyt");
  assert.equal(c.raw, "zkproofOf(institution=NYT)");
});



