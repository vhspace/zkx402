import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { stableStringify } from "./policy.js";

export const PROOF_COST_ENVELOPE_SCHEMA_V1 = "zkx402.proofCostEnvelope.v1";

export function proofCostIntegrityHashSha256(costs) {
  return crypto
    .createHash("sha256")
    .update(stableStringify(costs))
    .digest("hex");
}

export function parseProofCostJson(raw) {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "proof_cost_json_invalid" };
  }

  if (raw.schema === PROOF_COST_ENVELOPE_SCHEMA_V1) {
    const costs = raw.costs;
    if (!costs || typeof costs !== "object") {
      return { ok: false, reason: "proof_costs_missing" };
    }

    const integrity = raw.integrity;
    if (
      integrity?.hashAlg === "sha256" &&
      typeof integrity?.hash === "string"
    ) {
      const computed = proofCostIntegrityHashSha256(costs);
      if (computed !== integrity.hash) {
        return { ok: false, reason: "proof_cost_integrity_mismatch" };
      }
    }

    return { ok: true, costs };
  }

  return { ok: true, costs: raw };
}

export function loadProofCostFile(filePath) {
  const raw = JSON.parse(readFileSync(filePath, "utf-8"));
  return parseProofCostJson(raw);
}

