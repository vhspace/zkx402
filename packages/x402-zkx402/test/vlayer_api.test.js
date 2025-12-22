import test from "node:test";
import assert from "node:assert/strict";
import { createVlayerApiProvider } from "../src/proofs/providers/vlayer_api.js";
import { ClaimType } from "../src/proofs/claims.js";

test("vlayer_api: not configured without VLAYERS_API_URL", async () => {
  const p = createVlayerApiProvider({ apiUrl: null, fetchImpl: async () => ({ ok: true }) });
  const res = await p.verifyOriginHttpGet({
    walletAddress: "0x0000000000000000000000000000000000000001",
    vlayerProof: { any: "thing" },
    claim: { type: ClaimType.ORIGIN_HTTP_GET, url: "https://example.com" },
    policy: { scope: "zkx402" },
  });
  assert.equal(res.ok, false);
  assert.equal(res.status, "not_configured");
});

test("vlayer_api: invalid input without proof payload", async () => {
  const p = createVlayerApiProvider({
    apiUrl: "https://vlayer.example/verify",
    fetchImpl: async () => ({ ok: true, json: async () => ({ verified: true }) }),
  });

  const res = await p.verifyOriginHttpGet({
    walletAddress: "0x0000000000000000000000000000000000000001",
    vlayerProof: null,
    claim: { type: ClaimType.ORIGIN_HTTP_GET, url: "https://example.com" },
    policy: { scope: "zkx402" },
  });

  assert.equal(res.ok, false);
  assert.equal(res.status, "invalid_input");
});

test("vlayer_api: posts payload and interprets verified=true", async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: true,
      status: 200,
      json: async () => ({ verified: true }),
    };
  };

  const p = createVlayerApiProvider({
    apiUrl: "https://vlayer.example/verify",
    apiKey: "k",
    fetchImpl,
    timeoutMs: 50,
  });

  const res = await p.verifyOriginHttpGet({
    walletAddress: "0x00000000000000000000000000000000000000Ab",
    vlayerProof: { success: true, data: "deadbeef" },
    claim: { type: ClaimType.ORIGIN_HTTP_GET, url: "https://example.com/secret" },
    policy: { scope: "zkx402" },
    correlationId: "cid",
  });

  assert.equal(res.ok, true);
  assert.equal(res.verified, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://vlayer.example/verify");
  assert.equal(calls[0].opts.method, "POST");
  assert.equal(calls[0].opts.headers.Authorization, "Bearer k");
  assert.equal(calls[0].opts.headers["X-Correlation-Id"], "cid");

  const body = JSON.parse(calls[0].opts.body);
  assert.equal(body.vendor, "vlayer");
  assert.equal(body.scope, "zkx402");
  assert.equal(body.subject.walletAddress, "0x00000000000000000000000000000000000000ab");
  assert.equal(body.claim.type, ClaimType.ORIGIN_HTTP_GET);
  assert.equal(body.proof.success, true);
});

