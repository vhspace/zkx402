import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";

import { paymentMiddleware } from "../src/middleware.js";

function startJsonRpcServer({ ethCallResultHex = null } = {}) {
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString("utf8");
    const payload = JSON.parse(body);

    const { id, method } = payload;

    const reply = (result) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id, result }));
    };

    const error = (message) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32000, message } }));
    };

    if (method === "eth_chainId") return reply("0x1");
    if (method === "eth_blockNumber") return reply("0x1");
    if (method === "eth_getCode") return reply("0x6000");
    if (method === "eth_call") {
      if (ethCallResultHex === null) return error("eth_call not configured");
      return reply(ethCallResultHex);
    }

    return error(`unsupported method: ${method}`);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

function makePaymentHeader({ network = "base-sepolia" } = {}) {
  // The middleware decodes this via `x402/schemes` and then uses a facilitator to verify.
  // For these unit tests we stub the facilitator to always accept the decoded payment.
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

async function startExpressServer({ rpcUrl, receiverAddress, verified }) {
  const app = express();
  app.use(express.json());

  const payTo = "0x0000000000000000000000000000000000000002";
  const routes = {
    "GET /gated": {
      price: "$0.01",
      network: "base-sepolia",
      config: {
        extra: {
          proofPolicy: {
            version: 1,
            scope: "zkx402",
            allowedProviders: ["self"],
            preferenceOrder: ["self"],
            fallback: "none",
          },
          requiredClaims: [{ type: "human" }],
        },
      },
    },
  };

  const facilitator = {
    verify: async () => ({ isValid: true }),
    settle: async () => ({ success: true }),
    supported: async () => ({ kinds: [] }),
  };

  const oldRpcUrl = process.env.SELF_RPC_URL;
  const oldReceiver = process.env.BASE_PROOF_OF_HUMAN_RECEIVER;
  process.env.SELF_RPC_URL = rpcUrl;
  process.env.BASE_PROOF_OF_HUMAN_RECEIVER = receiverAddress;

  app.use(paymentMiddleware(payTo, routes, facilitator));
  app.get("/gated", (req, res) => {
    res.json({ ok: true, verified: Boolean(verified) });
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const close = async () => {
    process.env.SELF_RPC_URL = oldRpcUrl;
    process.env.BASE_PROOF_OF_HUMAN_RECEIVER = oldReceiver;
    await new Promise((r) => server.close(r));
  };

  return { baseUrl, close };
}

test("access control: quote-mode returns 402 (not 403)", async () => {
  const { server: rpcServer, url: rpcUrl } = await startJsonRpcServer({
    ethCallResultHex: "0x" + "0".repeat(63) + "1",
  });

  const receiverAddress = "0x0000000000000000000000000000000000000002";
  const { baseUrl, close } = await startExpressServer({
    rpcUrl,
    receiverAddress,
    verified: true,
  });

  try {
    const res = await fetch(`${baseUrl}/gated`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    assert.equal(res.status, 402);
    const body = await res.json();
    assert.equal(body.error, "X-PAYMENT header is required");
  } finally {
    await close();
    await new Promise((r) => rpcServer.close(r));
  }
});

test("access control: paid request denied (403) when claims cannot be verified", async () => {
  const { server: rpcServer, url: rpcUrl } = await startJsonRpcServer({
    ethCallResultHex: "0x" + "0".repeat(64),
  });

  const receiverAddress = "0x0000000000000000000000000000000000000002";
  const { baseUrl, close } = await startExpressServer({
    rpcUrl,
    receiverAddress,
    verified: false,
  });

  try {
    const res = await fetch(`${baseUrl}/gated`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-PAYMENT": makePaymentHeader(),
        "X-Wallet-Address": "0x0000000000000000000000000000000000000001",
      },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, "proofs_required");
    assert.ok(Array.isArray(body.requiredClaims));
    assert.equal(body.verificationResult?.isValid, false);
  } finally {
    await close();
    await new Promise((r) => rpcServer.close(r));
  }
});

test("access control: paid request allowed (200) when claims verify", async () => {
  const { server: rpcServer, url: rpcUrl } = await startJsonRpcServer({
    ethCallResultHex: "0x" + "0".repeat(63) + "1",
  });

  const receiverAddress = "0x0000000000000000000000000000000000000002";
  const { baseUrl, close } = await startExpressServer({
    rpcUrl,
    receiverAddress,
    verified: true,
  });

  try {
    const res = await fetch(`${baseUrl}/gated`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-PAYMENT": makePaymentHeader(),
        "X-Wallet-Address": "0x0000000000000000000000000000000000000001",
      },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
  } finally {
    await close();
    await new Promise((r) => rpcServer.close(r));
  }
});

