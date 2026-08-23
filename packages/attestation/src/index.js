// STUB — goldenmcp attestation placeholder.
//
// The real pipeline (Chainlink CRE workflow + Confidential AI attester +
// Walrus publishing + Arc registry writes) will be imported from
// vhspace/goldenmcp. This module only pins the onchain record contract and
// the transcript-hash rule so callers can code against it before the import.

import { createHash } from "node:crypto";

export const ATTESTOR_KINDS = Object.freeze([
  "cai", // Chainlink Confidential AI TEE (primary in goldenmcp)
  "pot", // proof-of-thought consensus service (planned second attestor)
]);

export const REGISTRY_CALLS = Object.freeze({
  recordAttestation: "recordAttestation",
  updateCapabilityScore: "updateCapabilityScore",
});

export function emptyAttestationRecord() {
  return Object.freeze({
    inference_id: null,
    transcript_hash: null,
    capability: null,
    score: 0,
    walrus_blob: null,
    attestor: "cai",
  });
}

export function isCompleteAttestation(record) {
  return (
    typeof record?.inference_id === "string" &&
    record.inference_id.length > 0 &&
    typeof record?.transcript_hash === "string" &&
    record.transcript_hash.length > 0
  );
}

// Mirrors goldenmcp: prefer the enclave's `response_digest`; fall back to
// sha256(output). Both end up as a bytes32 hex string onchain.
export function transcriptHash({ responseDigest = null, output = null } = {}) {
  if (typeof responseDigest === "string" && responseDigest.length > 0) {
    return normalizeBytes32(responseDigest);
  }
  if (output == null) return null;
  const bytes =
    typeof output === "string" ? Buffer.from(output, "utf8") : Buffer.from(output);
  return "0x" + createHash("sha256").update(bytes).digest("hex");
}

function normalizeBytes32(value) {
  const hex = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("responseDigest is not a bytes32 hex string");
  }
  return "0x" + hex.toLowerCase();
}
