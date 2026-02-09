/**
 * Load route config from JSON file.
 *
 * Env: ROUTE_CONFIG_PATH — path to routes.json (default: ./routes.json)
 *
 * Resolves proofPolicyRef/proofCostsRef to actual policy/costs objects.
 * Injects asset into config when provided (for local facilitator).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTE_CONFIG_SCHEMA = "zkx402.routeConfigEnvelope.v1";

/**
 * @param {string} filePath - Path to routes.json
 * @param {Object} options
 * @param {Object} [options.proofPolicy] - Policy for proofPolicyRef "default"
 * @param {Object} [options.proofCosts] - Costs for proofCostsRef "default"
 * @param {string} [options.asset] - USDC/asset address to inject into config
 * @returns {{ ok: boolean, routes?: Object, reason?: string }}
 */
export function loadRouteConfig(filePath, options = {}) {
  const { proofPolicy, proofCosts, asset } = options;

  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8"));
    if (!raw || typeof raw !== "object") {
      return { ok: false, reason: "route_config_invalid" };
    }
    if (raw.schema !== ROUTE_CONFIG_SCHEMA) {
      return { ok: false, reason: "route_config_schema_mismatch" };
    }
    const routesRaw = raw.routes;
    if (!routesRaw || typeof routesRaw !== "object") {
      return { ok: false, reason: "routes_missing" };
    }

    const routes = {};
    for (const [pattern, route] of Object.entries(routesRaw)) {
      if (!route || typeof route !== "object") continue;
      const config = { ...route.config };
      if (config?.extra) {
        const extra = { ...config.extra };
        if (extra.proofPolicyRef === "default" && proofPolicy) {
          delete extra.proofPolicyRef;
          extra.proofPolicy = proofPolicy;
        }
        if (extra.proofCostsRef === "default" && proofCosts) {
          delete extra.proofCostsRef;
          extra.proofCosts = proofCosts;
        }
        config.extra = extra;
      }
      if (asset && config) {
        config.asset = asset;
      }
      routes[pattern] = { ...route, config };
    }
    return { ok: true, routes };
  } catch (err) {
    return { ok: false, reason: err?.message || "load_route_config_failed" };
  }
}

/**
 * Get routes: from JSON file if ROUTE_CONFIG_PATH exists, else null (caller uses fallback).
 */
export function getRoutesFromConfig(options = {}) {
  const path =
    process.env.ROUTE_CONFIG_PATH ||
    join(__dirname, "routes.json");
  const parsed = loadRouteConfig(path, options);
  return parsed.ok ? parsed.routes : null;
}
