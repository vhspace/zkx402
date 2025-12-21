import { spawn, execSync } from "child_process";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import net from "net";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

const DEPLOYER_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const PAYER_PRIVATE_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const DEPLOYER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const PAYER_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const RPC_URL = "http://localhost:8545";
const CHAIN_ID = 31337;
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

function ensureContractsSubmodules(repoRoot, contractsDir) {
  const forgeStdDir = path.join(contractsDir, "lib", "forge-std");
  if (fs.existsSync(forgeStdDir)) return;
  execSync("git submodule update --init --recursive", {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

async function checkAnvilRunning() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    await provider.getBlockNumber();
    return true;
  } catch (error) {
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
    let resolved = false;

    anvil.stdout.on("data", (data) => {
      output += data.toString();
      if (output.includes("Listening on")) {
        if (!resolved) {
          resolved = true;
          log(colors.green, `Anvil started (PID: ${anvil.pid})`);
          fs.writeFileSync(
            path.join(__dirname, ".anvil.pid"),
            anvil.pid.toString()
          );
          resolve(anvil);
        }
      }
    });

    anvil.on("error", reject);
    setTimeout(() => {
      if (!output.includes("Listening on")) {
        reject(new Error("Anvil failed to start"));
      }
    }, 10000);
  });
}

async function deployMockUSDC() {
  log(colors.blue, "Deploying MockUSDC...");

  const contractsDir = path.join(__dirname, "..", "contracts");
  const repoRoot = findRepoRoot(__dirname);
  ensureContractsSubmodules(repoRoot, contractsDir);

  try {
    const output = execSync(
      `forge create src/MockUSDC.sol:MockUSDC --rpc-url ${RPC_URL} --private-key ${DEPLOYER_PRIVATE_KEY} --broadcast`,
      { cwd: contractsDir, encoding: "utf-8" }
    );

    const match = output.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
    if (match) {
      const address = match[1];
      log(colors.green, `MockUSDC deployed at: ${address}`);
      return address;
    }
    throw new Error("Could not find deployed address");
  } catch (error) {
    log(colors.red, "Failed to deploy MockUSDC");
    throw error;
  }
}

async function deployMockHumanRegistry() {
  log(colors.blue, "Deploying MockHumanRegistry...");

  const contractsDir = path.join(__dirname, "..", "contracts");
  const repoRoot = findRepoRoot(__dirname);
  ensureContractsSubmodules(repoRoot, contractsDir);

  const output = execSync(
    `forge create src/MockHumanRegistry.sol:MockHumanRegistry --rpc-url ${RPC_URL} --private-key ${DEPLOYER_PRIVATE_KEY} --broadcast --constructor-args ${PAYER_ADDRESS}`,
    { cwd: contractsDir, encoding: "utf-8" }
  );

  const match = output.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
  if (!match) throw new Error("Could not find deployed MockHumanRegistry address");

  const address = match[1];
  log(colors.green, `MockHumanRegistry deployed at: ${address}`);
  return address;
}

async function fundAccounts(usdcAddress) {
  log(colors.blue, "Funding test accounts...");

  try {
    execSync(
      `cast send ${usdcAddress} "mint(address,uint256)" ${PAYER_ADDRESS} 10000000000 --rpc-url ${RPC_URL} --private-key ${DEPLOYER_PRIVATE_KEY}`,
      { encoding: "utf-8", stdio: "ignore" }
    );

    const balance = execSync(
      `cast call ${usdcAddress} "balanceOf(address)(uint256)" ${PAYER_ADDRESS} --rpc-url ${RPC_URL}`,
      { encoding: "utf-8" }
    ).trim();

    log(colors.green, `Test payer funded with ${parseInt(balance) / 1e6} USDC`);
  } catch (error) {
    log(colors.red, "Failed to fund accounts");
    throw error;
  }
}

function createEnvFile(usdcAddress, mockHumanRegistryAddress) {
  log(colors.blue, "Creating .env.local...");

  const envContent = `CHAIN_ID=${CHAIN_ID}
RPC_URL=${RPC_URL}
USDC_ADDRESS=${usdcAddress}
RECEIVER_WALLET=${DEPLOYER_ADDRESS}
RECEIVER_PRIVATE_KEY=${DEPLOYER_PRIVATE_KEY}
PAYER_ADDRESS=${PAYER_ADDRESS}
PAYER_PRIVATE_KEY=${PAYER_PRIVATE_KEY}
PORT=${SERVER_PORT}
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
USE_LOCAL_FACILITATOR=true
ENABLE_PROOF_POLICY=true
SELF_RPC_URL=${RPC_URL}
BASE_PROOF_OF_HUMAN_RECEIVER=${mockHumanRegistryAddress}
`;

  const envPath = path.join(__dirname, "..", "server", ".env.local");
  fs.writeFileSync(envPath, envContent);
  log(colors.green, "Configuration file created");
}

function installDependencies() {
  log(colors.blue, "Checking server dependencies...");
  const serverDir = path.join(__dirname, "..", "server");

  if (!fs.existsSync(path.join(serverDir, "node_modules"))) {
    try {
      execSync("npm install --legacy-peer-deps --ignore-scripts", {
        cwd: serverDir,
        stdio: "ignore",
      });
      log(colors.green, "Dependencies installed");
    } catch (error) {
      log(
        colors.yellow,
        "Warning: Some dependencies may have failed to install"
      );
    }
  } else {
    log(colors.green, "Dependencies already installed");
  }
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
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

    server.stdout.on("data", (data) => {
      const text = data.toString();
      process.stdout.write(text);
      output += text;
      if (!resolved && output.toLowerCase().includes("running on")) {
        resolved = true;
        log(colors.green, "Server started");
        resolve(server);
      }
    });

    server.stderr.on("data", (data) => {
      const text = data.toString();
      process.stderr.write(text);
      output += text;
      if (!resolved && output.toLowerCase().includes("running on")) {
        resolved = true;
        log(colors.green, "Server started");
        resolve(server);
      }
      if (!resolved && output.includes("EADDRINUSE")) {
        resolved = true;
        reject(new Error(`Port ${SERVER_PORT} already in use. Stop the existing server and re-run.`));
      }
    });

    server.on("error", reject);
    server.on("exit", (code) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Server exited before startup (code ${code ?? "unknown"})`));
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error("Server did not start within timeout"));
      }
    }, 5000);
  });
}

async function runTests() {
  log(colors.blue, "\nRunning E2E tests...\n");

  return new Promise((resolve, reject) => {
    const test = spawn("node", ["test-e2e.js"], {
      cwd: __dirname,
      stdio: "inherit",
    });

    test.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Tests failed with code ${code}`));
      }
    });

    test.on("error", reject);
  });
}

async function main() {
  log(colors.blue, "\nComplete E2E Test Runner\n");

  let anvilProcess;
  let serverProcess;
  let startedAnvil = false;

  try {
    try {
      execSync("node teardown.js", { cwd: __dirname, stdio: "ignore" });
    } catch (_) {
      // best-effort cleanup
    }

    log(colors.blue, "Running unit tests (x402-zkx402)...");
    const repoRoot = findRepoRoot(__dirname);
    const unitTestCwd = path.join(repoRoot, "packages", "x402-zkx402");
    execSync("npm test", { cwd: unitTestCwd, stdio: "inherit" });
    log(colors.green, "Unit tests passed.");

    const isRunning = await checkAnvilRunning();
    if (!isRunning) {
      anvilProcess = await startAnvil();
      startedAnvil = true;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } else {
      log(colors.yellow, "Anvil already running");
    }

    const usdcAddress = await deployMockUSDC();
    const mockHumanRegistryAddress = await deployMockHumanRegistry();
    await fundAccounts(usdcAddress);
    createEnvFile(usdcAddress, mockHumanRegistryAddress);
    installDependencies();

    serverProcess = await startServer();
    await new Promise((resolve) => setTimeout(resolve, 3000));

    await runTests();

    log(colors.green, "\nAll tests passed!\n");
    process.exit(0);
  } catch (error) {
    log(colors.red, "\nTest failed:", error.message);
    process.exit(1);
  } finally {
    if (serverProcess) {
      serverProcess.kill();
    }
    if (startedAnvil) {
      try {
        execSync("node teardown.js", { cwd: __dirname, stdio: "ignore" });
      } catch (_) {
        // best-effort
      }
    }
  }
}

main();
