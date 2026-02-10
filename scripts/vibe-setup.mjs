import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function writeFileSafe(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function asCsv(list) {
  return list.filter(Boolean).join(",");
}

function normalizeBool(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "y" || s === "yes" || s === "true" || s === "1";
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("\nzkx402 vibe setup wizard\n");
    console.log("This will write:");
    console.log("- apps/demo/server/.env.local");
    console.log("- apps/demo/client/.env.local\n");

    const apiUrlDefault = "http://localhost:3001";
    const clientUrlDefault = "http://localhost:3000";

    const receiverWallet = (await rl.question("Receiver wallet (RECEIVER_WALLET) [required]: ")).trim();
    if (!receiverWallet) {
      console.error("Receiver wallet is required.");
      process.exit(1);
    }

    const useHosted = normalizeBool(
      await rl.question("Use hosted CDP facilitator (recommended for Replit)? [y/N]: ")
    );

    const allowedOrigins = asCsv([
      clientUrlDefault,
      apiUrlDefault,
      (await rl.question(`Additional ALLOWED_ORIGINS (comma-separated) [optional]: `)).trim(),
    ]);

    // Proof providers (optional)
    const enableProofPolicy = normalizeBool(await rl.question("Enable proofPolicy/proofCosts in demo? [Y/n]: "));
    const enableProofCosts = normalizeBool(await rl.question("Enable proofCosts (fees/commission)? [y/N]: "));

    // Self chain (demo defaults already support this)
    const selfRpcUrl = (await rl.question("SELF_RPC_URL (Self chain reads) [optional]: ")).trim();
    const baseProofOfHumanReceiver = (await rl.question("BASE_PROOF_OF_HUMAN_RECEIVER [optional]: ")).trim();

    // vlayer_chain
    const vlayerRpcUrl = (await rl.question("VLAYERS_RPC_URL (vlayer_chain reads) [optional]: ")).trim();
    const vlayerRegistry = (await rl.question("VLAYERS_PROOF_REGISTRY [optional]: ")).trim();

    // vlayer_api
    const vlayerApiUrl = (await rl.question("VLAYERS_API_URL (vlayer_api verify endpoint) [optional]: ")).trim();
    const vlayerApiKey = (await rl.question("VLAYERS_API_KEY (secret) [optional]: ")).trim();

    // Server env
    const serverEnv = [
      `PORT=3001`,
      `RECEIVER_WALLET=${receiverWallet}`,
      `ALLOWED_ORIGINS=${allowedOrigins}`,
      useHosted ? `USE_LOCAL_FACILITATOR=false` : `USE_LOCAL_FACILITATOR=true`,
      enableProofPolicy ? `ENABLE_PROOF_POLICY=true` : `ENABLE_PROOF_POLICY=false`,
      enableProofCosts ? `ENABLE_PROOF_COSTS=true` : `ENABLE_PROOF_COSTS=false`,
      selfRpcUrl ? `SELF_RPC_URL=${selfRpcUrl}` : "",
      baseProofOfHumanReceiver ? `BASE_PROOF_OF_HUMAN_RECEIVER=${baseProofOfHumanReceiver}` : "",
      vlayerRpcUrl ? `VLAYERS_RPC_URL=${vlayerRpcUrl}` : "",
      vlayerRegistry ? `VLAYERS_PROOF_REGISTRY=${vlayerRegistry}` : "",
      vlayerApiUrl ? `VLAYERS_API_URL=${vlayerApiUrl}` : "",
      vlayerApiKey ? `VLAYERS_API_KEY=${vlayerApiKey}` : "",
      "",
      "# If using hosted CDP facilitator + APIs, set:",
      "# CDP_API_KEY_ID=...",
      "# CDP_API_KEY_SECRET=...",
      "",
    ]
      .filter((l) => l !== "")
      .join("\n");

    // Client env
    const nextPublicApiUrl =
      (await rl.question(`Client API URL (NEXT_PUBLIC_API_URL) [${apiUrlDefault}]: `)).trim() || apiUrlDefault;
    const nextPublicCdpProjectId = (await rl.question("NEXT_PUBLIC_CDP_PROJECT_ID [optional]: ")).trim();

    const clientEnv = [
      `NEXT_PUBLIC_API_URL=${nextPublicApiUrl}`,
      nextPublicCdpProjectId ? `NEXT_PUBLIC_CDP_PROJECT_ID=${nextPublicCdpProjectId}` : "# NEXT_PUBLIC_CDP_PROJECT_ID=...",
      "",
    ].join("\n");

    const serverEnvPath = path.join(repoRoot, "apps", "demo", "server", ".env.local");
    const clientEnvPath = path.join(repoRoot, "apps", "demo", "client", ".env.local");

    if (exists(serverEnvPath)) {
      const overwrite = normalizeBool(
        await rl.question("apps/demo/server/.env.local exists. Overwrite? [y/N]: ")
      );
      if (!overwrite) {
        console.log("Skipping server env write.");
      } else {
        writeFileSafe(serverEnvPath, serverEnv);
        console.log(`Wrote ${serverEnvPath}`);
      }
    } else {
      writeFileSafe(serverEnvPath, serverEnv);
      console.log(`Wrote ${serverEnvPath}`);
    }

    if (exists(clientEnvPath)) {
      const overwrite = normalizeBool(
        await rl.question("apps/demo/client/.env.local exists. Overwrite? [y/N]: ")
      );
      if (!overwrite) {
        console.log("Skipping client env write.");
      } else {
        writeFileSafe(clientEnvPath, clientEnv);
        console.log(`Wrote ${clientEnvPath}`);
      }
    } else {
      writeFileSafe(clientEnvPath, clientEnv);
      console.log(`Wrote ${clientEnvPath}`);
    }

    console.log("\nNext steps:");
    console.log("- Install deps: corepack enable && pnpm install --ignore-scripts");
    console.log("- Run demo: pnpm run dev:replit (or dev:server + dev:client)");
    console.log("- For deterministic E2E: cd apps/demo/local-chain && node run-e2e-test.js\n");
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

