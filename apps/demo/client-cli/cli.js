#!/usr/bin/env node
/**
 * Text-based x402 client for real testing with Self and vouch proofs.
 *
 * Usage:
 *   node cli.js [options]
 *   node cli.js --local --endpoint /motivate
 *   node cli.js --server http://localhost:3001 --verify-self --popup-qr
 *
 * Options:
 *   --local              Use local-chain (SERVER_URL, RPC_URL from .env.local)
 *   --server <url>       Server URL (default: SHELL or localhost:3001)
 *   --endpoint <path>    /motivate or /motivate-gated
 *   --verify-self       Show Self QR before request (for human proof)
 *   --popup-qr           Open QR in system image viewer (default: terminal)
 *   --claims <json>      X-Proof-Claims (default: [{"type":"human"}])
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import dotenv from "dotenv";
import { ethers } from "ethers";
import fetch from "node-fetch";
import QRCode from "qrcode";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from client-cli, server, or local-chain
dotenv.config({ path: join(__dirname, ".env") });
dotenv.config({ path: join(__dirname, "../server/.env.local"), override: true });
dotenv.config({ path: join(__dirname, "../local-chain/.env.local"), override: true });

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    local: false,
    server: process.env.SERVER_URL || "http://localhost:3001",
    endpoint: "/motivate",
    verifySelf: false,
    popupQr: false,
    claims: [{ type: "human" }],
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--local") opts.local = true;
    else if (args[i] === "--server" && args[i + 1]) opts.server = args[++i];
    else if (args[i] === "--endpoint" && args[i + 1]) opts.endpoint = args[++i];
    else if (args[i] === "--verify-self") opts.verifySelf = true;
    else if (args[i] === "--popup-qr") opts.popupQr = true;
    else if (args[i] === "--claims" && args[i + 1]) {
      opts.claims = JSON.parse(args[++i]);
    }
  }
  return opts;
}

function getRequirementAmount(requirement) {
  return requirement?.amount ?? requirement?.maxAmountRequired ?? requirement?.value;
}

async function showSelfQR(walletAddress, popupQr) {
  const CELO_BRIDGE =
    process.env.CELO_BRIDGE_ADDRESS ||
    process.env.NEXT_PUBLIC_CELO_BRIDGE_ADDRESS ||
    "0x38d415034f8479545d9b4f227c9f9140aca1b765";

  let SelfAppBuilder;
  let getUniversalLink;
  try {
    const qrcodeMod = await import("@selfxyz/qrcode");
    const coreMod = await import("@selfxyz/core");
    SelfAppBuilder = qrcodeMod.SelfAppBuilder;
    getUniversalLink = coreMod.getUniversalLink;
  } catch (e) {
    log(colors.red, "Missing @selfxyz/qrcode or @selfxyz/core. Run: npm install");
    process.exit(1);
  }

  const userId = (walletAddress || ethers.ZeroAddress).toLowerCase();
  const endpoint = CELO_BRIDGE.toLowerCase();

  const app = new SelfAppBuilder({
    version: 2,
    appName: "zkx402 CLI",
    scope: "zkx402",
    endpoint,
    logoBase64: "https://i.postimg.cc/mrmVf9hm/self.png",
    userId,
    endpointType: "staging_celo",
    userIdType: "hex",
    userDefinedData: "zkx402 verification",
    disclosures: {
      minimumAge: 18,
      excludedCountries: [],
      nationality: false,
    },
  }).build();

  const url = getUniversalLink(app);

  log(colors.blue, "\n--- Self verification QR ---");
  log(colors.cyan, "Scan with Self app on your phone to verify as human.");
  log(colors.cyan, "Scope: zkx402 | Endpoint: Celo bridge");

  if (popupQr) {
    const tmpDir = mkdtempSync(join(tmpdir(), "zkx402-qr-"));
    const qrPath = join(tmpDir, "self-qr.png");
    await QRCode.toFile(qrPath, url, { width: 400, margin: 2 });
    log(colors.green, `QR saved to ${qrPath}`);
    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    spawn(cmd, [qrPath], { detached: true, stdio: "ignore" }).unref();
    log(colors.yellow, "Press Enter after scanning...");
  } else {
    const qrTerminal = await QRCode.toString(url, {
      type: "terminal",
      small: true,
      margin: 1,
    });
    console.log(qrTerminal);
    log(colors.yellow, "Press Enter after scanning...");
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question("", () => {
      rl.close();
      resolve();
    });
  });
}

async function run(opts) {
  const serverUrl = opts.server.replace(/\/$/, "");
  const endpoint = opts.endpoint.startsWith("/") ? opts.endpoint : `/${opts.endpoint}`;
  const url = `${serverUrl}${endpoint}`;

  const rpcUrl = process.env.RPC_URL || (opts.local ? "http://localhost:8545" : "https://sepolia.base.org");
  const payerPrivateKey = process.env.PAYER_PRIVATE_KEY;
  const payerAddress = process.env.PAYER_ADDRESS;

  if (!payerPrivateKey || !payerAddress) {
    log(colors.red, "Missing PAYER_PRIVATE_KEY or PAYER_ADDRESS");
    log(colors.yellow, "Copy from apps/demo/local-chain/.env.local after running: cd local-chain && node run-e2e-test.js");
    process.exit(1);
  }

  log(colors.blue, "\n--- zkx402 text client ---");
  log(colors.cyan, `Server: ${serverUrl}`);
  log(colors.cyan, `Endpoint: ${endpoint}`);
  log(colors.cyan, `Wallet: ${payerAddress}`);

  if (opts.verifySelf) {
    await showSelfQR(payerAddress, opts.popupQr);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(payerPrivateKey, provider);

  const headers = {
    Accept: "application/json",
    "X-Wallet-Address": payerAddress,
    "X-Proof-Claims": JSON.stringify(opts.claims),
  };

  log(colors.blue, "\nStep 1: Request (quote mode)");
  const initialRes = await fetch(url, { method: "GET", headers });
  if (initialRes.status !== 402) {
    log(colors.red, `Expected 402, got ${initialRes.status}`);
    const text = await initialRes.text();
    log(colors.yellow, text.slice(0, 500));
    process.exit(1);
  }

  const paymentReqs = await initialRes.json();
  const accepts = paymentReqs.accepts || paymentReqs.acceptsList;
  if (!accepts || accepts.length === 0) {
    log(colors.red, "No accepts in 402 response");
    process.exit(1);
  }

  const requirement = accepts[0];
  const maxAmount = getRequirementAmount(requirement);
  const { payTo, asset, network, maxTimeoutSeconds } = requirement;

  log(colors.green, `  Received 402`);
  log(colors.cyan, `  Amount: ${ethers.formatUnits(maxAmount, 6)} USDC`);
  log(colors.cyan, `  PayTo: ${payTo}`);

  const chainId = (await provider.getNetwork()).chainId;
  const validAfter = 0;
  const validBefore = Math.floor(Date.now() / 1000) + (maxTimeoutSeconds || 300);
  const nonce = ethers.hexlify(ethers.randomBytes(32));

  const extra = requirement.extra || {};
  const domain = {
    name: extra.name || "USD Coin",
    version: extra.version || "2",
    chainId: Number(chainId),
    verifyingContract: asset || requirement.asset || payTo,
  };

  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };

  const authorization = {
    from: payerAddress,
    to: payTo,
    value: maxAmount,
    validAfter,
    validBefore,
    nonce,
  };

  log(colors.blue, "\nStep 2: Sign payment");
  const signature = await wallet.signTypedData(domain, types, authorization);

  const networkId = network || `eip155:${chainId}`;
  const paymentHeader = Buffer.from(
    JSON.stringify({
      x402Version: 1,
      scheme: "exact",
      network: networkId,
      payload: {
        signature,
        authorization: {
          from: authorization.from,
          to: authorization.to,
          value: String(authorization.value),
          validAfter: String(authorization.validAfter),
          validBefore: String(authorization.validBefore),
          nonce: authorization.nonce,
        },
      },
    })
  ).toString("base64");

  log(colors.blue, "\nStep 3: Request with payment");
  const paidRes = await fetch(url, {
    method: "GET",
    headers: {
      ...headers,
      "X-PAYMENT": paymentHeader,
    },
  });

  if (paidRes.status === 403) {
    const body = await paidRes.json();
    log(colors.red, `  403: ${body.error || "forbidden"}`);
    if (body.reason) log(colors.yellow, `  Reason: ${body.reason}`);
    if (!opts.verifySelf && opts.endpoint.includes("gated")) {
      log(colors.yellow, "\n  Tip: Use --verify-self to show Self QR and verify as human first.");
    }
    process.exit(1);
  }

  if (paidRes.status !== 200) {
    log(colors.red, `  Expected 200, got ${paidRes.status}`);
    process.exit(1);
  }

  const body = await paidRes.json();
  log(colors.green, "  Success!");
  console.log(JSON.stringify(body, null, 2));
}

const opts = parseArgs();
run(opts).catch((err) => {
  log(colors.red, err.message || err);
  process.exit(1);
});
