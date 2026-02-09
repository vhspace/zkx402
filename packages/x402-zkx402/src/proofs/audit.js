import crypto from "node:crypto";
import { stableStringify } from "./policy.js";

export function getCorrelationId(req) {
  const existing =
    req?.headers?.["x-request-id"] ||
    req?.headers?.["x-correlation-id"] ||
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
  // stdout JSON is the v1 stub; later we can ship to a sink.
  console.log(JSON.stringify({ type: "zkx402_audit", ...event }));
}

export function logDebug(message, data, { enabled } = {}) {
  if (!enabled) return;
  console.log(JSON.stringify({ type: "zkx402_debug", message, data }));
}
