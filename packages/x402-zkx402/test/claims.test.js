import test from "node:test";
import assert from "node:assert/strict";
import { ClaimType, claimKey } from "../src/proofs/claims.js";

test("claimKey: human", () => {
  const c = { type: ClaimType.HUMAN };
  assert.equal(claimKey(c), "human");
});

test("claimKey: age_gte", () => {
  const c = { type: ClaimType.AGE_GTE, age: 21 };
  assert.equal(claimKey(c), "age_gte:21");
});

test("claimKey: excluded_countries_not_contains", () => {
  const c = { type: ClaimType.EXCLUDED_COUNTRIES_NOT_CONTAINS, countries: ["US", "RU"] };
  assert.equal(claimKey(c), "excluded_countries_not_contains:US,RU");
});

test("claimKey: ofac_clear", () => {
  const c = { type: ClaimType.OFAC_CLEAR };
  assert.equal(claimKey(c), "ofac_clear");
});



