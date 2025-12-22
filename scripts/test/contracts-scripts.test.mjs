import test from "node:test";
import assert from "node:assert/strict";

import {
  parseDeployedAddress,
  upsertDotenvKey,
  parseDotenv,
} from "../../apps/demo/contracts/scripts/lib.mjs";

import { buildBlockscoutPayload } from "../../apps/demo/contracts/scripts/blockscout-verify.mjs";

test("parseDeployedAddress: parses 'Deployed at:'", () => {
  const out = "...\nDeployed at: 0x1234567890abcdef1234567890ABCDEF12345678\n...";
  assert.equal(parseDeployedAddress(out), "0x1234567890abcdef1234567890ABCDEF12345678");
});

test("parseDeployedAddress: parses 'Deployed to:'", () => {
  const out = "Deployed to: 0x1234567890abcdef1234567890ABCDEF12345678";
  assert.equal(parseDeployedAddress(out), "0x1234567890abcdef1234567890ABCDEF12345678");
});

test("upsertDotenvKey: inserts key when missing", () => {
  const next = upsertDotenvKey("# hi\nA=1\n", "B", "2");
  const parsed = parseDotenv(next);
  assert.equal(parsed.A, "1");
  assert.equal(parsed.B, "2");
});

test("upsertDotenvKey: replaces existing key", () => {
  const next = upsertDotenvKey("A=1\nB=2\n", "B", "999");
  const parsed = parseDotenv(next);
  assert.equal(parsed.B, "999");
});

test("buildBlockscoutPayload: basic shape", () => {
  const p = buildBlockscoutPayload({
    compilerVersion: "v0.8.28+commit.7893614a",
    optimization: true,
    optimizationRuns: 200,
    contractName: "ProofOfHumanReceiver",
    evmVersion: "paris",
    sourceCode: "// solidity",
    constructorArgs: null,
    licenseType: "mit",
  });
  assert.equal(p.compiler_version, "v0.8.28+commit.7893614a");
  assert.equal(p.contract_name, "ProofOfHumanReceiver");
  assert.equal(p.autodetect_constructor_args, true);
});

