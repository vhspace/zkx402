/**
 * Provenance: ported from vhspace/eXpress402 `src/arc/config.ts`
 * (commit a0904cebeaaf501fb672cb6da2407bba27ad23b6).
 * The viem `defineChain` export (`arcTestnetChain`) is omitted from this
 * slice: the payment middleware never uses it and dropping it keeps
 * x402-kit dependency-free. Env overrides behave identically.
 */

export const ARC_TESTNET_CHAIN_ID = 5042002;
export const ARC_TESTNET_CAIP2 = 'eip155:5042002';

export const ARC_TESTNET = {
  network: 'arc-testnet',
  chainId: ARC_TESTNET_CHAIN_ID,
  caip2: ARC_TESTNET_CAIP2,
  rpcUrl: 'https://rpc.testnet.arc.network',
  explorerBaseUrl: 'https://testnet.arcscan.app',
  usdcAddress: '0x3600000000000000000000000000000000000000',
  gatewayDomain: 26,
  gatewayWallet: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
  gatewayMinter: '0x0022222ABE238Cc2C7Bb1f21003F0a260052475B',
  gatewayApiBaseUrl: 'https://gateway-api-testnet.circle.com',
};

export function getArcConfig() {
  const rpcUrl = process.env.ARC_RPC_URL?.trim();
  const gatewayMinter = process.env.ARC_GATEWAY_MINTER_ADDRESS?.trim();
  const usdcAddress = process.env.ARC_USDC_ADDRESS?.trim();
  return {
    rpcUrl: rpcUrl && rpcUrl.length > 0 ? rpcUrl : ARC_TESTNET.rpcUrl,
    gatewayMinter: ((gatewayMinter && gatewayMinter.length > 0
      ? gatewayMinter
      : ARC_TESTNET.gatewayMinter) ?? ARC_TESTNET.gatewayMinter),
    usdcAddress: ((usdcAddress && usdcAddress.length > 0 ? usdcAddress : ARC_TESTNET.usdcAddress) ??
      ARC_TESTNET.usdcAddress),
  };
}
