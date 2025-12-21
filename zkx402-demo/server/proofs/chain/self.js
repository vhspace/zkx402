import { ethers } from "ethers";

const DEFAULT_SELF_RPC_URL = "https://sepolia.base.org";

const PROOF_OF_HUMAN_RECEIVER_ABI = [
  "function isVerified(address) view returns (bool)",
  "function getVerification(address) view returns (tuple(bytes32 userIdentifier, address userAddress, bytes userData, uint256 verifiedAt, uint256 receivedAt, bool isVerified))",
];

/**
 * Supported proof strings for Self chain verification.
 *
 * We keep this explicit so "zkproofOf(human)" can stay as a simple demo proof
 * unless you opt into Self-specific requested proofs.
 */
const SELF_PROOF_STRINGS = new Set([
  "zkproofof(self)",
  "zkproofof(self:human)",
  "zkproofof(selfprotocol)",
  "zkproofof(selfprotocol:human)",
]);

export function isSelfChainProofString(proof) {
  if (!proof) return false;
  return SELF_PROOF_STRINGS.has(String(proof).trim().toLowerCase());
}

export function createSelfChainProofChecker(options = {}) {
  const rpcUrl =
    options.rpcUrl || process.env.SELF_RPC_URL || DEFAULT_SELF_RPC_URL;
  const receiverAddress =
    options.receiverAddress ||
    process.env.BASE_PROOF_OF_HUMAN_RECEIVER ||
    process.env.SELF_PROOF_OF_HUMAN_RECEIVER;

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  async function isWalletVerified(walletAddress) {
    if (!receiverAddress) {
      return {
        verified: false,
        reason:
          "Missing BASE_PROOF_OF_HUMAN_RECEIVER (Self receiver contract address)",
      };
    }

    if (!walletAddress) {
      return { verified: false, reason: "Missing wallet address" };
    }

    const contract = new ethers.Contract(
      receiverAddress,
      PROOF_OF_HUMAN_RECEIVER_ABI,
      provider
    );

    try {
      const verified = await contract.isVerified(walletAddress);
      return { verified: Boolean(verified) };
    } catch (error) {
      return {
        verified: false,
        reason: error?.message || "Self chain verification failed",
      };
    }
  }

  return {
    rpcUrl,
    receiverAddress,
    isWalletVerified,
  };
}
