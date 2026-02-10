import crypto from "node:crypto";
import { stableStringify } from "./policy.js";
import { createLogger } from "../logger.js";

const logger = createLogger({ service: "zkx402", component: "proofs_audit" });

export function getCorrelationId(req) {
  const existing =
    req?.headers?.["x-correlation-id"] ||
    req?.headers?.["x-request-id"] ||
    req?.headers?.["cf-ray"];
  if (existing) return String(existing);
  return crypto.randomUUID();
}

export function policyHash(policy) {
  try {
    const s = stableStringify(policy);
    return crypto.createHash("sha256").update(s).digest("hex");
  } catch {
    return null;
  }
}

export function logAuditEvent(event, { enabled } = {}) {
  if (!enabled) return;
  logger.info("zkx402_audit", { type: "zkx402_audit", ...event });
}

export function logDebug(message, data, { enabled } = {}) {
  if (!enabled) return;
  logger.debug(message, { type: "zkx402_debug", data });
}
