import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  ATTESTOR_KINDS,
  REGISTRY_CALLS,
  emptyAttestationRecord,
  isCompleteAttestation,
  transcriptHash,
} from "../src/index.js";

test("attestor kinds include cai and pot", () => {
  assert.deepEqual([...ATTESTOR_KINDS].sort(), ["cai", "pot"]);
});

test("registry calls match the goldenmcp MCPRegistry interface", () => {
  assert.equal(REGISTRY_CALLS.recordAttestation, "recordAttestation");
  assert.equal(REGISTRY_CALLS.updateCapabilityScore, "updateCapabilityScore");
});

test("prefers enclave response_digest", () => {
  const digest = "0x" + "ab".repeat(32);
  assert.equal(transcriptHash({ responseDigest: digest }), digest);
});

test("falls back to sha256(output) as bytes32 hex", () => {
  const expected = createHash("sha256").update("hello", "utf8").digest("hex");
  assert.equal(transcriptHash({ output: "hello" }), "0x" + expected);
});

test("rejects non-bytes32 digests instead of trusting them", () => {
  assert.throws(() => transcriptHash({ responseDigest: "0x1234" }));
});

test("completeness requires inference_id and transcript_hash", () => {
  assert.equal(isCompleteAttestation(emptyAttestationRecord()), false);
  assert.equal(
    isCompleteAttestation({
      inference_id: "inf_1",
      transcript_hash: "0x" + "cd".repeat(32),
    }),
    true
  );
});
