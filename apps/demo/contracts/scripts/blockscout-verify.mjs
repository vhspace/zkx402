import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { loadDotenvFile } from "./lib.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contractsDir = path.resolve(__dirname, "..");
const envPath = path.join(contractsDir, ".env");

function parseArgs(argv) {
  const out = {
    address: null,
    chain: "base-sepolia",
    blockscoutBaseUrl: null,
    contractName: null,
    flattenedFile: null,
    compilerVersion: "v0.8.28+commit.7893614a",
    optimization: true,
    optimizationRuns: 200,
    evmVersion: "paris",
    constructorArgs: null,
    licenseType: "mit",
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--address") out.address = next();
    else if (a === "--chain") out.chain = next();
    else if (a === "--blockscout") out.blockscoutBaseUrl = next();
    else if (a === "--contract") out.contractName = next();
    else if (a === "--flattened") out.flattenedFile = next();
    else if (a === "--compiler") out.compilerVersion = next();
    else if (a === "--evm") out.evmVersion = next();
    else if (a === "--constructor-args") out.constructorArgs = next();
    else if (a === "--license") out.licenseType = next();
    else if (a === "--no-optimization") out.optimization = false;
    else if (a === "--runs") out.optimizationRuns = Number(next());
    else if (a === "--dry-run") out.dryRun = true;
  }
  return out;
}

function defaultBlockscoutUrl(chain) {
  // Conservative defaults. Override with --blockscout if needed.
  if (chain === "base-sepolia") return "https://base-sepolia.blockscout.com";
  if (chain === "celo-sepolia") return "https://celo-sepolia.blockscout.com";
  return null;
}

function buildBlockscoutPayload({
  compilerVersion,
  optimization,
  optimizationRuns,
  contractName,
  evmVersion,
  sourceCode,
  constructorArgs,
  licenseType,
}) {
  return {
    compiler_version: compilerVersion,
    optimization: Boolean(optimization),
    optimization_runs: Number.isFinite(Number(optimizationRuns))
      ? Math.trunc(Number(optimizationRuns))
      : 200,
    contract_name: contractName,
    evm_version: evmVersion,
    source_code: sourceCode,
    ...(constructorArgs ? { constructor_args: constructorArgs } : {}),
    autodetect_constructor_args: !constructorArgs,
    license_type: licenseType,
  };
}

async function main() {
  // Load .env if present (does not override existing env vars)
  const fileEnv = loadDotenvFile(envPath);
  for (const [k, v] of Object.entries(fileEnv)) {
    if (process.env[k] == null) process.env[k] = v;
  }

  const args = parseArgs(process.argv.slice(2));
  const address = String(args.address || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error("Missing/invalid --address 0x...");
  }

  const contractName = String(args.contractName || "").trim();
  if (!contractName) throw new Error("Missing --contract <ContractName>");

  const flattenedPath = path.resolve(contractsDir, String(args.flattenedFile || "").trim());
  if (!args.flattenedFile) throw new Error("Missing --flattened <path/to/flattened.sol>");
  if (!fs.existsSync(flattenedPath)) throw new Error(`Flattened file not found: ${flattenedPath}`);

  const blockscoutBaseUrl =
    args.blockscoutBaseUrl || defaultBlockscoutUrl(args.chain);
  if (!blockscoutBaseUrl) throw new Error("Missing --blockscout <https://...>");

  const url = `${blockscoutBaseUrl.replace(/\/$/, "")}/api/v2/smart-contracts/${address}/verification/via/flattened-code`;
  const sourceCode = fs.readFileSync(flattenedPath, "utf8");

  const payload = buildBlockscoutPayload({
    compilerVersion: args.compilerVersion,
    optimization: args.optimization,
    optimizationRuns: args.optimizationRuns,
    contractName,
    evmVersion: args.evmVersion,
    sourceCode,
    constructorArgs: args.constructorArgs,
    licenseType: args.licenseType,
  });

  if (args.dryRun) {
    console.log("[dry-run] POST", url);
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Blockscout verify failed (${res.status}): ${text}`);
  }

  console.log("Verification submitted.");
  console.log(text);
}

export { buildBlockscoutPayload };

const isEntrypoint = (() => {
  try {
    const argvUrl = pathToFileURL(process.argv[1] || "").href;
    return import.meta.url === argvUrl;
  } catch {
    return false;
  }
})();

if (isEntrypoint) {
  main().catch((err) => {
    console.error(err?.message || String(err));
    process.exit(1);
  });
}

