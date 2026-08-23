import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARC_USD_OFFCHAIN_SCHEME,
  buildPaymentRequired,
  buildSettlementResponse,
  validateYellowPayment,
} from '../src/payment.js';
import { ARC_TESTNET, getArcConfig } from '../src/arc/config.js';

const config = {
  clearnodeUrl: 'wss://clearnet-sandbox.yellow.com/ws',
  merchantAddress: '0xABCDEF',
  assetSymbol: 'ytest.usd',
  pricePerCall: '0.1',
  network: 'yellow:sandbox',
  maxTimeoutSeconds: 60,
};

function matchingPayload(receiptAmount) {
  return {
    x402Version: 2,
    accepted: {
      scheme: 'yellow-offchain',
      network: config.network,
      amount: config.pricePerCall,
      asset: config.assetSymbol,
      payTo: config.merchantAddress,
      maxTimeoutSeconds: config.maxTimeoutSeconds,
      extra: { settlement: 'yellow' },
    },
    payload: {
      transferId: '123',
      payer: '0xPayer',
      amount: receiptAmount,
      asset: config.assetSymbol,
      to: config.merchantAddress,
    },
  };
}

describe('x402 payment helpers', () => {
  it('builds PaymentRequired with yellow extension', () => {
    const required = buildPaymentRequired(config, 'https://example.test/tools', 'Test tool');
    assert.equal(required.x402Version, 2);
    assert.equal(required.accepts[0].scheme, 'yellow-offchain');
    assert.equal(required.extensions?.yellow?.info?.clearnodeUrl, config.clearnodeUrl);
    assert.equal(required.extensions?.yellow?.info?.asset, config.assetSymbol);
  });

  it('builds PaymentRequired with arc gateway extension', () => {
    const required = buildPaymentRequired(config, 'https://example.test/tools', 'Test tool');
    const arcRequirement = required.accepts.find(req => req.scheme === ARC_USD_OFFCHAIN_SCHEME);
    assert.ok(arcRequirement, 'arc requirement present');
    assert.equal(arcRequirement.asset, 'usdc');
    assert.equal(arcRequirement.extra.rail, 'circle-gateway');
    assert.equal(required.extensions?.arc?.info?.chainId, ARC_TESTNET.chainId);
    assert.equal(required.extensions?.arc?.info?.gatewayApiBaseUrl, ARC_TESTNET.gatewayApiBaseUrl);
  });

  it('builds PaymentRequired with SIWx extension derived from resource URL', () => {
    const required = buildPaymentRequired(
      config,
      'https://example.test/tools/quote',
      'Test tool'
    );
    const siwx = required.extensions?.['sign-in-with-x'];
    assert.ok(siwx, 'siwx extension present');
    assert.equal(siwx.info.domain, 'example.test');
    assert.match(siwx.info.nonce, /^[0-9a-f]{32}$/);
    assert.ok(siwx.info.issuedAt);
    assert.ok(siwx.info.expirationTime > siwx.info.issuedAt);
    assert.deepEqual(siwx.supportedChains.map(chain => chain.type), ['eip191', 'eip191', 'eip191']);
  });

  it('falls back to mcp.local domain for non-URL resources', () => {
    const required = buildPaymentRequired(config, 'not-a-url', 'Test tool');
    assert.equal(required.extensions?.['sign-in-with-x']?.info?.domain, 'mcp.local');
  });

  it('validates a matching payment payload', () => {
    const result = validateYellowPayment(matchingPayload('0.1'), config);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.info.transferId, '123');
    }
  });

  it('validates case-insensitive payTo', () => {
    const payload = {
      ...matchingPayload('0.1'),
      accepted: {
        ...matchingPayload('0.1').accepted,
        payTo: config.merchantAddress.toLowerCase(),
      },
    };
    const upperConfig = { ...config, merchantAddress: config.merchantAddress.toUpperCase() };
    const result = validateYellowPayment(payload, upperConfig);
    assert.equal(result.ok, true);
  });

  it('rejects insufficient payment amount', () => {
    const result = validateYellowPayment(matchingPayload('0.01'), config);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, 'insufficient_amount');
    }
  });

  it('rejects wrong x402 version, scheme, network, asset, payTo and missing receipts', () => {
    const badVersion = { ...matchingPayload('0.1'), x402Version: 1 };
    assert.deepEqual(validateYellowPayment(badVersion, config), {
      ok: false,
      reason: 'invalid_x402_version',
    });

    const noAccepted = { x402Version: 2, payload: {} };
    assert.deepEqual(validateYellowPayment(noAccepted, config), {
      ok: false,
      reason: 'missing_payment_requirements',
    });

    const badScheme = {
      ...matchingPayload('0.1'),
      accepted: { ...matchingPayload('0.1').accepted, scheme: 'exact' },
    };
    assert.equal(validateYellowPayment(badScheme, config).reason, 'unsupported_scheme');

    const badNetwork = {
      ...matchingPayload('0.1'),
      accepted: { ...matchingPayload('0.1').accepted, network: 'other' },
    };
    assert.equal(validateYellowPayment(badNetwork, config).reason, 'invalid_network');

    const badAsset = {
      ...matchingPayload('0.1'),
      accepted: { ...matchingPayload('0.1').accepted, asset: 'usdc' },
    };
    assert.equal(validateYellowPayment(badAsset, config).reason, 'invalid_asset');

    const badPayTo = {
      ...matchingPayload('0.1'),
      accepted: { ...matchingPayload('0.1').accepted, payTo: '0xOther' },
    };
    assert.equal(validateYellowPayment(badPayTo, config).reason, 'invalid_payto');

    const noReceipt = { ...matchingPayload('0.1'), payload: {} };
    assert.equal(validateYellowPayment(noReceipt, config).reason, 'missing_receipt_fields');
  });

  it('builds settlement response for success and failure', () => {
    const ok = buildSettlementResponse(true, 'yellow:sandbox', '0xPayer', 'tx123');
    assert.equal(ok.success, true);
    assert.equal(ok.transaction, 'tx123');

    const fail = buildSettlementResponse(false, 'yellow:sandbox', '0xPayer', undefined, 'bad');
    assert.equal(fail.success, false);
    assert.equal(fail.errorReason, 'bad');

    const failDefault = buildSettlementResponse(false, 'yellow:sandbox');
    assert.equal(failDefault.errorReason, 'payment_failed');
  });
});

describe('arc config', () => {
  it('exposes testnet defaults and honors env overrides', () => {
    assert.equal(ARC_TESTNET.caip2, 'eip155:5042002');
    const defaults = getArcConfig();
    assert.equal(defaults.rpcUrl, ARC_TESTNET.rpcUrl);

    process.env.ARC_RPC_URL = 'https://rpc.example.invalid';
    try {
      assert.equal(getArcConfig().rpcUrl, 'https://rpc.example.invalid');
    } finally {
      delete process.env.ARC_RPC_URL;
    }
  });
});
