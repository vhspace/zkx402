import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCommissionBps,
  computeVerificationCostUsdMicros,
} from "../src/proofs/costs.js";
import { ClaimType } from "../src/proofs/claims.js";

test("applyCommissionBps: rounds up", () => {
  // 1 micros with 1 bps => ceil(1 * 0.0001) == 1
  assert.equal(applyCommissionBps("1", 1).toString(), "1");
  // 10000 micros with 1 bps => 1
  assert.equal(applyCommissionBps("10000", 1).toString(), "1");
});

test("computeVerificationCostUsdMicros: sums base + commission per claimKey", () => {
  const costs = {
    version: 1,
    scope: "zkx402",
    currency: "usd_micros",
    defaultCommissionBps: 250, // 2.5%
    entries: [
      { provider: "self_api", claimKey: "human", costUsdMicros: "1000" },
      { provider: "self_api", claimKey: "age_gte:21", costUsdMicros: "2000" },
    ],
  };

  const res = computeVerificationCostUsdMicros({
    provider: "self_api",
    costs,
    claims: [
      { type: ClaimType.HUMAN },
      { type: ClaimType.AGE_GTE, age: 21 },
    ],
  });

  assert.equal(res.ok, true);
  // 1000 + ceil(1000*0.025)=1000+25=1025
  // 2000 + ceil(2000*0.025)=2000+50=2050
  assert.equal(res.totalUsdMicros, "3075");
  assert.equal(res.breakdown.length, 2);
});

