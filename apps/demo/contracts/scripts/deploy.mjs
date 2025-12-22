import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadDotenvFile, parseDeployedAddress, upsertDotenvKey } from "./lib.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contractsDir = path.resolve(__dirname, "..");
const envPath = path.join(contractsDir, ".env");

function runCapture(cmd, args, { cwd, env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (d) => {
      const s = d.toString();
      process.stdout.write(s);
      out += s;
    });
    child.stderr.on("data", (d) => {
      const s = d.toString();
      process.stderr.write(s);
      out += s;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve(out);
      reject(new Error(`${cmd} failed (exit ${code})`));
    });
  });
}

function parseArgs(argv) {
  const out = { verify: undefined, configureTrustedSender: undefined, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--verify") out.verify = true;
    else if (a === "--no-verify") out.verify = false;
    else if (a === "--configure-trusted-sender") out.configureTrustedSender = true;
    else if (a === "--dry-run") out.dryRun = true;
  }
  return out;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  // Load .env into process.env only if missing (do not overwrite exported env vars)
  const fileEnv = loadDotenvFile(envPath);
  for (const [k, v] of Object.entries(fileEnv)) {
    if (process.env[k] == null) process.env[k] = v;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (!process.env.PRIVATE_KEY) {
      const pk = (await rl.question("PRIVATE_KEY (hex) [required]: ")).trim();
      if (!pk) throw new Error("PRIVATE_KEY is required");
      process.env.PRIVATE_KEY = pk;
    }

    // Align old env names to current scripts (best-effort)
    if (!process.env.IDENTITY_VERIFICATION_HUB_ADDRESS && process.env.SELF_HUB_ADDRESS) {
      process.env.IDENTITY_VERIFICATION_HUB_ADDRESS = process.env.SELF_HUB_ADDRESS;
    }

    if (!process.env.IDENTITY_VERIFICATION_HUB_ADDRESS) {
      const hub = (await rl.question("IDENTITY_VERIFICATION_HUB_ADDRESS [required]: ")).trim();
      if (!hub) throw new Error("IDENTITY_VERIFICATION_HUB_ADDRESS is required");
      process.env.IDENTITY_VERIFICATION_HUB_ADDRESS = hub;
    }

    if (!process.env.SCOPE_SEED) {
      const seed = (await rl.question("SCOPE_SEED [required]: ")).trim();
      if (!seed) throw new Error("SCOPE_SEED is required");
      process.env.SCOPE_SEED = seed;
    }

    // Determine whether to pass --verify
    const verify =
      flags.verify !== undefined
        ? Boolean(flags.verify)
        : Boolean(process.env.BASESCAN_API_KEY || process.env.CELOSCAN_API_KEY);

    const baseArgs = ["script", "script/DeployReceiver.s.sol:DeployReceiver", "--rpc-url", "base-sepolia", "--broadcast"];
    if (verify) baseArgs.push("--verify");

    if (flags.dryRun) {
      console.log("\n[dry-run] forge " + baseArgs.join(" "));
      console.log("[dry-run] would write BASE_PROOF_OF_HUMAN_RECEIVER to .env\n");
      return;
    }

    console.log("\n=== Deploy Base (ProofOfHumanReceiver) ===\n");
    const baseOut = await runCapture("forge", baseArgs, { cwd: contractsDir, env: process.env });
    const baseReceiver = parseDeployedAddress(baseOut);
    if (!baseReceiver) throw new Error("Could not parse deployed Base receiver address from forge output");

    // Persist to .env for the Celo deploy (since DeploySender reads it via env)
    const prevEnv = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    let nextEnv = upsertDotenvKey(prevEnv, "BASE_PROOF_OF_HUMAN_RECEIVER", baseReceiver);
    // also store legacy key for older docs/tools
    nextEnv = upsertDotenvKey(nextEnv, "BASE_VERIFICATION_REGISTRY", baseReceiver);
    fs.writeFileSync(envPath, nextEnv, "utf8");
    process.env.BASE_PROOF_OF_HUMAN_RECEIVER = baseReceiver;

    console.log(`\nSaved BASE_PROOF_OF_HUMAN_RECEIVER=${baseReceiver} to ${envPath}\n`);

    const celoArgs = ["script", "script/DeploySender.s.sol:DeploySender", "--rpc-url", "celo-sepolia", "--broadcast"];
    if (verify) celoArgs.push("--verify");

    console.log("\n=== Deploy Celo (ProofOfHumanSender) ===\n");
    const celoOut = await runCapture("forge", celoArgs, { cwd: contractsDir, env: process.env });
    const celoSender = parseDeployedAddress(celoOut);
    if (!celoSender) throw new Error("Could not parse deployed Celo sender address from forge output");

    const envAfterSender = fs.readFileSync(envPath, "utf8");
    let finalEnv = upsertDotenvKey(envAfterSender, "CELO_PROOF_OF_HUMAN_SENDER", celoSender);
    // legacy name used by older docs
    finalEnv = upsertDotenvKey(finalEnv, "CELO_PROOF_OF_HUMAN_BRIDGE", celoSender);
    fs.writeFileSync(envPath, finalEnv, "utf8");

    console.log(`\nSaved CELO_PROOF_OF_HUMAN_SENDER=${celoSender} to ${envPath}\n`);

    const doTrusted = flags.configureTrustedSender ?? false;
    if (doTrusted) {
      console.log("\n=== Configure trusted sender on Base ===\n");
      // addTrustedSender(sender)
      await runCapture(
        "cast",
        [
          "send",
          baseReceiver,
          "addTrustedSender(address)",
          celoSender,
          "--rpc-url",
          "base-sepolia",
          "--private-key",
          process.env.PRIVATE_KEY,
        ],
        { cwd: contractsDir, env: process.env }
      );
      // setTrustedSenderEnforcement(true)
      await runCapture(
        "cast",
        [
          "send",
          baseReceiver,
          "setTrustedSenderEnforcement(bool)",
          "true",
          "--rpc-url",
          "base-sepolia",
          "--private-key",
          process.env.PRIVATE_KEY,
        ],
        { cwd: contractsDir, env: process.env }
      );
      console.log("\nTrusted sender configured.\n");
    }

    console.log("=== Done ===");
    console.log(`Base receiver: ${baseReceiver}`);
    console.log(`Celo sender:   ${celoSender}`);
    console.log("");
    console.log("Next steps:");
    console.log("- Update the demo client env:");
    console.log("  - NEXT_PUBLIC_CELO_BRIDGE_ADDRESS=<CELO_PROOF_OF_HUMAN_SENDER>");
    console.log("  - NEXT_PUBLIC_BASE_REGISTRY_ADDRESS=<BASE_PROOF_OF_HUMAN_RECEIVER>");
    console.log("- Fund the Celo sender for Hyperlane dispatch if you want auto-bridge behavior.");
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(err?.message || String(err));
  process.exit(1);
});

