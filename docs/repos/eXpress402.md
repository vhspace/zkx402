# vhspace/eXpress402

Paid MCP server: market data for agents, paid via Yellow Network prepaid
session channels. Import path: x402 middleware slice + `mcp-server-kit`
(issue #109). Licenses are not a constraint.

Local clone: `~/Documents/repos/vhspace/eXpress402` (default branch `main`;
last main commit 2026-02-01, merge PR #12 `offchain-billing-updates`).

## Stack (verified 2026-08-22)

- TypeScript 5.7 ESM, **npm**, Node 20 in CI; vitest + eslint + prettier
- `@modelcontextprotocol/sdk` ^1.9.0 (MCP **stdio** server, no HTTP framework)
- `@erc7824/nitrolite` ^0.5.3 (Yellow Network), `ws`, `zod`, `@noble/hashes`/`secp256k1`
- CI: `ci.yml` — lint / test / e2e against the Yellow sandbox

## Key paths

- `src/mcp/server.ts` — registers paid tools `stock_price`, `market_rumors`;
  per-tool gate `requirePayment()` reads `extra._meta['x402/payment']` and
  throws `McpError(402)` carrying an x402 v2 `PaymentRequired` with
  `extensions.yellow` (clearnodeUrl, pricePerCall, NitroRPC/0.4)
- `src/x402/payment.ts` + `types.ts` — x402 v2 PaymentRequired/payload/settlement
  builders for the custom `yellow-offchain` scheme
- `src/yellow/` — NitroRPC WebSocket client to clearnode
  (`wss://clearnet-sandbox.yellow.com/ws`, asset `ytest.usd`; prod: USDC),
  canonical-JSON keccak/secp256k1 signing codec, ledger-transfer verification
- `src/finance/` — data providers: stooq (stock OHLCV), reddit+tavily (rumors)
- `src/client-demo.ts`, `e2e-paid-tools.ts`, etc. — CLI demo/e2e flows
  (fund → call → offline-failure → session close/reclaim)

## Payment model

Prepaid Yellow app sessions (ERC-7824): agent opens an app session with
allocations, each paid call deducts off-chain, `close_app_session` settles.
Alternative direct-transfer path validated by `transferId` against clearnode
ledger. No facilitator — self-validation; settlement returned via
`_meta['x402/payment-response']`.

## Import caveats (feed issue #109)

1. Demo-mode bypass: ledger verification hardcodes `remaining = 999999`,
   `verified = true` in `src/yellow/verify.ts` — must be replaced by real
   ledger checks during import.
2. `viem/accounts` is imported but not declared in `package.json`.
3. Pricing is env-driven (`YELLOW_PRICE_PER_CALL` default `0.1`,
   `YELLOW_TOOL_PRICES` JSON overrides) — map onto shared pricing config.

## References

- https://github.com/vhspace/eXpress402
