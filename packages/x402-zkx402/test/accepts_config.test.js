import test from "node:test";
import assert from "node:assert/strict";
import { paymentMiddleware } from "../src/middleware.js";

function makePaymentHeader({ network = "base-sepolia" } = {}) {
  const paymentObj = {
    x402Version: 1,
    scheme: "exact",
    network,
    payload: {
      signature: "0x" + "11".repeat(65),
      authorization: {
        from: "0x0000000000000000000000000000000000000001",
        to: "0x0000000000000000000000000000000000000002",
        value: "10000",
        validAfter: "0",
        validBefore: String(Math.floor(Date.now() / 1000) + 60),
        nonce: "0x" + "22".repeat(32),
      },
    },
  };
  return Buffer.from(JSON.stringify(paymentObj)).toString("base64");
}

test("quote mode: accepts[] uses quoted API provider for discounts", async () => {
  const routes = {
    "GET /quote": {
      accepts: [
        {
          scheme: "exact",
          network: "base-sepolia",
          amount: "10000",
          payTo: "0x0000000000000000000000000000000000000002",
          asset: "0x0000000000000000000000000000000000000003",
          extra: { name: "USDC", version: "2" },
        },
      ],
      config: {
        extra: {
          variableAmountRequired: [
            {
              requiredClaims: [{ type: "human" }],
              amountRequired: "5000",
            },
          ],
          proofPolicy: {
            version: 1,
            scope: "zkx402",
            allowedProviders: ["self_api"],
            preferenceOrder: ["self_api"],
            fallback: "none",
          },
        },
      },
    },
  };

  const middleware = paymentMiddleware(
    "0x0000000000000000000000000000000000000002",
    routes,
  );

  const req = {
    method: "GET",
    path: "/quote",
    originalUrl: "/quote",
    header: () => null,
    headers: {
      "x-proof-claims": JSON.stringify([{ type: "human" }]),
    },
    protocol: "http",
  };

  let statusSet = null;
  let body = null;

  const res = {
    status: (s) => {
      statusSet = s;
      return res;
    },
    set: () => res,
    json: (b) => {
      body = b;
      return res;
    },
    setHeader: () => res,
  };

  await middleware(req, res, () => {});

  assert.equal(statusSet, 402);
  assert.equal(body?.accepts?.[0]?.amount, "5000");

  const details =
    req.verificationMetadata?.verificationResult?.verificationDetails || [];
  assert.equal(details[0]?.quoted, true);
  assert.equal(details[0]?.attempts?.[0]?.reason, "quoted");
});

test("paid mode: accepts[] hard-gate returns 403 on verification failure", async () => {
  const routes = {
    "GET /gated": {
      accepts: [
        {
          scheme: "exact",
          network: "base-sepolia",
          amount: "10000",
          payTo: "0x0000000000000000000000000000000000000002",
          asset: "0x0000000000000000000000000000000000000003",
          extra: { name: "USDC", version: "2" },
        },
      ],
      config: {
        extra: {
          accessControl: {
            mode: "deny",
            statusCode: 403,
            requiredClaims: [{ type: "human" }],
          },
          proofPolicy: {
            version: 1,
            scope: "zkx402",
            allowedProviders: ["self_api"],
            preferenceOrder: ["self_api"],
            fallback: "none",
          },
        },
      },
    },
  };

  const facilitator = {
    verify: async () => ({ isValid: true }),
    settle: async () => ({ success: true }),
    supported: async () => ({ kinds: [] }),
  };

  const middleware = paymentMiddleware(
    "0x0000000000000000000000000000000000000002",
    routes,
    facilitator,
  );

  const req = {
    method: "GET",
    path: "/gated",
    originalUrl: "/gated",
    header: (name) => (name === "X-PAYMENT" ? makePaymentHeader() : null),
    headers: {
      "x-wallet-address": "0x0000000000000000000000000000000000000001",
    },
    protocol: "http",
  };

  let statusSet = null;
  let body = null;

  const res = {
    status: (s) => {
      statusSet = s;
      return res;
    },
    set: () => res,
    json: (b) => {
      body = b;
      return res;
    },
    setHeader: () => res,
  };

  await middleware(req, res, () => {});

  assert.equal(statusSet, 403);
  assert.equal(body?.error, "proofs_required");
});
