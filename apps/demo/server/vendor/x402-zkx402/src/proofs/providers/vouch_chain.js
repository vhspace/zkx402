import crypto from "node:crypto";
import { createPublicClient, http } from "viem";
import { stableStringify } from "../policy.js";

const VOUCH_PROOF_REGISTRY_ABI = [
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

export function createVouchChainProvider(options = {}) {
  const rpcUrl = options.rpcUrl || process.env.VOUCH_RPC_URL || null;
  const registryAddress =
    options.registryAddress || process.env.VOUCH_PROOF_REGISTRY || null;

  async function verifyOriginHttpGet({ walletAddress, claim, policy }) {
    if (!registryAddress) {
      return {
        ok: false,
        status: "not_configured",
        reason: "Missing VOUCH_PROOF_REGISTRY",
      };
    }
    if (!rpcUrl) {
      return { ok: false, status: "not_configured", reason: "Missing VOUCH_RPC_URL" };
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
        abi: VOUCH_PROOF_REGISTRY_ABI,
        functionName: "isVerified",
        args: [walletAddress, claimHash],
      });
      return { ok: true, verified: Boolean(verified) };
    } catch (error) {
      return {
        ok: false,
        status: "error",
        reason: error?.message || "vouch chain check failed",
      };
    }
  }

  return {
    name: "vouch_chain",
    kind: "chain",
    supportsClaims: ["origin_http_get"],
    verifyOriginHttpGet,
    meta: { rpcUrl, registryAddress },
  };
}

