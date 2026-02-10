import crypto from "node:crypto";
import { stableStringify } from "./policy.js";
import { normalizeProviderName } from "./policy.js";
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

function clampInt(n, { min, max, fallback }) {
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

function normalizeCostEntry(e) {
  if (!e || typeof e !== "object") return null;
  const provider = normalizeProviderName(
    typeof e.provider === "string" ? e.provider.trim() : ""
  );
  const claimKey = typeof e.claimKey === "string" ? e.claimKey.trim() : "";
  if (!provider || !claimKey) return null;

  // accept numbers, bigint, or strings; store as a stringified non-negative integer
  const cost = toBigIntOrZero(e.costUsdMicros);
  return {
    provider,
    claimKey,
    costUsdMicros: cost.toString(),
    description: typeof e.description === "string" ? e.description : undefined,
  };
}

export function normalizeProofCosts(costs) {
  if (!costs || typeof costs !== "object") return { ...DEFAULT_PROOF_COSTS };
  const bps = clampInt(Number(costs.defaultCommissionBps), {
    min: 0,
    max: 10000,
    fallback: DEFAULT_PROOF_COSTS.defaultCommissionBps,
  });
  const entries = Array.isArray(costs.entries) ? costs.entries : [];
  const normalizedEntries = [];
  for (const e of entries) {
    const ne = normalizeCostEntry(e);
    if (ne) normalizedEntries.push(ne);
  }
  return {
    version: Number(costs.version ?? DEFAULT_PROOF_COSTS.version),
    scope: String(costs.scope ?? DEFAULT_PROOF_COSTS.scope),
    currency: String(costs.currency ?? DEFAULT_PROOF_COSTS.currency),
    defaultCommissionBps: bps,
    entries: normalizedEntries,
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
  const providerName = normalizeProviderName(provider);
  const bps = clampInt(
    typeof commissionBpsOverride === "number"
      ? commissionBpsOverride
      : normalized.defaultCommissionBps,
    { min: 0, max: 10000, fallback: normalized.defaultCommissionBps }
  );

  // Index entries for fast lookups; last-write-wins if duplicates exist.
  const costByProviderClaimKey = new Map();
  for (const e of normalized.entries) {
    costByProviderClaimKey.set(`${e.provider}:${e.claimKey}`, e.costUsdMicros);
  }

  const breakdown = [];
  let total = 0n;

  for (const c of Array.isArray(claims) ? claims : []) {
    const k = claimKey(c);
    const key = `${providerName}:${k}`;
    const base = toBigIntOrZero(costByProviderClaimKey.get(key));
    const commission = applyCommissionBps(base, bps);
    const lineTotal = base + commission;
    total += lineTotal;
    breakdown.push({
      provider: providerName,
      claimKey: k,
      baseUsdMicros: base.toString(),
      commissionBps: bps,
      commissionUsdMicros: commission.toString(),
      totalUsdMicros: lineTotal.toString(),
    });
  }

  return {
    ok: true,
    provider: providerName,
    currency: normalized.currency,
    totalUsdMicros: total.toString(),
    breakdown,
  };
}

