import test from "node:test";
import assert from "node:assert/strict";

import { createLogger } from "../src/logger.js";

function parseJsonLogLines(chunks) {
  const logs = [];
  const text = chunks.join("");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) continue;
    try {
      logs.push(JSON.parse(trimmed));
    } catch {
      // Ignore non-JSON lines from test runner output.
    }
  }
  return logs;
}

async function captureStdoutJsonLogs(fn) {
  const originalWrite = process.stdout.write;
  const chunks = [];
  process.stdout.write = function patchedWrite(chunk, encoding, callback) {
    const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    chunks.push(text);
    if (typeof callback === "function") callback();
    return true;
  };

  try {
    await fn();
    // Give async middleware tails (e.g. response finalizers) a moment to flush logs.
    await new Promise((resolve) => setTimeout(resolve, 30));
  } finally {
    process.stdout.write = originalWrite;
  }

  return parseJsonLogLines(chunks);
}

test("logger: redacts sensitive fields and preserves context", async () => {
  const oldLevel = process.env.ZKX402_LOG_LEVEL;
  process.env.ZKX402_LOG_LEVEL = "debug";

  try {
    const logs = await captureStdoutJsonLogs(async () => {
      const logger = createLogger({ service: "zkx402-test", component: "unit" });
      logger.info("logger_redaction_check", {
        token: "secret-value",
        request_id: "req-logger-1",
      });
    });

    const entry = logs.find((l) => l.message === "logger_redaction_check");
    assert.ok(entry);
    assert.equal(entry.service, "zkx402-test");
    assert.equal(entry.component, "unit");
    assert.equal(entry.token, "[REDACTED]");
    assert.equal(entry.request_id, "req-logger-1");
  } finally {
    if (oldLevel === undefined) delete process.env.ZKX402_LOG_LEVEL;
    else process.env.ZKX402_LOG_LEVEL = oldLevel;
  }
});

test("logger: respects level filtering", async () => {
  const oldLevel = process.env.ZKX402_LOG_LEVEL;
  process.env.ZKX402_LOG_LEVEL = "warn";

  try {
    const logs = await captureStdoutJsonLogs(async () => {
      const logger = createLogger({ service: "zkx402-test", component: "unit" });
      logger.info("info_should_be_filtered");
      logger.warn("warn_should_appear", { request_id: "req-level-1" });
    });

    const warnLog = logs.find((l) => l.message === "warn_should_appear");
    const infoLog = logs.find((l) => l.message === "info_should_be_filtered");
    assert.ok(warnLog);
    assert.equal(warnLog.level, "warn");
    assert.equal(warnLog.request_id, "req-level-1");
    assert.equal(infoLog, undefined);
  } finally {
    if (oldLevel === undefined) delete process.env.ZKX402_LOG_LEVEL;
    else process.env.ZKX402_LOG_LEVEL = oldLevel;
  }
});
