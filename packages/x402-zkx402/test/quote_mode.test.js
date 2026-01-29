import test from "node:test";
import assert from "node:assert/strict";
import { paymentMiddleware } from "../src/middleware.js";

test("quote mode: api-only provider is quoted for pricing", async () => {
  const routes = {
    "GET /quote": {
      price: "$0.01",
      network: "base-sepolia",
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
    routes
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
  let headers = {};
  let body = null;

  const res = {
    status: (s) => {
      statusSet = s;
      return res;
    },
    set: (k, v) => {
      headers[k] = v;
      return res;
    },
    json: (b) => {
      body = b;
      return res;
    },
    setHeader: (k, v) => {
      headers[k] = v;
      return res;
    },
  };

  await middleware(req, res, () => {});

  assert.equal(statusSet, 402);
  assert.equal(body?.accepts?.[0]?.amount, "5000");

  const details = req.verificationMetadata?.verificationResult?.verificationDetails || [];
  assert.equal(details[0]?.quoted, true);
  assert.equal(details[0]?.attempts?.[0]?.reason, "quoted");
});
