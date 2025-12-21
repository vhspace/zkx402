import { createPublicClient, http } from "viem";

const PROOF_OF_HUMAN_RECEIVER_ABI = [
  {
    type: "function",
    name: "isVerified",
    stateMutability: "view",
    inputs: [{ name: "userAddress", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
];

export function createSelfChainProvider(options = {}) {
  const rpcUrl = options.rpcUrl || process.env.SELF_RPC_URL;
  const receiverAddress =
    options.receiverAddress ||
    process.env.BASE_PROOF_OF_HUMAN_RECEIVER ||
    process.env.SELF_PROOF_OF_HUMAN_RECEIVER;

  async function verifyHuman({ walletAddress }) {
    if (!receiverAddress) {
      return { ok: false, status: "not_configured", reason: "Missing Self receiver contract address" };
    }
    if (!rpcUrl) {
      return { ok: false, status: "not_configured", reason: "Missing SELF_RPC_URL" };
    }
    if (!walletAddress) {
      return { ok: false, status: "invalid_input", reason: "Missing wallet address" };
    }

    const client = createPublicClient({
      transport: http(rpcUrl),
    });
    try {
      const verified = await client.readContract({
        address: receiverAddress,
        abi: PROOF_OF_HUMAN_RECEIVER_ABI,
        functionName: "isVerified",
        args: [walletAddress],
      });
      return { ok: true, verified: Boolean(verified) };
    } catch (error) {
      return { ok: false, status: "error", reason: error?.message || "Self chain check failed" };
    }
  }

  return {
    name: "self",
    kind: "chain",
    verifyHuman,
    meta: { rpcUrl: rpcUrl || null, receiverAddress: receiverAddress || null },
  };
}


