import { spawn } from "child_process";
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

const MOCK_USDC_ABI = [
  "constructor()",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function faucet()",
];

const MOCK_USDC_BYTECODE =
  "0x60806040523480156200001157600080fd5b506040518060400160405280600981526020017f4d6f636b2055534443000000000000000000000000000000000000000000000081525060405180604001604052806004815260200163155394d160e21b815250816003908162000075919062000279565b50600462000084828262000279565b5050506006600590556200009f33600554620000ac60201b60201c565b506200034592505050565b6001600160a01b038216620001075760405162461bcd60e51b815260206004820152601f60248201527f45524332303a206d696e7420746f20746865207a65726f206164647265737300604482015260640160405180910390fd5b80600260008282546200011b919062000345565b90915550506001600160a01b038216600090815260208190526040812080548392906200014a90849062000345565b90915550506040518181526001600160a01b038316906000907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9060200160405180910390a35050565b634e487b7160e01b600052604160045260246000fd5b600181811c90821680620001bf57607f821691505b602082108103620001e057634e487b7160e01b600052602260045260246000fd5b50919050565b601f8211156200022e57600081815260208120601f850160051c810160208610156200020f5750805b601f850160051c820191505b8181101562000230578281556001016200021b565b505b505050565b81516001600160401b0381111562000253576200025362000194565b6200026b81620002648454620001aa565b84620001e6565b602080601f831160018114620002a357600084156200028a5750858301515b600019600386901b1c1916600185901b17855562000230565b600085815260208120601f198616915b82811015620002d457888601518255948401946001909101908401620002b3565b5085821015620002f35787850151600019600388901b60f8161c191681555b5050505050600190811b01905550565b634e487b7160e01b600052601160045260246000fd5b600181815b808511156200035a57816000190482111562000346576200034662000303565b808516156200035457918102915b93841c93908002906200031e565b509250929050565b600082620003735750600162000407565b81620003825750600062000407565b81600181146200039b5760028114620003a657620003c6565b600191505062000407565b60ff841115620003ba57620003ba62000303565b50506001821b62000407565b5060208310610133831016604e8410600b8410161715620003eb575081810a62000407565b620003f7838362000319565b80600019048211156200040e576200040e62000303565b029392505050565b60006200042560ff84168362000362565b9392505050565b610a95806200043c6000396000f3fe608060405234801561001057600080fd5b50600436106100cf5760003560e01c806342966c681161008c57806395d89b411161006657806395d89b4114610196578063a9059cbb1461019e578063dd62ed3e146101b1578063f6a74ed7146101ea57600080fd5b806342966c681461014d57806370a08231146101605780637bbf0aed1461018957600080fd5b806306fdde03146100d4578063095ea7b3146100f257806318160ddd1461011557806323b872dd14610127578063313ce5671461013a5780633950935114610149575b600080fd5b6100dc6101fd565b6040516100e9919061089f565b60405180910390f35b610105610100366004610909565b61028f565b60405190151581526020016100e9565b6002545b6040519081526020016100e9565b610105610135366004610933565b6102a9565b600554604051601281526020016100e9565b61015b565b61015b61015b36600461096f565b6102cd565b61011961016e36600461096f565b6001600160a01b031660009081526020819052604090205490565b61015b6101973660046109a2565b6102ec565b6100dc610344565b6101056101ac366004610909565b610353565b6101196101bf3660046109d5565b6001600160a01b03918216600090815260016020908152604080832093909416825291909152205490565b61015b6101f8366004610909565b610361565b60606003805461020c90610a08565b80601f016020809104026020016040519081016040528092919081815260200182805461023890610a08565b80156102855780601f1061025a57610100808354040283529160200191610285565b820191906000526020600020905b81548152906001019060200180831161026857829003601f168201915b5050505050905090565b60003361029d81858561037e565b60019150505b92915050565b6000336102b78582856104a2565b6102c285858561051c565b506001949350505050565b60003361029d8185856102e083836101bf565b6102ea9190610a42565b61037e565b60055460006102fc906012610b37565b61030790600a610c3c565b61031990670de0b6b3a7640000610c48565b6103239190610c5f565b90506103333382600554610377565b506005545b600019019081610347575050565b60606004805461020c90610a08565b60003361029d81858561051c565b600554600061037290601290610377565b505050565b6103848383836106ca565b505050565b6001600160a01b0383166103e05760405162461bcd60e51b8152602060048201526024808201527f45524332303a20617070726f76652066726f6d20746865207a65726f206164646044820152637265737360e01b60648201526084015b60405180910390fd5b6001600160a01b0382166104415760405162461bcd60e51b815260206004820152602260248201527f45524332303a20617070726f766520746f20746865207a65726f206164647265604482015261737360f01b60648201526084016103d7565b6001600160a01b0383811660008181526001602090815260408083209487168084529482529182902085905590518481527f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925910160405180910390a3505050565b60006104ae84846101bf565b90506000198114610516578181101561050957604051";
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

    const anvil = spawn(
      "anvil",
      [
        "--host",
        "0.0.0.0",
        "--port",
        "8545",
        "--chain-id",
        CHAIN_ID.toString(),
        "--block-time",
        "1",
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let output = "";

    anvil.stdout.on("data", (data) => {
      output += data.toString();
      if (output.includes("Listening on")) {
        log(colors.green, `Anvil started (PID: ${anvil.pid})`);
        fs.writeFileSync(
          path.join(__dirname, ".anvil.pid"),
          anvil.pid.toString()
        );
        resolve(anvil);
      }
    });

    anvil.stderr.on("data", (data) => {
      console.error(data.toString());
    });

    anvil.on("error", (error) => {
      reject(error);
    });

    setTimeout(() => {
      if (!output.includes("Listening on")) {
        reject(new Error("Anvil failed to start within 10 seconds"));
      }
    }, 10000);
  });
}

async function deployMockUSDC(provider, deployerWallet) {
  log(colors.blue, "Deploying MockUSDC...");

  const factory = new ethers.ContractFactory(
    MOCK_USDC_ABI,
    MOCK_USDC_BYTECODE,
    deployerWallet
  );

  try {
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    log(colors.green, `MockUSDC deployed at: ${address}`);

    return address;
  } catch (error) {
    log(colors.yellow, "Direct deployment failed, trying forge script...");

    const { execSync } = await import("child_process");
    const contractsDir = path.join(__dirname, "..", "contracts");

    try {
      const output = execSync(
        `PRIVATE_KEY=${DEPLOYER_PRIVATE_KEY} forge script script/DeployMockUSDC.s.sol:DeployMockUSDC --rpc-url ${RPC_URL} --broadcast`,
        { cwd: contractsDir, encoding: "utf-8" }
      );

      const match = output.match(/MockUSDC deployed at: (0x[a-fA-F0-9]{40})/);
      if (match) {
        const address = match[1];
        log(colors.green, `MockUSDC deployed at: ${address}`);
        return address;
      }
    } catch (forgeError) {
      log(colors.red, "Forge deployment also failed");
      throw forgeError;
    }

    throw error;
  }
}

async function fundAccounts(usdcAddress, deployerWallet) {
  log(colors.blue, "Funding test accounts...");

  const usdc = new ethers.Contract(usdcAddress, MOCK_USDC_ABI, deployerWallet);

  const mintAmount = ethers.parseUnits("10000", 6);
  const tx = await usdc.mint(PAYER_ADDRESS, mintAmount);
  await tx.wait();

  const balance = await usdc.balanceOf(PAYER_ADDRESS);
  log(
    colors.green,
    `Test payer funded with ${ethers.formatUnits(balance, 6)} USDC`
  );

  return balance;
}

function createEnvFile(usdcAddress) {
  log(colors.blue, "Creating configuration file...");

  const envContent = `# Local chain configuration for x402 testing
# Generated by setup.js

# Chain Configuration
CHAIN_ID=${CHAIN_ID}
RPC_URL=${RPC_URL}

# Mock USDC Token
USDC_ADDRESS=${usdcAddress}

# Test Accounts
RECEIVER_WALLET=${DEPLOYER_ADDRESS}
RECEIVER_PRIVATE_KEY=${DEPLOYER_PRIVATE_KEY}

PAYER_ADDRESS=${PAYER_ADDRESS}
PAYER_PRIVATE_KEY=${PAYER_PRIVATE_KEY}

# Server Configuration
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Local facilitator (mock)
USE_LOCAL_FACILITATOR=true
`;

  const envPath = path.join(__dirname, "..", "server", ".env.local");
  fs.writeFileSync(envPath, envContent);

  log(colors.green, `Created configuration file: ${envPath}`);
}

async function main() {
  log(colors.blue, "\nSetting up local chain for x402 testing...\n");

  log(colors.blue, "Test Accounts:");
  log(colors.green, `  Deployer/Receiver: ${DEPLOYER_ADDRESS}`);
  log(colors.green, `  Test Payer:        ${PAYER_ADDRESS}`);
  console.log("");

  const isRunning = await checkAnvilRunning();
  if (isRunning) {
    log(colors.yellow, "Anvil is already running on port 8545");
    log(colors.yellow, "Using existing Anvil instance");
    console.log("");
  } else {
    try {
      await startAnvil();
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      log(colors.red, "Failed to start Anvil:", error.message);
      process.exit(1);
    }
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const deployerWallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);

  let usdcAddress;
  try {
    usdcAddress = await deployMockUSDC(provider, deployerWallet);
  } catch (error) {
    log(colors.red, "Failed to deploy MockUSDC:", error.message);
    process.exit(1);
  }

  try {
    await fundAccounts(usdcAddress, deployerWallet);
  } catch (error) {
    log(colors.red, "Failed to fund accounts:", error.message);
    process.exit(1);
  }

  createEnvFile(usdcAddress);

  log(colors.green, "\nLocal chain setup complete!\n");
  log(colors.blue, "Summary:");
  log(colors.green, `  Chain ID:          ${CHAIN_ID}`);
  log(colors.green, `  RPC URL:           ${RPC_URL}`);
  log(colors.green, `  MockUSDC:          ${usdcAddress}`);
  log(colors.green, `  Receiver Wallet:   ${DEPLOYER_ADDRESS}`);
  log(colors.green, `  Test Payer:        ${PAYER_ADDRESS}`);
  console.log("");
  log(colors.blue, "Next steps:");
  log(colors.yellow, "  1. Start the x402 server: pnpm run dev:server");
  log(colors.yellow, "  2. Run E2E tests: pnpm --dir apps/demo/local-chain run test");
  console.log("");
}

process.on("SIGINT", () => {
  log(colors.yellow, "\nSetup interrupted");
  process.exit(0);
});

main()
  .then(() => process.exit(0))
  .catch((error) => {
    log(colors.red, "\nSetup failed:", error.message);
    console.error(error);
    process.exit(1);
  });
