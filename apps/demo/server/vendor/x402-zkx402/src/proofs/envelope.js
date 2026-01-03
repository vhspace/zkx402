import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { stableStringify } from "./policy.js";

export const PROOF_POLICY_ENVELOPE_SCHEMA_V1 = "zkx402.proofPolicyEnvelope.v1";

export function policyIntegrityHashSha256(policy) {
  return crypto.createHash("sha256").update(stableStringify(policy)).digest("hex");
}

export function parseProofPolicyJson(raw) {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "policy_json_invalid" };
  }

  // Envelope form
  if (raw.schema === PROOF_POLICY_ENVELOPE_SCHEMA_V1) {
    const policy = raw.policy;
    if (!policy || typeof policy !== "object") {
      return { ok: false, reason: "policy_missing" };
    }

    const integrity = raw.integrity;
    if (integrity?.hashAlg === "sha256" && typeof integrity?.hash === "string") {
      const computed = policyIntegrityHashSha256(policy);
      if (computed !== integrity.hash) {
        return { ok: false, reason: "policy_integrity_mismatch" };
      }
    }

    return { ok: true, policy };
  }

  // Plain policy form (non-envelope configs)
  return { ok: true, policy: raw };
}

export function loadProofPolicyFile(filePath) {
  const raw = JSON.parse(readFileSync(filePath, "utf-8"));
  return parseProofPolicyJson(raw);
}


