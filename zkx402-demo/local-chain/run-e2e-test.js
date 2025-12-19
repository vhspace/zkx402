import { spawn, execSync } from "child_process";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

function createEnvFile(usdcAddress) {
  log(colors.blue, "Creating .env.local...");

  const envContent = `CHAIN_ID=${CHAIN_ID}
RPC_URL=${RPC_URL}
USDC_ADDRESS=${usdcAddress}
RECEIVER_WALLET=${DEPLOYER_ADDRESS}
RECEIVER_PRIVATE_KEY=${DEPLOYER_PRIVATE_KEY}
PAYER_ADDRESS=${PAYER_ADDRESS}
PAYER_PRIVATE_KEY=${PAYER_PRIVATE_KEY}
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
USE_LOCAL_FACILITATOR=true
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
      log(colors.yellow, "Warning: Some dependencies may have failed to install");
    }
  } else {
    log(colors.green, "Dependencies already installed");
  }
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
    });

    server.on("error", reject);

    setTimeout(() => {
      if (!resolved) {
        log(colors.yellow, "Server may have started (timeout)");
        resolved = true;
        resolve(server);
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

  try {
    const isRunning = await checkAnvilRunning();
    if (!isRunning) {
      anvilProcess = await startAnvil();
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } else {
      log(colors.yellow, "Anvil already running");
    }

    const usdcAddress = await deployMockUSDC();
    await fundAccounts(usdcAddress);
    createEnvFile(usdcAddress);
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
  }
}

main();




