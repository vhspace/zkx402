/**
 * Cleanroom route and price helpers for x402-zkx402.
 * No legacy x402 package dependency.
 */

// USDC addresses for supported EVM networks (canonical public data)
const USDC_BY_NETWORK = {
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "eip155:8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "eip155:84532": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

const USDC_DECIMALS = 6;

/**
 * Parse a numeric price from string or number.
 * Accepts "$0.10", "0.10", 0.10. Returns null if invalid.
 *
 * @param {string|number} price
 * @returns {number|null}
 */
function parsePrice(price) {
  if (typeof price === "number") {
    if (Number.isFinite(price) && price >= 0.0001 && price <= 999999999) {
      return price;
    }
    return null;
  }
  if (typeof price === "string") {
    const stripped = String(price).replace(/[^0-9.-]+/g, "");
    const parsed = Number(stripped);
    if (Number.isFinite(parsed) && parsed >= 0.0001 && parsed <= 999999999) {
      return parsed;
    }
  }
  return null;
}

/**
 * Get default USDC asset for a network.
 *
 * @param {string} network - e.g. "base-sepolia", "eip155:84532", "base"
 * @returns {{ address: string; decimals: number; eip712: { name: string; version: string } }}
 * @throws {Error} if network is not supported
 */
function getDefaultAsset(network) {
  const addr = USDC_BY_NETWORK[network];
  if (!addr) {
    throw new Error(`Unsupported network for default asset: ${network}`);
  }
  return {
    address: addr,
    decimals: USDC_DECIMALS,
    eip712: { name: "USDC", version: "2" },
  };
}

/**
 * Compute route patterns from a routes config object.
 * Format: { "GET /api/path": { price, network, config }, ... }
 *
 * @param {Record<string, object>} routes
 * @returns {Array<{ verb: string; pattern: RegExp; config: object }>}
 */
export function computeRoutePatterns(routes) {
  const normalizedRoutes = Object.fromEntries(
    Object.entries(routes).map(([pattern, value]) => [
      pattern,
      typeof value === "string" || typeof value === "number"
        ? { price: value, network: "base-sepolia" }
        : value,
    ])
  );
  return Object.entries(normalizedRoutes).map(([pattern, routeConfig]) => {
    const [verb, path] = pattern.includes(" ")
      ? pattern.split(/\s+/)
      : ["*", pattern];
    if (!path) {
      throw new Error(`Invalid route pattern: ${pattern}`);
    }
    const regexSource = path
      .replace(/[$()+.?^{|}]/g, "\\$&")
      .replace(/\*/g, ".*?")
      .replace(/\[([^\]]+)\]/g, "[^/]+")
      .replace(/\//g, "\\/");
    return {
      verb: verb.toUpperCase(),
      pattern: new RegExp(`^${regexSource}$`, "i"),
      config: routeConfig,
    };
  });
}

/**
 * Find the matching route for a path and HTTP method.
 *
 * @param {Array<{ verb: string; pattern: RegExp; config: object }>} routePatterns
 * @param {string} path - Request path (e.g. req.path)
 * @param {string} method - HTTP method (e.g. "GET")
 * @returns {{ verb: string; pattern: RegExp; config: object } | undefined}
 */
export function findMatchingRoute(routePatterns, path, method) {
  let normalizedPath;
  try {
    const pathWithoutQuery = path.split(/[?#]/)[0];
    const decodedPath = decodeURIComponent(pathWithoutQuery);
    normalizedPath = decodedPath
      .replace(/\\/g, "/")
      .replace(/\/+/g, "/")
      .replace(/(.+?)\/+$/, "$1");
  } catch {
    return undefined;
  }
  const matchingRoutes = routePatterns.filter(({ pattern, verb }) => {
    const matchesPath = pattern.test(normalizedPath);
    const upperMethod = method.toUpperCase();
    const matchesVerb = verb === "*" || upperMethod === verb;
    return matchesPath && matchesVerb;
  });
  if (matchingRoutes.length === 0) {
    return undefined;
  }
  return matchingRoutes.reduce(
    (a, b) => (b.pattern.source.length > a.pattern.source.length ? b : a)
  );
}

/**
 * Convert price to atomic amount and asset for the given network.
 *
 * @param {string|number|{ amount: string; asset: object }} price - Price string/number or object with amount+asset
 * @param {string} network - e.g. "base-sepolia", "base"
 * @returns {{ maxAmountRequired: string; asset: object } | { error: string }}
 */
export function processPriceToAtomicAmount(price, network) {
  let maxAmountRequired;
  let asset;
  if (typeof price === "string" || typeof price === "number") {
    const parsedAmount = parsePrice(price);
    if (parsedAmount == null) {
      return {
        error: `Invalid price (price: ${price}). Must be in the form "$3.10", 0.10, or "0.001" (numeric between 0.0001 and 999999999)`,
      };
    }
    asset = getDefaultAsset(network);
    maxAmountRequired = (parsedAmount * 10 ** asset.decimals).toString();
  } else if (price && typeof price === "object" && "amount" in price && "asset" in price) {
    maxAmountRequired = String(price.amount);
    asset = price.asset;
  } else {
    return {
      error: `Invalid price: expected string, number, or { amount, asset } object`,
    };
  }
  return { maxAmountRequired, asset };
}
