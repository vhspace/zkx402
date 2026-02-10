#!/usr/bin/env node
/**
 * Start local chain + server for manual client testing.
 * Keeps the server running until Ctrl+C (unlike run-e2e-test.js which runs tests and exits).
 *
 * Usage: node serve.js
 * Then in another terminal: cd ../client-cli && npm start -- --local --endpoint /motivate
 */
import { spawn } from "child_process";
import { execSync } from "child_process";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import net from "net";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const DEPLOYER_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const PAYER_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const RPC_URL = "http://localhost:8545";
const SERVER_PORT = 3001;

function findRepoRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    const pkgJson = path.join(dir, "package.json");
    const packagesDir = path.join(dir, "packages");
    if (fs.existsSync(pkgJson) && fs.existsSync(packagesDir)) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(startDir, "..", "..", "..");
}

async function checkAnvilRunning() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    await provider.getBlockNumber();
    return true;
  } catch {
    return false;
  }
}

function startAnvil() {
  return new Promise((resolve, reject) => {
    log(colors.blue, "Starting Anvil...");
    const anvil = spawn("anvil", ["--host", "0.0.0.0", "--port", "8545"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    anvil.stdout.on("data", (data) => {
      output += data.toString();
      if (output.includes("Listening on")) {
        log(colors.green, `Anvil started (PID: ${anvil.pid})`);
        fs.writeFileSync(path.join(__dirname, ".anvil.pid"), String(anvil.pid));
        resolve(anvil);
      }
    });
    setTimeout(() => {
      if (!output.includes("Listening on")) reject(new Error("Anvil failed to start"));
    }, 10000);
  });
}

async function deployMockUSDC() {
  const contractsDir = path.join(__dirname, "..", "contracts");
  const repoRoot = findRepoRoot(__dirname);
  if (!fs.existsSync(path.join(contractsDir, "lib", "forge-std"))) {
    execSync("git submodule update --init --recursive", { cwd: repoRoot, stdio: "inherit" });
  }
  const output = execSync(
    `forge create src/MockUSDC.sol:MockUSDC --rpc-url ${RPC_URL} --private-key ${DEPLOYER_PRIVATE_KEY} --broadcast`,
    { cwd: contractsDir, encoding: "utf-8" }
  );
  const match = output.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
  if (!match) throw new Error("Could not find MockUSDC address");
  log(colors.green, `MockUSDC deployed at: ${match[1]}`);
  return match[1];
}

async function deployMockHumanRegistry() {
  const contractsDir = path.join(__dirname, "..", "contracts");
  const output = execSync(
    `forge create src/MockHumanRegistry.sol:MockHumanRegistry --rpc-url ${RPC_URL} --private-key ${DEPLOYER_PRIVATE_KEY} --broadcast --constructor-args ${PAYER_ADDRESS}`,
    { cwd: contractsDir, encoding: "utf-8" }
  );
  const match = output.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
  if (!match) throw new Error("Could not find MockHumanRegistry address");
  log(colors.green, `MockHumanRegistry deployed at: ${match[1]}`);
  return match[1];
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",")}}`;
}

function claimHashSha256Hex({ scope, claim }) {
  return `0x${crypto.createHash("sha256").update(stableStringify({ scope, claim })).digest("hex")}`;
}

async function deployVlayerProofRegistry() {
  const contractsDir = path.join(__dirname, "..", "contracts");
  const output = execSync(
    `forge create src/VlayerProofRegistry.sol:VlayerProofRegistry --rpc-url ${RPC_URL} --private-key ${DEPLOYER_PRIVATE_KEY} --broadcast`,
    { cwd: contractsDir, encoding: "utf-8" }
  );
  const match = output.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
  if (!match) throw new Error("Could not find VlayerProofRegistry address");
  log(colors.green, `VlayerProofRegistry deployed at: ${match[1]}`);
  const claimHash = claimHashSha256Hex({ scope: "zkx402", claim: { type: "origin_http_get" } });
  execSync(
    `cast send ${match[1]} "setVerified(address,bytes32,bool)" ${PAYER_ADDRESS} ${claimHash} true --rpc-url ${RPC_URL} --private-key ${DEPLOYER_PRIVATE_KEY}`,
    { stdio: "ignore" }
  );
  log(colors.green, "Seeded vouch_chain attestation for payer");
  return match[1];
}

async function fundAccounts(usdcAddress) {
  execSync(
    `cast send ${usdcAddress} "mint(address,uint256)" ${PAYER_ADDRESS} 10000000000 --rpc-url ${RPC_URL} --private-key ${DEPLOYER_PRIVATE_KEY}`,
    { stdio: "ignore" }
  );
  log(colors.green, "Test payer funded with 10000 USDC");
}

function createEnvFile(usdcAddress, mockHumanRegistryAddress, vouchProofRegistryAddress) {
  const envContent = `CHAIN_ID=31337
RPC_URL=${RPC_URL}
USDC_ADDRESS=${usdcAddress}
RECEIVER_WALLET=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
RECEIVER_PRIVATE_KEY=${DEPLOYER_PRIVATE_KEY}
PAYER_ADDRESS=${PAYER_ADDRESS}
PAYER_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
PORT=${SERVER_PORT}
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
USE_LOCAL_FACILITATOR=true
ENABLE_PROOF_POLICY=true
SELF_RPC_URL=${RPC_URL}
BASE_PROOF_OF_HUMAN_RECEIVER=${mockHumanRegistryAddress}
VOUCH_RPC_URL=${RPC_URL}
VOUCH_PROOF_REGISTRY=${vouchProofRegistryAddress}
`;
  const envPath = path.join(__dirname, "..", "server", ".env.local");
  fs.writeFileSync(envPath, envContent);
  log(colors.green, "Configuration file created");
}

function startServer() {
  return new Promise((resolve, reject) => {
    log(colors.blue, "Starting server...");
    const serverDir = path.join(__dirname, "..", "server");
    const server = spawn("node", ["index.js"], {
      cwd: serverDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "development" },
    });
    let output = "";
    let resolved = false;
    const onData = (data) => {
      output += data.toString();
      process.stdout.write(data);
      if (!resolved && output.toLowerCase().includes("running on")) {
        resolved = true;
        log(colors.green, "\nServer started. Press Ctrl+C to stop.");
        resolve(server);
      }
    };
    server.stdout.on("data", onData);
    server.stderr.on("data", onData);
    server.on("exit", (code) => {
      if (code !== 0 && code !== null) reject(new Error(`Server exited: ${code}`));
    });
    setTimeout(() => reject(new Error("Server timeout")), 8000);
  });
}

async function main() {
  log(colors.blue, "\nzkx402 local serve (chain + server)\n");

  try {
    execSync("node teardown.js", { cwd: __dirname, stdio: "ignore" });
  } catch {
    /* best-effort cleanup */
  }

  const isRunning = await checkAnvilRunning();
  let anvilProcess;
  if (!isRunning) {
    anvilProcess = await startAnvil();
    await new Promise((r) => setTimeout(r, 2000));
  } else {
    log(colors.yellow, "Anvil already running");
  }

  const usdcAddress = await deployMockUSDC();
  const mockHumanRegistryAddress = await deployMockHumanRegistry();
  const vouchProofRegistryAddress = await deployVlayerProofRegistry();
  await fundAccounts(usdcAddress);
  createEnvFile(usdcAddress, mockHumanRegistryAddress, vouchProofRegistryAddress);

  const serverDir = path.join(__dirname, "..", "server");
  if (!fs.existsSync(path.join(serverDir, "node_modules"))) {
    execSync("npm install --legacy-peer-deps --ignore-scripts", { cwd: serverDir, stdio: "ignore" });
  }

  const serverProcess = await startServer();
  await new Promise((r) => setTimeout(r, 500));

  log(colors.cyan, "\nIn another terminal:");
  log(colors.yellow, "  cd apps/demo/client-cli && npm start -- --local --endpoint /motivate");
  log(colors.cyan, "\nServer URL: http://localhost:3001");

  const cleanup = () => {
    serverProcess.kill();
    if (anvilProcess) anvilProcess.kill();
    try {
      execSync("node teardown.js", { cwd: __dirname, stdio: "ignore" });
    } catch {
      /* ignore */
    }
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

main().catch((err) => {
  log(colors.red, err.message);
  process.exit(1);
});
