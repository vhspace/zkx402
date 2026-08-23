import test from "node:test";
import assert from "node:assert/strict";
import {
  ExactEvmPayloadSchema,
  NetworkSchema,
  PaymentPayloadSchema,
} from "x402/types";
import { normalizeNetwork, toLegacyNetwork } from "../src/x402/networks.js";

// Guard for https://github.com/vhspace/zkx402/issues/117:
// every X-PAYMENT payload this repo puts on the wire must validate against the
// `x402` npm package's own zod schemas (not @coinbase/x402/*), and network
// identifiers must stay aligned with the CAIP-2 convention (#66).

function encodePaymentHeader(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function decodePaymentHeader(header) {
  return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
}

function makeEvmAuthorization({ now = Math.floor(Date.now() / 1000) } = {}) {
  return {
    from: "0x0000000000000000000000000000000000000001",
    to: "0x0000000000000000000000000000000000000002",
    value: "10000",
    validAfter: String(now - 60),
    validBefore: String(now + 60),
    nonce: "0x" + "22".repeat(32),
  };
}

// Mirrors the fixture shape in test/access_control.test.js / test/accepts_config.test.js
// and the paid-request client in apps/demo/local-chain/test-e2e.js.
function makeEvmPaymentPayload(network) {
  return {
    x402Version: 1,
    scheme: "exact",
    network,
    payload: {
      signature: "0x" + "11".repeat(65),
      authorization: makeEvmAuthorization(),
    },
  };
}

test("X-PAYMENT payloads validate against the x402 npm schema", () => {
  for (const legacy of ["base-sepolia", "base"]) {
    const header = encodePaymentHeader(makeEvmPaymentPayload(legacy));
    const decoded = decodePaymentHeader(header);

    const result = PaymentPayloadSchema.safeParse(decoded);
    assert.equal(
      result.success,
      true,
      `X-PAYMENT payload for ${legacy} drifted from the x402 npm schema: ` +
        (result.success ? "" : JSON.stringify(result.error.issues, null, 2))
    );
    assert.equal(
      ExactEvmPayloadSchema.safeParse(decoded.payload).success,
      true,
      `exact EVM payload for ${legacy} drifted from x402 ExactEvmPayloadSchema`
    );
  }
});

test("CAIP-2 wire payloads conform once mapped to the x402 v1 network name (#66)", () => {
  // The middleware emits/accepts CAIP-2 networks; clients echo them back into
  // X-PAYMENT. The only allowed divergence from the upstream schema is the
  // network identifier itself, which our bridge maps to its legacy name.
  for (const caip2 of ["eip155:84532", "eip155:8453"]) {
    const decoded = makeEvmPaymentPayload(caip2);
    const legacyForm = { ...decoded, network: toLegacyNetwork(decoded.network) };

    assert.notEqual(legacyForm.network, caip2, `no legacy bridge for ${caip2}`);
    const result = PaymentPayloadSchema.safeParse(legacyForm);
    assert.equal(
      result.success,
      true,
      `CAIP-2 payload for ${caip2} drifted from the x402 npm schema: ` +
        (result.success ? "" : JSON.stringify(result.error.issues, null, 2))
    );

    assert.equal(normalizeNetwork(legacyForm.network), caip2);
  }
});

test("network conventions stay aligned with the x402 npm schema (#66)", () => {
  // Networks the middleware actually registers (see paymentMiddleware in
  // src/middleware.js); "ethereum" in CAIP2_NETWORKS is v2-only and unserved.
  const servedNetworks = [
    ["base", "eip155:8453"],
    ["base-sepolia", "eip155:84532"],
    ["solana", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
    ["solana-devnet", "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"],
  ];
  for (const [legacy, caip2] of servedNetworks) {
    assert.equal(normalizeNetwork(legacy), caip2);
    assert.equal(toLegacyNetwork(caip2), legacy);
    assert.equal(
      NetworkSchema.safeParse(legacy).success,
      true,
      `upstream x402 no longer recognizes legacy network "${legacy}" bridged from ${caip2}`
    );
  }
});

test("drifted payloads fail the x402 npm schema (guard self-check)", () => {
  const drifts = [
    ["unknown scheme", { scheme: "utxo" }],
    ["unsupported x402Version", { x402Version: 99 }],
    [
      "missing authorization field",
      {
        payload: {
          signature: "0x" + "11".repeat(65),
          authorization: (() => {
            const { validBefore: _omit, ...rest } = makeEvmAuthorization();
            return rest;
          })(),
        },
      },
    ],
    ["short nonce", { payload: { signature: "0x" + "11".repeat(65), authorization: { ...makeEvmAuthorization(), nonce: "0x22" } } }],
  ];

  for (const [label, patch] of drifts) {
    const drifted = { ...makeEvmPaymentPayload("base-sepolia"), ...patch };
    assert.equal(
      PaymentPayloadSchema.safeParse(drifted).success,
      false,
      `expected drift "${label}" to be rejected by the x402 npm schema`
    );
  }
});
