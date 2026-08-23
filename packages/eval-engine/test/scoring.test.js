import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SCORING_WEIGHTS,
  BINARY_FAIL_REASONS,
  isBinaryFail,
  tokenEfficiency,
  compositeScore,
  scoreRun,
  emptyManifest,
} from "../src/index.js";

test("scoring weights sum to 1", () => {
  const sum = Object.values(SCORING_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.equal(sum, 1);
});

test("composite matches goldenmcp weights", () => {
  const score = compositeScore({ data: 1, path: 1, token: 1 });
  assert.equal(score, 0.45 * 1 + 0.35 * 1 + 0.2 * 1);
});

test("composite clamps to [0, 1]", () => {
  assert.equal(compositeScore({ data: -5 }), 0);
});

test("token efficiency caps at 0 when over baseline", () => {
  assert.equal(tokenEfficiency(16000, 8000), 0);
  assert.equal(tokenEfficiency(4000, 8000), 0.5);
});

test("binary fail zeroes the composite", () => {
  const run = scoreRun({
    dimensions: { data: 1, path: 1, token: 1 },
    security: { fail: true, reason: "prompt_injection" },
  });
  assert.equal(run.composite, 0);
  assert.equal(run.binaryFail, true);
});

test("every documented binary-fail reason is recognized", () => {
  for (const reason of BINARY_FAIL_REASONS) {
    assert.ok(isBinaryFail(reason));
  }
  assert.equal(isBinaryFail("nonsense"), false);
});

test("manifest stub has attestation linkage fields", () => {
  const manifest = emptyManifest();
  assert.ok("walrus_blob" in manifest);
  assert.ok("attestation_id" in manifest);
  assert.ok("transcript_hash" in manifest);
});
