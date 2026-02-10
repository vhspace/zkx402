import { generateJwt } from "@coinbase/cdp-sdk/auth";
import { createLogger } from "./logger.js";

const logger = createLogger({ service: "x402-demo-server", component: "faucet" });

/**
 * request USDC from CDP Faucet
 */
export async function requestFaucet(address, apiKeyId, apiKeySecret) {
  // generate JWT for auth
  const jwt = await generateJwt({
    apiKeyId: apiKeyId,
    apiKeySecret: apiKeySecret,
    requestMethod: "POST",
    requestHost: "api.cdp.coinbase.com",
    requestPath: "/platform/v2/evm/faucet",
    expiresIn: 120,
  });

  const response = await fetch('https://api.cdp.coinbase.com/platform/v2/evm/faucet', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      network: 'base-sepolia',
      address: address,
      token: 'usdc',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("faucet_api_error", {
      status_code: response.status,
      body: errorText,
    });
    throw new Error(`Faucet request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.transactionHash;
}
