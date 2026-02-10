const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const REDACT_KEYS = new Set([
  "authorization",
  "apiKey",
  "api_key",
  "apiKeyId",
  "apiKeySecret",
  "password",
  "privateKey",
  "private_key",
  "secret",
  "token",
  "signature",
]);

function currentLevelValue() {
  const raw = String(process.env.LOG_LEVEL || "info").toLowerCase();
  return LEVELS[raw] ?? LEVELS.info;
}

function toSafeValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  return value;
}

function redactRecord(record) {
  if (!record || typeof record !== "object") return record;
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    if (REDACT_KEYS.has(k)) {
      out[k] = "[REDACTED]";
      continue;
    }
    out[k] = toSafeValue(v);
  }
  return out;
}

function emit(level, message, bindings, fields) {
  if ((LEVELS[level] ?? LEVELS.info) < currentLevelValue()) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...redactRecord(bindings),
    ...redactRecord(fields),
  };
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

export function createLogger(bindings = {}) {
  return {
    child(extra = {}) {
      return createLogger({ ...bindings, ...extra });
    },
    debug(message, fields) {
      emit("debug", message, bindings, fields);
    },
    info(message, fields) {
      emit("info", message, bindings, fields);
    },
    warn(message, fields) {
      emit("warn", message, bindings, fields);
    },
    error(message, fields) {
      emit("error", message, bindings, fields);
    },
  };
}
