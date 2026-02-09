/**
 * CAIP-2 Network normalization for x402 v2
 */

export const CAIP2_NETWORKS = {
  base: "eip155:8453",
  "base-sepolia": "eip155:84532",
  ethereum: "eip155:1",
  solana: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  "solana-devnet": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
};

const LEGACY_NETWORKS = Object.entries(CAIP2_NETWORKS).reduce(
  (acc, [legacy, caip2]) => {
    acc[caip2.toLowerCase()] = legacy;
    return acc;
  },
  {},
);

/**
 * Normalizes a network identifier to CAIP-2 format.
 *
 * @param {string} network - The network identifier (e.g., "base-sepolia", "eip155:84532")
 * @returns {string} The CAIP-2 normalized network identifier
 */
export function normalizeNetwork(network) {
  if (!network) return network;

  // If already in CAIP-2 format (contains a colon), return as is
  if (network.includes(":")) {
    return network;
  }

  // Map legacy names to CAIP-2
  const normalized = CAIP2_NETWORKS[network.toLowerCase()];
  if (normalized) {
    return normalized;
  }

  return network;
}

/**
 * Maps a CAIP-2 network identifier back to a legacy name (when possible).
 *
 * @param {string} network - The network identifier (e.g., "eip155:84532")
 * @returns {string} The legacy network identifier
 */
export function toLegacyNetwork(network) {
  if (!network) return network;

  if (!network.includes(":")) {
    return network;
  }

  const legacy = LEGACY_NETWORKS[String(network).toLowerCase()];
  return legacy || network;
}
