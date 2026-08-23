# x402-kit

eXpress402 x402 v2 payment middleware, imported into the zkx402 monorepo as the
first **unify slice** ([vhspace/zkx402#109](https://github.com/vhspace/zkx402/issues/109),
per [docs/unify/architecture.md](../../docs/unify/architecture.md)).

## Provenance

- Source: [vhspace/eXpress402](https://github.com/vhspace/eXpress402) `src/x402/`
  (`payment.ts`, `types.ts`) and its `src/arc/config.ts` dependency.
- Imported at commit `a0904cebeaaf501fb672cb6da2407bba27ad23b6` (2026-02-08).
- Licenses are not a constraint (owner directive, 2026-08-22): all source repos
  are the owner's code. This package is labeled MIT to match monorepo hygiene.
- Ported from TypeScript to plain-JS ESM with JSDoc types to match the
  conventions of `packages/x402-zkx402` (no build step; `node --test`).

## What's in this slice

| Upstream file | Here | Notes |
|---|---|---|
| `src/x402/payment.ts` | `src/payment.js` | Logic unchanged |
| `src/x402/types.ts` | `src/types.js` | Interfaces → JSDoc typedefs |
| `src/arc/config.ts` | `src/arc/config.js` | viem `defineChain` export omitted (unused by the middleware; keeps this package dependency-free). Env overrides behave identically. |

Exports:

- `buildPaymentRequired(config, resourceUrl, description)` — builds an x402 v2
  `PaymentRequired` advertising both rails plus a SIWx auth extension.
- `validateYellowPayment(payload, config)` — validates a Yellow off-chain
  payment receipt against merchant config.
- `buildSettlementResponse(ok, network, payer?, transaction?, reason?)`.
- ARC testnet constants + `getArcConfig()` (honors `ARC_RPC_URL`,
  `ARC_GATEWAY_MINTER_ADDRESS`, `ARC_USDC_ADDRESS`).

## Not included (follow-up slices)

- SIWx verify/storage (`src/x402/siwx/*`) — depends on Redis-backed session
  storage and ethers verification; lands later behind the same API.
- MCP server scaffold (`packages/mcp-server-kit` target).
- The `PaymentRail` merge with goldenmcp's middleware (unify step 5).

## Usage

```js
import { buildPaymentRequired, validateYellowPayment } from 'x402-kit';

const config = {
  clearnodeUrl: 'wss://clearnet-sandbox.yellow.com/ws',
  merchantAddress: '0x...',
  assetSymbol: 'ytest.usd',
  pricePerCall: '0.1',
  network: 'yellow:sandbox',
  maxTimeoutSeconds: 60,
};

// 1) Advertise payment requirements on a 402
const paymentRequired = buildPaymentRequired(
  config,
  'https://api.example.test/tools/quote',
  'Paid tool: quote'
);

// 2) Validate the paid request's X-PAYMENT payload
const result = validateYellowPayment(paymentPayload, config);
if (!result.ok) {
  // reject: result.reason e.g. 'insufficient_amount'
}
```

## Development

```bash
pnpm --filter x402-kit lint
pnpm --filter x402-kit test
```
