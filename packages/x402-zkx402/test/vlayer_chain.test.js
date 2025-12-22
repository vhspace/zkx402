import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { createVlayerChainProvider } from "../src/proofs/providers/vlayer_chain.js";
import { ClaimType } from "../src/proofs/claims.js";

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

test("vlayer_chain: not configured without registryAddress", async () => {
  const provider = createVlayerChainProvider({ rpcUrl: "http://127.0.0.1:1" });
  const res = await provider.verifyOriginHttpGet({
    walletAddress: "0x0000000000000000000000000000000000000001",
    claim: { type: ClaimType.ORIGIN_HTTP_GET, url: "https://example.com" },
    policy: { scope: "zkx402" },
  });
  assert.equal(res.ok, false);
  assert.equal(res.status, "not_configured");
});

test("vlayer_chain: not configured without rpcUrl", async () => {
  const provider = createVlayerChainProvider({
    registryAddress: "0x0000000000000000000000000000000000000002",
  });
  const res = await provider.verifyOriginHttpGet({
    walletAddress: "0x0000000000000000000000000000000000000001",
    claim: { type: ClaimType.ORIGIN_HTTP_GET, url: "https://example.com" },
    policy: { scope: "zkx402" },
  });
  assert.equal(res.ok, false);
  assert.equal(res.status, "not_configured");
});

test("vlayer_chain: invalid input without walletAddress", async () => {
  const provider = createVlayerChainProvider({
    rpcUrl: "http://127.0.0.1:1",
    registryAddress: "0x0000000000000000000000000000000000000002",
  });
  const res = await provider.verifyOriginHttpGet({
    walletAddress: "",
    claim: { type: ClaimType.ORIGIN_HTTP_GET, url: "https://example.com" },
    policy: { scope: "zkx402" },
  });
  assert.equal(res.ok, false);
  assert.equal(res.status, "invalid_input");
});

test("vlayer_chain: verified=true when eth_call returns 1", async () => {
  const { server, url } = await startJsonRpcServer({
    ethCallResultHex: "0x" + "0".repeat(63) + "1",
  });

  try {
    const provider = createVlayerChainProvider({
      rpcUrl: url,
      registryAddress: "0x0000000000000000000000000000000000000002",
    });

    const res = await provider.verifyOriginHttpGet({
      walletAddress: "0x0000000000000000000000000000000000000001",
      claim: { type: ClaimType.ORIGIN_HTTP_GET, url: "https://example.com" },
      policy: { scope: "zkx402" },
    });
    assert.equal(res.ok, true);
    assert.equal(res.verified, true);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("vlayer_chain: verified=false when eth_call returns 0", async () => {
  const { server, url } = await startJsonRpcServer({
    ethCallResultHex: "0x" + "0".repeat(64),
  });

  try {
    const provider = createVlayerChainProvider({
      rpcUrl: url,
      registryAddress: "0x0000000000000000000000000000000000000002",
    });

    const res = await provider.verifyOriginHttpGet({
      walletAddress: "0x0000000000000000000000000000000000000001",
      claim: { type: ClaimType.ORIGIN_HTTP_GET, url: "https://example.com" },
      policy: { scope: "zkx402" },
    });
    assert.equal(res.ok, true);
    assert.equal(res.verified, false);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

