import { spawn } from "node:child_process";
import process from "node:process";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function runVercelEnvAdd({ cwd, name, value, target = "production" }) {
  return new Promise((resolve, reject) => {
    const child = spawn("vercel", ["env", "add", name, target], {
      cwd,
      stdio: ["pipe", "inherit", "inherit"],
    });

    child.on("error", reject);
    child.stdin.write(String(value));
    child.stdin.end();

    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`vercel env add failed for ${name} (exit ${code})`));
    });
  });
}

async function main() {
  // Backend
  const CDP_API_KEY_ID = requireEnv("CDP_API_KEY_ID");
  const CDP_API_KEY_SECRET = requireEnv("CDP_API_KEY_SECRET");
  const RECEIVER_WALLET = requireEnv("RECEIVER_WALLET");

  // Frontend
  const NEXT_PUBLIC_CDP_PROJECT_ID = requireEnv("NEXT_PUBLIC_CDP_PROJECT_ID");
  const NEXT_PUBLIC_API_URL = requireEnv("NEXT_PUBLIC_API_URL");

  console.log("Setting backend env vars (apps/demo/server)...");
  await runVercelEnvAdd({
    cwd: "apps/demo/server",
    name: "CDP_API_KEY_ID",
    value: CDP_API_KEY_ID,
  });
  await runVercelEnvAdd({
    cwd: "apps/demo/server",
    name: "CDP_API_KEY_SECRET",
    value: CDP_API_KEY_SECRET,
  });
  await runVercelEnvAdd({
    cwd: "apps/demo/server",
    name: "RECEIVER_WALLET",
    value: RECEIVER_WALLET,
  });

  console.log("Setting frontend env vars (apps/demo/client)...");
  await runVercelEnvAdd({
    cwd: "apps/demo/client",
    name: "NEXT_PUBLIC_CDP_PROJECT_ID",
    value: NEXT_PUBLIC_CDP_PROJECT_ID,
  });
  await runVercelEnvAdd({
    cwd: "apps/demo/client",
    name: "NEXT_PUBLIC_API_URL",
    value: NEXT_PUBLIC_API_URL,
  });

  console.log("Done.");
}

main().catch((err) => {
  console.error(err?.message || String(err));
  process.exit(1);
});

