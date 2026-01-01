import express from "express";
import cors from "cors";
import { loadProofPolicyFile, loadProofCostFile, paymentMiddleware } from "x402-zkx402";
import { facilitator } from "@coinbase/x402";
import dotenv from "dotenv";
import { requestFaucet } from "./faucet.js";
import { getTokenBalances } from "./balances.js";
import { createLocalFacilitator } from "../local-chain/local-facilitator.js";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const app = express();
const PORT = process.env.PORT || 3001;
const ENABLE_PROOF_POLICY = process.env.ENABLE_PROOF_POLICY === "true";
const ENABLE_PROOF_COSTS = process.env.ENABLE_PROOF_COSTS === "true";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadProofPolicy() {
  try {
    const p = process.env.PROOF_POLICY_PATH
      ? process.env.PROOF_POLICY_PATH
      : join(__dirname, "proof-policy.json");
    const parsed = loadProofPolicyFile(p);
    return parsed.ok ? parsed.policy : null;
  } catch {
    return null;
  }
}

const PROOF_POLICY = ENABLE_PROOF_POLICY ? loadProofPolicy() : null;

function loadProofCosts() {
  try {
    const p = process.env.PROOF_COSTS_PATH
      ? process.env.PROOF_COSTS_PATH
      : join(__dirname, "proof-costs.json");
    const parsed = loadProofCostFile(p);
    return parsed.ok ? parsed.costs : null;
  } catch {
    return null;
  }
}

const PROOF_COSTS = ENABLE_PROOF_COSTS ? loadProofCosts() : null;

// parse JSON bodies
app.use(express.json());

// wallet address that will receive payments for the API
const RECEIVER_WALLET = process.env.RECEIVER_WALLET || "0xYourWalletAddress";
const USE_LOCAL_FACILITATOR = process.env.USE_LOCAL_FACILITATOR === "true";
const LOCAL_USDC_ADDRESS = process.env.USDC_ADDRESS;
const RECEIVER_PRIVATE_KEY = process.env.RECEIVER_PRIVATE_KEY;

// enable CORS for local development and production
function compileOriginMatchers(raw) {
  if (!raw) return null;

  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;

  const matchers = [];

  for (const p of parts) {
    // Exact origin match
    if (!p.includes("*") && !p.startsWith("re:")) {
      matchers.push((origin) => origin === p);
      continue;
    }

    // Regex match (advanced)
    if (p.startsWith("re:")) {
      const source = p.slice("re:".length);
      const re = new RegExp(source);
      matchers.push((origin) => re.test(origin));
      continue;
    }

    // Wildcard match (simple): turn '*' into '.*' and escape other regex chars.
    const escaped = p
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    const re = new RegExp(`^${escaped}$`);
    matchers.push((origin) => re.test(origin));
  }

  return matchers;
}

const originMatchers = compileOriginMatchers(process.env.ALLOWED_ORIGINS);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser clients / same-origin requests
    if (!origin) return callback(null, true);

    // If explicitly configured, enforce the allow-list
    if (originMatchers) {
      return callback(
        null,
        originMatchers.some((m) => {
          try {
            return m(origin);
          } catch {
            return false;
          }
        })
      );
    }

    // On Vercel, default to allowing cross-origin for the demo unless configured otherwise.
    // (Recommended for production: set ALLOWED_ORIGINS explicitly.)
    if (process.env.VERCEL) {
      return callback(null, true);
    }

    // Local dev defaults
    const localAllowed = ["http://localhost:3000", "http://localhost:3001"];
    return callback(null, localAllowed.includes(origin));
  },
  credentials: true,
  // The x402 flow returns a settlement header that browser clients may want to read.
  // Without this, `fetch(...).headers.get('x-payment-response')` will be null in browsers.
  exposedHeaders: ["X-PAYMENT-RESPONSE"],
};
app.use(cors(corsOptions));

// apply x402 payment middleware
app.use(
  paymentMiddleware(
    RECEIVER_WALLET,
    {
      // configure the x402-enabled endpoint
      "GET /motivate": {
        // price in USDC (0.01 USDC)
        price: "$0.01",
        // using Base Sepolia testnet
        network: "base-sepolia",
        // metadata about the endpoint for better discovery
        config: {
          description: "get a motivational quote to inspire your day",
          asset:
            USE_LOCAL_FACILITATOR && LOCAL_USDC_ADDRESS
              ? LOCAL_USDC_ADDRESS
              : undefined,
          outputSchema: {
            type: "object",
            properties: {
              quote: { type: "string", description: "an inspirational quote" },
              timestamp: {
                type: "string",
                description: "when the quote was generated",
              },
            },
          },
          // zkx402 additions
          extra: {
            variableAmountRequired: [
              {
                requiredClaims: [{ type: "human" }],
                amountRequired: "5000",
              },
              {
                // Example "web proof" tier (vlayer): if the caller can prove origin access,
                // they qualify for a bigger discount. Verification fees (if any) are added
                // on top via `proofCosts`.
                requiredClaims: [{ type: "origin_http_get" }],
                amountRequired: "4000",
              },
            ],
            contentMetadata: [
              { proof: "zkproof(Edward Snowden)" },
              { proof: "zkproof(human)" },
              { proof: "zkproof(origin_http_get)" },
            ],
            ...(PROOF_POLICY ? { proofPolicy: PROOF_POLICY } : {}),
            ...(PROOF_COSTS ? { proofCosts: PROOF_COSTS } : {}),
          },
        },
      },
    },
    USE_LOCAL_FACILITATOR
      ? createLocalFacilitator({
          rpcUrl: process.env.RPC_URL || "http://localhost:8545",
          usdcAddress: LOCAL_USDC_ADDRESS,
          receiverPrivateKey: RECEIVER_PRIVATE_KEY,
        })
      : facilitator
  )
);

// the x402-enabled endpoint - this is ALL the code you need!
app.get("/motivate", (req, res) => {
  // Access verification metadata set by middleware
  const verification = req.verificationMetadata;

  res.json({
    quote:
      "Innovation happens when ideas collide, and blockchain is the perfect collision of technology and finance. --Vitalik Buterin",
    timestamp: new Date().toISOString(),
    paid: true,
    verification: verification
      ? {
          qualified: verification.qualified,
          discountApplied: verification.discountApplied,
          discountedPrice: verification.discountedPrice,
        }
      : null,
  });
});

// Root endpoint - API info
app.get("/", (req, res) => {
  res.json({
    name: "x402 Demo API",
    description: "Simple API demonstrating x402 payments with CDP",
    endpoints: {
      "GET /health": "Health check",
      "GET /balance/:address": "Get USDC balance",
      "POST /faucet": "Request test USDC",
      "GET /motivate": "Get motivational quote (requires 0.01 USDC payment)",
    },
    payment: {
      price: "0.01 USDC",
      network: "base-sepolia",
    },
    github: "https://github.com/vhspace/zkx402",
  });
});

// health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "x402 demo server is running" });
});

// balance endpoint; uses CDP Token Balances API
app.get("/balance/:address", async (req, res) => {
  try {
    const { address } = req.params;

    if (!address) {
      return res.status(400).json({ error: "address required" });
    }

    const apiKeyId = process.env.CDP_API_KEY_ID;
    const privateKey = process.env.CDP_API_KEY_SECRET;

    if (!apiKeyId || !privateKey) {
      return res
        .status(500)
        .json({ error: "server not configured with CDP API credentials" });
    }

    const usdcBalance = await getTokenBalances(
      address,
      "base-sepolia",
      apiKeyId,
      privateKey
    );

    res.json({
      balance: usdcBalance,
      address: address,
      network: "base-sepolia",
      token: "USDC",
    });
  } catch (error) {
    console.error("Balance error:", error);
    res.status(500).json({
      error: error.message || "failed to fetch balance",
    });
  }
});

// Faucet endpoint; uses CDP Faucet API with server's CDP API key
app.post("/faucet", async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ error: "address required" });
    }

    const apiKeyId = process.env.CDP_API_KEY_ID;
    const privateKey = process.env.CDP_API_KEY_SECRET;

    if (!apiKeyId || !privateKey) {
      return res
        .status(500)
        .json({ error: "server not configured with CDP API credentials" });
    }

    console.log(`requesting faucet for address: ${address}`);
    const txHash = await requestFaucet(address, apiKeyId, privateKey);

    console.log(`Faucet successful! Transaction: ${txHash}`);
    res.json({
      success: true,
      transactionHash: txHash,
      message: "USDC will arrive shortly",
    });
  } catch (error) {
    console.error("Faucet error:", error);
    res.status(500).json({
      error: error.message || "Faucet request failed",
      details: "may be hitting rate limits; try again in a few min",
    });
  }
});

// Vercel serverless compatibility + import-safety:
// - Vercel imports this file as a serverless handler (no explicit listen)
// - When imported (tests/tools), do not side-effect by binding a port
const isEntrypoint = (() => {
  try {
    const argvUrl = pathToFileURL(process.argv[1] || "").href;
    return import.meta.url === argvUrl;
  } catch {
    return false;
  }
})();

if (!process.env.VERCEL && isEntrypoint) {
  app.listen(PORT, () => {
    console.log(`x402 demo server running on http://localhost:${PORT}`);
    console.log(`\nEndpoints:`);
    console.log(`   • GET  /health           - health check (public)`);
    console.log(
      `   • GET  /balance/:address - USDC balance via CDP Token Balances API (public)`
    );
    console.log(
      `   • POST /faucet           - request test USDC via CDP Faucet API (public)`
    );
    console.log(
      `   • GET  /motivate         - motivational quote (requires 0.01 USDC payment)`
    );
    console.log(`\nCDP products in use:`);
    console.log(`   • CDP x402 Facilitator - payment verification & settlement`);
    console.log(`   • CDP Faucet API       - test USDC distribution`);
    console.log(`   • CDP Token Balances   - real-time balance checking`);
    console.log(`\nreceiving payments at: ${RECEIVER_WALLET}`);
    console.log(`Price: 0.01 USDC on Base Sepolia`);
  });
}

export default app;
