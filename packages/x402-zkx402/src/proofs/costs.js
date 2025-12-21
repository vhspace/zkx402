import crypto from "node:crypto";
import { stableStringify } from "./policy.js";
import { claimKey } from "./claims.js";

export const DEFAULT_PROOF_COSTS = Object.freeze({
  version: 1,
  scope: "zkx402",
  currency: "usd_micros",
  // added to each cost as a markup (platform commission)
  defaultCommissionBps: 0,
  // list of costs per provider+claimKey
  // costUsdMicros is a stringified integer
  entries: [],
});

export function normalizeProofCosts(costs) {
  if (!costs || typeof costs !== "object") return { ...DEFAULT_PROOF_COSTS };
  return {
    version: Number(costs.version ?? DEFAULT_PROOF_COSTS.version),
    scope: String(costs.scope ?? DEFAULT_PROOF_COSTS.scope),
    currency: String(costs.currency ?? DEFAULT_PROOF_COSTS.currency),
    defaultCommissionBps: Number(
      costs.defaultCommissionBps ?? DEFAULT_PROOF_COSTS.defaultCommissionBps
    ),
    entries: Array.isArray(costs.entries) ? costs.entries : [],
  };
}

export function proofCostsHash(costs) {
  try {
    const s = stableStringify(costs);
    return crypto.createHash("sha256").update(s).digest("hex");
  } catch {
    return null;
  }
}

function toBigIntOrZero(v) {
  try {
    if (typeof v === "bigint") return v;
    if (typeof v === "number") return BigInt(Math.max(0, Math.floor(v)));
    const s = String(v ?? "0").trim();
    if (!s) return 0n;
    return BigInt(s);
  } catch {
    return 0n;
  }
}

export function applyCommissionBps(amount, bps) {
  const a = toBigIntOrZero(amount);
  const b = toBigIntOrZero(bps);
  if (a === 0n || b === 0n) return 0n;
  // round up to avoid undercharging
  return (a * b + 9999n) / 10000n;
}

/**
 * Compute the verification cost for a set of canonical claims for a given provider.
 *
 * - Uses `claimKey(claim)` (supports parameterized keys like `age_gte:21`)
 * - Looks up matching `{ provider, claimKey }` entries
 */
export function computeVerificationCostUsdMicros({
  claims,
  provider,
  costs,
  commissionBpsOverride,
}) {
  const normalized = normalizeProofCosts(costs);
  const bps =
    typeof commissionBpsOverride === "number"
      ? commissionBpsOverride
      : normalized.defaultCommissionBps;

  const breakdown = [];
  let total = 0n;

  for (const c of Array.isArray(claims) ? claims : []) {
    const k = claimKey(c);
    const entry = normalized.entries.find(
      (e) => e && e.provider === provider && String(e.claimKey) === k
    );
    const base = toBigIntOrZero(entry?.costUsdMicros);
    const commission = applyCommissionBps(base, bps);
    const lineTotal = base + commission;
    total += lineTotal;
    breakdown.push({
      provider,
      claimKey: k,
      baseUsdMicros: base.toString(),
      commissionBps: bps,
      commissionUsdMicros: commission.toString(),
      totalUsdMicros: lineTotal.toString(),
    });
  }

  return { ok: true, provider, currency: normalized.currency, totalUsdMicros: total.toString(), breakdown };
}

