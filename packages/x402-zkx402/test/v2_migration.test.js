import test from "node:test";
import assert from "node:assert/strict";
import { paymentMiddleware } from "../src/middleware.js";
import { normalizeNetwork } from "../src/x402/networks.js";

test("networks: normalizes legacy names to CAIP-2", () => {
  assert.equal(normalizeNetwork("base-sepolia"), "eip155:84532");
  assert.equal(normalizeNetwork("base"), "eip155:8453");
  assert.equal(normalizeNetwork("solana"), "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp");
  assert.equal(normalizeNetwork("eip155:1"), "eip155:1"); // No change if already CAIP-2
});

test("middleware: returns 402 with PAYMENT-REQUIRED header when no payment present", async () => {
  const payTo = "0x1234567890123456789012345678901234567890";
  const routes = {
    "GET /test": {
      price: "$0.01",
      network: "base-sepolia",
      config: { description: "Test resource" }
    }
  };
  
  const middleware = paymentMiddleware(payTo, routes);
  
  const req = {
    method: "GET",
    path: "/test",
    originalUrl: "/test",
    header: (name) => null,
    headers: {},
    protocol: "http"
  };
  
  let statusSet = null;
  let headers = {};
  let body = null;
  
  const res = {
    status: (s) => { statusSet = s; return res; },
    set: (k, v) => { headers[k] = v; return res; },
    json: (b) => { body = b; return res; },
    setHeader: (k, v) => { headers[k] = v; return res; }
  };
  
  const next = () => {};
  
  await middleware(req, res, next);
  
  assert.equal(statusSet, 402);
  assert.ok(headers["PAYMENT-REQUIRED"]);
  
  const decoded = JSON.parse(Buffer.from(headers["PAYMENT-REQUIRED"], "base64").toString());
  assert.equal(decoded.x402Version, 2);
  assert.equal(decoded.resource.url, "http://undefined/test"); // host is undefined in mock
  assert.equal(decoded.accepts[0].amount, "10000"); // 0.01 USDC
  assert.equal(decoded.accepts[0].network, "eip155:84532");
});

test("middleware: respects X-Forwarded headers for resource URL", async () => {
  const payTo = "0x1234567890123456789012345678901234567890";
  const routes = {
    "GET /test": {
      price: "$0.01",
      network: "base-sepolia"
    }
  };
  
  const middleware = paymentMiddleware(payTo, routes);
  
  const req = {
    method: "GET",
    path: "/test",
    originalUrl: "/test?foo=bar",
    header: (name) => {
      if (name === "X-Forwarded-Proto") return "https";
      if (name === "X-Forwarded-Host") return "api.example.com";
      return null;
    },
    headers: {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "api.example.com"
    },
    protocol: "http",
    get: (name) => null
  };
  
  let headers = {};
  const res = {
    status: () => res,
    set: (k, v) => { headers[k] = v; return res; },
    json: () => res,
    setHeader: (k, v) => { headers[k] = v; return res; }
  };
  
  await middleware(req, res, () => {});
  
  const decoded = JSON.parse(Buffer.from(headers["PAYMENT-REQUIRED"], "base64").toString());
  assert.equal(decoded.resource.url, "https://api.example.com/test?foo=bar");
});
