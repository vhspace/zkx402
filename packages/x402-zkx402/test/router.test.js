import test from "node:test";
import assert from "node:assert/strict";
import { verifyClaimWithPolicy, VerifyStatus } from "../src/proofs/router.js";
import { ClaimType } from "../src/proofs/claims.js";

test("router: unknown claim returns NOT_IMPLEMENTED", async () => {
  const res = await verifyClaimWithPolicy({
    claim: { type: "not_a_real_claim" },
    policy: {},
    providers: [],
    context: {},
  });
  assert.equal(res.status, VerifyStatus.NOT_IMPLEMENTED);
});

test("router: supports AGE_GTE when provider implements it", async () => {
  const providers = [
    {
      name: "self_api",
      verifyAgeGte: async ({ claim }) => {
        assert.equal(claim.type, ClaimType.AGE_GTE);
        assert.equal(claim.age, 21);
        return { ok: true, verified: true };
      },
    },
  ];

  const res = await verifyClaimWithPolicy({
    claim: { type: ClaimType.AGE_GTE, age: 21 },
    policy: { allowedProviders: ["self_api"], preferenceOrder: ["self_api"] },
    providers,
    context: { walletAddress: "0x0000000000000000000000000000000000000001" },
  });
  assert.equal(res.status, VerifyStatus.VERIFIED);
  assert.equal(res.provider, "self_api");
});

test("router: supports ORIGIN_HTTP_GET when provider implements it", async () => {
  const providers = [
    {
      name: "vlayer_api",
      verifyOriginHttpGet: async ({ claim }) => {
        assert.equal(claim.type, ClaimType.ORIGIN_HTTP_GET);
        assert.equal(claim.url, "https://example.com/secret");
        return { ok: true, verified: true };
      },
    },
  ];

  const res = await verifyClaimWithPolicy({
    claim: { type: ClaimType.ORIGIN_HTTP_GET, url: "https://example.com/secret" },
    policy: { allowedProviders: ["vlayer_api"], preferenceOrder: ["vlayer_api"] },
    providers,
    context: { walletAddress: "0x0000000000000000000000000000000000000001" },
  });

  assert.equal(res.status, VerifyStatus.VERIFIED);
  assert.equal(res.provider, "vlayer_api");
});

test("router: human claim, no providers after filtering -> ERROR", async () => {
  const res = await verifyClaimWithPolicy({
    claim: { type: ClaimType.HUMAN },
    policy: { allowedProviders: ["self"], preferenceOrder: ["self"] },
    providers: [],
    context: { walletAddress: "0x0000000000000000000000000000000000000001" },
  });
  assert.equal(res.status, VerifyStatus.ERROR);
});

test("router: honors preferenceOrder + allowedProviders", async () => {
  const calls = [];
  const providers = [
    {
      name: "a",
      verifyHuman: async () => {
        calls.push("a");
        return { ok: true, verified: true };
      },
    },
    {
      name: "self",
      verifyHuman: async () => {
        calls.push("self");
        return { ok: true, verified: false };
      },
    },
  ];

  const res = await verifyClaimWithPolicy({
    claim: { type: ClaimType.HUMAN },
    policy: { allowedProviders: ["self"], preferenceOrder: ["self", "a"] },
    providers,
    context: { walletAddress: "0x0000000000000000000000000000000000000001" },
  });

  assert.deepEqual(calls, ["self"]);
  assert.equal(res.status, VerifyStatus.NOT_VERIFIED);
  assert.equal(res.provider, "self");
});

test("router: tries next provider if earlier provider errors", async () => {
  const calls = [];
  const providers = [
    {
      name: "self",
      verifyHuman: async () => {
        calls.push("self");
        return { ok: false, status: "error", reason: "boom" };
      },
    },
    {
      name: "backup",
      verifyHuman: async () => {
        calls.push("backup");
        return { ok: true, verified: true };
      },
    },
  ];

  const res = await verifyClaimWithPolicy({
    claim: { type: ClaimType.HUMAN },
    policy: { allowedProviders: ["self", "backup"], preferenceOrder: ["self", "backup"] },
    providers,
    context: { walletAddress: "0x0000000000000000000000000000000000000001" },
  });

  assert.deepEqual(calls, ["self", "backup"]);
  assert.equal(res.status, VerifyStatus.VERIFIED);
  assert.equal(res.provider, "backup");
});



