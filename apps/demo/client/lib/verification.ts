import { ethers } from 'ethers';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const BASE_SEPOLIA_RPC_URL = 'https://sepolia.base.org';

export async function isHumanVerifiedOnBase(opts: {
  walletAddress: string | null | undefined;
  baseRegistryAddress: string | null | undefined;
  rpcUrl?: string;
}): Promise<boolean> {
  const walletAddress = (opts.walletAddress || '').trim();
  const baseRegistryAddress = (opts.baseRegistryAddress || '').trim();
  const rpcUrl = (opts.rpcUrl || BASE_SEPOLIA_RPC_URL).trim();

  if (!walletAddress) return false;
  if (!baseRegistryAddress || baseRegistryAddress.toLowerCase() === ZERO_ADDRESS) return false;

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const registry = new ethers.Contract(
      baseRegistryAddress,
      ['function isVerified(address) view returns (bool)'],
      provider,
    );
    return Boolean(await registry.isVerified(walletAddress));
  } catch {
    return false;
  }
}

