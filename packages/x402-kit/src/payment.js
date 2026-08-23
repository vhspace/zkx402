/**
 * Provenance: ported from vhspace/eXpress402 `src/x402/payment.ts`
 * (commit a0904cebeaaf501fb672cb6da2407bba27ad23b6).
 * TypeScript annotations converted to JSDoc; logic unchanged.
 */
/** @typedef {import('./types.js').PaymentPayload} PaymentPayload */
/** @typedef {import('./types.js').PaymentRequired} PaymentRequired */
/** @typedef {import('./types.js').PaymentRequirements} PaymentRequirements */
/** @typedef {import('./types.js').SettlementResponse} SettlementResponse */
import { ARC_TESTNET, getArcConfig } from './arc/config.js';

function randomHex(bytes) {
  const buf = new Uint8Array(bytes);

  // Node 18+ exposes WebCrypto at globalThis.crypto; browsers do too.
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(buf);
  } else {
    // Last-resort fallback (should not happen in supported runtimes).
    for (let i = 0; i < buf.length; i++) {
      buf[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @typedef {object} YellowPaymentConfig
 * @property {string} clearnodeUrl
 * @property {string} merchantAddress
 * @property {string} assetSymbol
 * @property {string} pricePerCall
 * @property {string} network
 * @property {number} maxTimeoutSeconds
 * @property {YellowLedgerVerifier} verifyLedger Required: verifies the
 *   receipt's transferId against the clearnode ledger / prepaid session
 *   balance (e.g. via `get_ledger_transactions`).
 */

/**
 * Checks a Yellow receipt against the clearnode ledger. Must confirm the
 * transferId exists, matches payer/amount/recipient, and that the payer's
 * prepaid session balance covers the spend.
 *
 * @callback YellowLedgerVerifier
 * @param {{ receipt: YellowReceipt }} input
 * @returns {{ ok: true, remaining?: number } | { ok: false, reason: string }}
 *   `remaining` is the payer's post-settlement session balance; a negative
 *   value is treated as an over-spend and rejected.
 */

/**
 * @typedef {object} YellowReceipt
 * @property {string | number} transferId
 * @property {string} payer
 * @property {string} amount
 * @property {string} asset
 * @property {string} to
 */

export const ARC_USD_OFFCHAIN_SCHEME = 'arc-usd-offchain';

const yellowExtensionSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    clearnodeUrl: { type: 'string' },
    protocolVersion: { type: 'string' },
    asset: { type: 'string' },
    pricePerCall: { type: 'string' },
    transferId: { type: ['number', 'string'] },
    payer: { type: 'string' },
  },
  required: ['clearnodeUrl', 'protocolVersion', 'asset', 'pricePerCall'],
  additionalProperties: true,
};

/**
 * JSON Schema for SIWx extension
 */
const siwxExtensionSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    domain: { type: 'string' },
    address: { type: 'string' },
    statement: { type: 'string' },
    uri: { type: 'string', format: 'uri' },
    version: { type: 'string' },
    chainId: { type: 'string' },
    type: { type: 'string' },
    nonce: { type: 'string' },
    issuedAt: { type: 'string', format: 'date-time' },
    expirationTime: { type: 'string', format: 'date-time' },
    notBefore: { type: 'string', format: 'date-time' },
    requestId: { type: 'string' },
    resources: { type: 'array', items: { type: 'string', format: 'uri' } },
    signature: { type: 'string' },
  },
  required: [
    'domain',
    'address',
    'uri',
    'version',
    'chainId',
    'type',
    'nonce',
    'issuedAt',
    'signature',
  ],
};

const arcGatewayExtensionSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    network: { type: 'string' },
    chainId: { type: 'number' },
    caip2: { type: 'string' },
    rpcUrl: { type: 'string' },
    explorerBaseUrl: { type: 'string' },
    usdcAddress: { type: 'string' },
    gatewayDomain: { type: 'number' },
    gatewayWallet: { type: 'string' },
    gatewayMinter: { type: 'string' },
    gatewayApiBaseUrl: { type: 'string' },
  },
  required: [
    'network',
    'chainId',
    'caip2',
    'rpcUrl',
    'usdcAddress',
    'gatewayDomain',
    'gatewayWallet',
    'gatewayMinter',
    'gatewayApiBaseUrl',
  ],
  additionalProperties: true,
};

function buildSIWxSupportedChains() {
  // SIWx verification in this repo only checks the CAIP-2 prefix today ("eip155:*").
  // Provide useful EVM chain IDs clients can select from.
  const chains = [ARC_TESTNET.caip2, 'eip155:84532', 'eip155:8453'];
  return chains.map(chainId => ({ chainId, type: 'eip191' }));
}

/**
 * Build an x402 v2 `402 Payment Required` response advertising both the
 * Yellow off-chain rail and the Arc Gateway USDC rail, plus a SIWx
 * authentication extension.
 *
 * @param {YellowPaymentConfig} config
 * @param {string} resourceUrl
 * @param {string} description
 * @returns {PaymentRequired}
 */
export function buildPaymentRequired(config, resourceUrl, description) {
  const arcRuntime = getArcConfig();
  const arcInfo = {
    ...ARC_TESTNET,
    rpcUrl: arcRuntime.rpcUrl,
    usdcAddress: arcRuntime.usdcAddress,
    gatewayMinter: arcRuntime.gatewayMinter,
  };

  /** @type {PaymentRequirements} */
  const yellowRequirement = {
    scheme: 'yellow-offchain',
    network: config.network,
    amount: config.pricePerCall,
    asset: config.assetSymbol,
    payTo: config.merchantAddress,
    maxTimeoutSeconds: config.maxTimeoutSeconds,
    extra: {
      settlement: 'yellow',
    },
  };

  /** @type {PaymentRequirements} */
  const arcRequirement = {
    scheme: ARC_USD_OFFCHAIN_SCHEME,
    network: arcInfo.network,
    amount: config.pricePerCall,
    asset: 'usdc',
    payTo: config.merchantAddress,
    maxTimeoutSeconds: config.maxTimeoutSeconds,
    extra: {
      settlement: 'arc',
      rail: 'circle-gateway',
      arc: {
        chainId: arcInfo.chainId,
        rpcUrl: arcInfo.rpcUrl,
        explorerBaseUrl: arcInfo.explorerBaseUrl,
        usdcAddress: arcInfo.usdcAddress,
      },
      gateway: {
        apiBaseUrl: arcInfo.gatewayApiBaseUrl,
        domain: arcInfo.gatewayDomain,
        walletContract: arcInfo.gatewayWallet,
        minterContract: arcInfo.gatewayMinter,
      },
    },
  };

  // Generate SIWx extension for wallet authentication
  const nonce = randomHex(16);
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(Date.now() + 300000).toISOString(); // 5 minutes

  // Extract domain from resource URL
  let domain;
  try {
    domain = new URL(resourceUrl).hostname;
  } catch {
    domain = 'mcp.local'; // Fallback for MCP URLs
  }

  return {
    x402Version: 2,
    error: 'Payment required',
    resource: {
      url: resourceUrl,
      description,
      mimeType: 'application/json',
    },
    accepts: [yellowRequirement, arcRequirement],
    extensions: {
      yellow: {
        info: {
          clearnodeUrl: config.clearnodeUrl,
          protocolVersion: 'NitroRPC/0.4',
          asset: config.assetSymbol,
          pricePerCall: config.pricePerCall,
        },
        schema: yellowExtensionSchema,
      },
      arc: {
        info: arcInfo,
        schema: arcGatewayExtensionSchema,
      },
      'sign-in-with-x': {
        info: {
          domain,
          uri: resourceUrl,
          version: '1',
          nonce,
          issuedAt,
          expirationTime,
          statement: `Sign in to access ${description}`,
          resources: [resourceUrl],
        },
        supportedChains: buildSIWxSupportedChains(),
        schema: siwxExtensionSchema,
      },
    },
  };
}

/**
 * Validate a client's Yellow off-chain payment payload against the expected
 * merchant configuration, then verify the receipt against the clearnode
 * ledger via `config.verifyLedger`.
 *
 * Throws if `config.verifyLedger` is missing: structural checks alone prove
 * nothing about the ledger, so an unverified receipt is never accepted
 * silently (zkx402#115).
 *
 * @param {PaymentPayload} payload
 * @param {YellowPaymentConfig} config
 * @returns {{ ok: true, info: YellowReceipt } | { ok: false, reason: string }}
 * @throws {TypeError} when `config.verifyLedger` is not a function
 */
export function validateYellowPayment(payload, config) {
  if (payload?.x402Version !== 2) {
    return { ok: false, reason: 'invalid_x402_version' };
  }

  if (!payload.accepted) {
    return { ok: false, reason: 'missing_payment_requirements' };
  }

  if (payload.accepted.scheme !== 'yellow-offchain') {
    return { ok: false, reason: 'unsupported_scheme' };
  }

  if (payload.accepted.network !== config.network) {
    return { ok: false, reason: 'invalid_network' };
  }

  if (payload.accepted.asset !== config.assetSymbol) {
    return { ok: false, reason: 'invalid_asset' };
  }

  if (payload.accepted.payTo.toLowerCase() !== config.merchantAddress.toLowerCase()) {
    return { ok: false, reason: 'invalid_payto' };
  }

  const receipt = payload.payload;
  if (!receipt?.transferId || !receipt.payer || !receipt.amount) {
    return { ok: false, reason: 'missing_receipt_fields' };
  }

  const paid = Number(receipt.amount);
  const required = Number(config.pricePerCall);
  if (Number.isNaN(paid) || paid < required) {
    return { ok: false, reason: 'insufficient_amount' };
  }

  if (typeof config.verifyLedger !== 'function') {
    // No silent bypass of ledger verification (zkx402#115).
    throw new TypeError(
      'validateYellowPayment: config.verifyLedger is required to check the receipt against the clearnode ledger'
    );
  }

  const ledger = config.verifyLedger({ receipt });
  if (!ledger || ledger.ok !== true) {
    return {
      ok: false,
      reason: (ledger && ledger.reason) || 'ledger_verification_failed',
    };
  }

  if (typeof ledger.remaining === 'number' && ledger.remaining < 0) {
    return { ok: false, reason: 'insufficient_session_balance' };
  }

  return { ok: true, info: receipt };
}

/**
 * Build an x402 settlement response for success or failure.
 *
 * @param {boolean} ok
 * @param {string} network
 * @param {string} [payer]
 * @param {string} [transaction]
 * @param {string} [reason]
 * @returns {SettlementResponse}
 */
export function buildSettlementResponse(ok, network, payer, transaction, reason) {
  if (ok) {
    return {
      success: true,
      transaction: transaction ?? '',
      network,
      payer,
    };
  }

  return {
    success: false,
    transaction: '',
    network,
    payer,
    errorReason: reason ?? 'payment_failed',
  };
}
