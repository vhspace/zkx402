import test from "node:test";
import assert from "node:assert/strict";
import { createSelfApiProvider } from "../src/proofs/providers/self_api.js";
import { ClaimType } from "../src/proofs/claims.js";

test("self_api: not configured without SELF_API_URL", async () => {
  const p = createSelfApiProvider({ apiUrl: null, fetchImpl: async () => ({ ok: true }) });
  const res = await p.verifyHuman({
    walletAddress: "0x0000000000000000000000000000000000000001",
    selfProof: { any: "thing" },
    claim: { type: ClaimType.HUMAN },
    policy: { scope: "zkx402" },
  });
  assert.equal(res.ok, false);
  assert.equal(res.status, "not_configured");
});

test("self_api: posts payload and interprets verified=true", async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: true,
      status: 200,
      json: async () => ({ verified: true }),
    };
  };

  const p = createSelfApiProvider({
    apiUrl: "https://self.example/verify",
    apiKey: "k",
    fetchImpl,
    timeoutMs: 50,
  });

  const res = await p.verifyHuman({
    walletAddress: "0x00000000000000000000000000000000000000Ab",
    selfProof: { sessionId: "abc" },
    claim: { type: ClaimType.HUMAN },
    policy: { scope: "zkx402" },
    correlationId: "cid",
  });

  assert.equal(res.ok, true);
  assert.equal(res.verified, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://self.example/verify");
  assert.equal(calls[0].opts.method, "POST");
  assert.equal(calls[0].opts.headers.Authorization, "Bearer k");
  assert.equal(calls[0].opts.headers["X-Correlation-Id"], "cid");

  const body = JSON.parse(calls[0].opts.body);
  assert.equal(body.vendor, "self.xyz");
  assert.equal(body.scope, "zkx402");
  assert.equal(body.subject.walletAddress, "0x00000000000000000000000000000000000000ab");
  assert.equal(body.claim.type, ClaimType.HUMAN);
  assert.equal(body.proof.sessionId, "abc");
});

