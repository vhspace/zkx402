import crypto from "node:crypto";
import { createPublicClient, http } from "viem";
import { stableStringify } from "../policy.js";

const VLAYERS_PROOF_REGISTRY_ABI = [
  {
    type: "function",
    name: "isVerified",
    stateMutability: "view",
    inputs: [
      { name: "subject", type: "address" },
      { name: "claimHash", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];

function sha256Bytes32Hex(value) {
  const hex = crypto.createHash("sha256").update(String(value)).digest("hex");
  return `0x${hex}`;
}

/**
 * vlayer chain provider (v1):
 *
 * We treat a "chain proof" as an on-chain *attestation/receipt* that a valid vlayer proof
 * was generated and recorded for a given subject + claim.
 *
 * This keeps the request hot path reliable (read-only RPC), and avoids requiring vlayer
 * precompiles or vendor APIs at request time.
 */
export function createVlayerChainProvider(options = {}) {
  const rpcUrl = options.rpcUrl || process.env.VLAYERS_RPC_URL || null;
  const registryAddress =
    options.registryAddress ||
    process.env.VLAYERS_PROOF_REGISTRY ||
    process.env.VLAYER_PROOF_REGISTRY ||
    null;

  async function verifyOriginHttpGet({ walletAddress, claim, policy }) {
    if (!registryAddress) {
      return {
        ok: false,
        status: "not_configured",
        reason: "Missing VLAYERS_PROOF_REGISTRY",
      };
    }
    if (!rpcUrl) {
      return { ok: false, status: "not_configured", reason: "Missing VLAYERS_RPC_URL" };
    }
    if (!walletAddress) {
      return { ok: false, status: "invalid_input", reason: "Missing wallet address" };
    }

    const claimHash = sha256Bytes32Hex(
      stableStringify({
        scope: policy?.scope || "zkx402",
        claim,
      })
    );

    const client = createPublicClient({ transport: http(rpcUrl) });
    try {
      const verified = await client.readContract({
        address: registryAddress,
        abi: VLAYERS_PROOF_REGISTRY_ABI,
        functionName: "isVerified",
        args: [walletAddress, claimHash],
      });
      return { ok: true, verified: Boolean(verified) };
    } catch (error) {
      return {
        ok: false,
        status: "error",
        reason: error?.message || "vlayer chain check failed",
      };
    }
  }

  return {
    name: "vlayer_chain",
    kind: "chain",
    supportsClaims: ["origin_http_get"],
    verifyOriginHttpGet,
    meta: { rpcUrl, registryAddress },
  };
}

