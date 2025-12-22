import { spawn } from "node:child_process";
import readline from "node:readline/promises";
import process from "node:process";

function run(cmd, args, { cwd }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${cmd} ${args.join(" ")} failed (exit ${code})`));
    });
  });
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log("\nzkx402 Vercel deploy (Node)\n");
    console.log("This will deploy two Vercel projects:");
    console.log("- Backend: apps/demo/server");
    console.log("- Frontend: apps/demo/client\n");

    const deployBackend = (await rl.question("Deploy backend now? [Y/n]: ")).trim().toLowerCase() !== "n";
    if (deployBackend) {
      await run("vercel", ["--prod"], { cwd: "apps/demo/server" });
    }

    const backendUrl = (await rl.question("Enter backend URL (https://...vercel.app): ")).trim();
    if (!backendUrl) throw new Error("Backend URL is required to proceed.");

    console.log("\nSet this in the frontend Vercel project env vars:");
    console.log(`- NEXT_PUBLIC_API_URL=${backendUrl}\n`);

    const deployFrontend = (await rl.question("Deploy frontend now? [Y/n]: ")).trim().toLowerCase() !== "n";
    if (deployFrontend) {
      await run("vercel", ["--prod"], { cwd: "apps/demo/client" });
    }

    const frontendUrl = (await rl.question("Enter frontend URL (https://...vercel.app) [optional]: ")).trim();
    if (frontendUrl) {
      console.log("\nReminder: set this in the backend Vercel project env vars:");
      console.log(`- ALLOWED_ORIGINS=${frontendUrl}\n`);
    }

    console.log("Done.");
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(err?.message || String(err));
  process.exit(1);
});

