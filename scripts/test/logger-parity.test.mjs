import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import test from "node:test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

function normalize(s) {
  // Avoid false negatives from CRLF vs LF.
  return String(s).replace(/\r\n/g, "\n");
}

test("demo server logger matches package logger", async () => {
  const pkgLoggerPath = path.join(repoRoot, "packages/x402-zkx402/src/logger.js");
  const serverLoggerPath = path.join(repoRoot, "apps/demo/server/logger.js");

  const [pkgLogger, serverLogger] = await Promise.all([
    readFile(pkgLoggerPath, "utf8"),
    readFile(serverLoggerPath, "utf8"),
  ]);

  assert.equal(
    normalize(serverLogger),
    normalize(pkgLogger),
    "Keep log semantics identical across demo server and middleware (copy/paste is fine, but they must stay in sync).",
  );
});

