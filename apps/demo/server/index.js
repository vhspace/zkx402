import express from "express";
import cors from "cors";
import { facilitator } from "@coinbase/x402";
import dotenv from "dotenv";
import { requestFaucet } from "./faucet.js";
import { getTokenBalances } from "./balances.js";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";
import { randomUUID } from "crypto";
import { createLogger } from "./logger.js";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const app = express();
const PORT = process.env.PORT || 3001;
const ENABLE_PROOF_POLICY = process.env.ENABLE_PROOF_POLICY === "true";
const ENABLE_PROOF_COSTS = process.env.ENABLE_PROOF_COSTS === "true";
const logger = createLogger({ service: "x402-demo-server" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function txExplorerUrl(network, txHash) {
  if (!txHash || typeof txHash !== "string") return null;
  if (network === "base-sepolia" || network === "eip155:84532") {
    return `https://sepolia.basescan.org/tx/${txHash}`;
  }
  if (network === "base" || network === "eip155:8453") {
    return `https://basescan.org/tx/${txHash}`;
  }
  return null;
}

// IMPORTANT:
// - In CI/local dev, the monorepo contains `packages/x402-zkx402`, so import it directly
//   to ensure the demo server uses the latest middleware behavior (incl. access control).
// - In Vercel serverless deployments, the project root is `apps/demo/server`, so the monorepo
//   package is not present. In that environment we fall back to the vendored copy.
const { loadProofPolicyFile, loadProofCostFile, paymentMiddleware } =
  await (process.env.VERCEL
    ? import("./vendor/x402-zkx402/src/index.js")
    : import("../../../packages/x402-zkx402/src/index.js"));
const { getRoutesFromConfig } = await import("./load-route-config.js");

function loadProofPolicy() {
  try {
    const p = process.env.PROOF_POLICY_PATH
      ? process.env.PROOF_POLICY_PATH
      : join(__dirname, "proof-policy.json");
    const parsed = loadProofPolicyFile(p);
    return parsed.ok ? parsed.policy : null;
  } catch (error) {
    logger.warn("proof_policy_load_failed", { err: error });
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
  } catch (error) {
    logger.warn("proof_costs_load_failed", { err: error });
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

// The local-chain facilitator is for local development only and is not shipped in the
// Vercel serverless bundle (apps/demo/server deploys independently). Import it lazily.
const require = createRequire(import.meta.url);
const maybeCreateLocalFacilitator = (() => {
  if (!USE_LOCAL_FACILITATOR) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("../local-chain/local-facilitator.js");
    return mod?.createLocalFacilitator ?? null;
  } catch (e) {
    logger.warn("local_facilitator_not_found_fallback_hosted", {
      error: e?.message || String(e),
    });
    return null;
  }
})();

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

// Route config: JSON file (ROUTE_CONFIG_PATH or ./routes.json) or in-code fallback
const assetForRoutes =
  USE_LOCAL_FACILITATOR && LOCAL_USDC_ADDRESS ? LOCAL_USDC_ADDRESS : undefined;
let ROUTES = getRoutesFromConfig({
  proofPolicy: PROOF_POLICY,
  proofCosts: PROOF_COSTS,
  asset: assetForRoutes,
});
if (!ROUTES) {
  // In-code fallback
  ROUTES = {
    "GET /motivate": {
      price: "$0.01",
      network: "base-sepolia",
      config: {
        description: "get a motivational quote to inspire your day",
        asset: assetForRoutes,
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
        extra: {
          variableAmountRequired: [
            { requiredClaims: [{ type: "human" }], amountRequired: "5000" },
            {
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
    ...(PROOF_POLICY
      ? {
          "GET /motivate-gated": {
            price: "$0.01",
            network: "base-sepolia",
            config: {
              description:
                "motivational quote (requires payment + verified human proof)",
              asset: assetForRoutes,
              outputSchema: {
                type: "object",
                properties: {
                  quote: { type: "string" },
                  timestamp: { type: "string" },
                },
              },
              extra: {
                requiredClaims: [{ type: "human" }],
                proofPolicy: PROOF_POLICY,
                ...(PROOF_COSTS ? { proofCosts: PROOF_COSTS } : {}),
              },
            },
          },
        }
      : {}),
  };
} else if (!PROOF_POLICY) {
  // JSON config: omit motivate-gated when proof policy not loaded
  delete ROUTES["GET /motivate-gated"];
}

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
        }),
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

// Per-request correlation IDs and request lifecycle logs (JSON, logstash-friendly).
app.use((req, res, next) => {
  const requestId = req.header("x-request-id") || randomUUID();
  const correlationId = req.header("x-correlation-id") || requestId;
  const startedAt = Date.now();

  req.requestId = requestId;
  req.correlationId = correlationId;
  req.log = logger.child({
    request_id: requestId,
    correlation_id: correlationId,
    method: req.method,
    path: req.originalUrl || req.url,
  });

  res.setHeader("x-request-id", requestId);
  res.setHeader("x-correlation-id", correlationId);

  req.log.info("http_request_started");
  res.on("finish", () => {
    req.log.info("http_request_completed", {
      status_code: res.statusCode,
      duration_ms: Date.now() - startedAt,
    });
  });

  next();
});

// apply x402 payment middleware (routes from JSON or in-code fallback)
app.use(
  paymentMiddleware(
    RECEIVER_WALLET,
    ROUTES,
    USE_LOCAL_FACILITATOR
      ? maybeCreateLocalFacilitator
        ? maybeCreateLocalFacilitator({
            rpcUrl: process.env.RPC_URL || "http://localhost:8545",
            usdcAddress: LOCAL_USDC_ADDRESS,
            receiverPrivateKey: RECEIVER_PRIVATE_KEY,
          })
        : facilitator
      : facilitator,
  ),
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

// Hard-gated endpoint example (requires verified proofs; see middleware config above)
app.get("/motivate-gated", (req, res) => {
  res.json({
    quote: "The best way to predict the future is to invent it. --Alan Kay",
    timestamp: new Date().toISOString(),
    paid: true,
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
      ...(PROOF_POLICY
        ? {
            "GET /motivate-gated":
              "Get motivational quote (requires payment + verified human proof)",
          }
        : {}),
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

    // E2E/Preview mode: make the demo deterministic even when the server isn't configured
    // with CDP credentials (e.g. preview deployments in CI).
    if (process.env.E2E_FAUCET_MOCK === "true") {
      return res.json({
        balance: 1.0,
        address,
        network: "base-sepolia",
        token: "USDC",
        mocked: true,
      });
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
      privateKey,
    );

    res.json({
      balance: usdcBalance,
      address: address,
      network: "base-sepolia",
      token: "USDC",
    });
  } catch (error) {
    (req.log || logger).error("balance_request_failed", { err: error });
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

    // E2E/Preview mode: return a deterministic success response without hitting CDP.
    if (process.env.E2E_FAUCET_MOCK === "true") {
      return res.json({
        success: true,
        transactionHash: "0xE2E_FAUCET_MOCK",
        message: "USDC will arrive shortly (mocked)",
        mocked: true,
      });
    }

    const apiKeyId = process.env.CDP_API_KEY_ID;
    const privateKey = process.env.CDP_API_KEY_SECRET;

    if (!apiKeyId || !privateKey) {
      return res
        .status(500)
        .json({ error: "server not configured with CDP API credentials" });
    }

    (req.log || logger).info("faucet_requested", { address });
    const txHash = await requestFaucet(address, apiKeyId, privateKey);

    (req.log || logger).info("faucet_succeeded", {
      address,
      transaction: txHash,
      network: "base-sepolia",
      explorer_url: txExplorerUrl("base-sepolia", txHash),
    });
    res.json({
      success: true,
      transactionHash: txHash,
      message: "USDC will arrive shortly",
    });
  } catch (error) {
    (req.log || logger).error("faucet_request_failed", { err: error });
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
    logger.info("server_started", {
      url: `http://localhost:${PORT}`,
      receiver_wallet: RECEIVER_WALLET,
      price: "0.01 USDC",
      network: "base-sepolia",
      proof_policy_enabled: Boolean(PROOF_POLICY),
      endpoints: PROOF_POLICY
        ? ["/health", "/balance/:address", "/faucet", "/motivate", "/motivate-gated"]
        : ["/health", "/balance/:address", "/faucet", "/motivate"],
    });
  });
}

export default app;
