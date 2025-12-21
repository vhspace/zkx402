# Developer Testing

This repo has two practical verification/testing loops:

- **Local E2E** (fast, deterministic): Anvil + `MockUSDC` + local facilitator + server + client-flow test.
- **Live proof-of-humanity** (real cross-chain): Self verification on Celo Sepolia bridged to Base Sepolia, then checked on Base.

## Local E2E (recommended while iterating)

From the repo root:

```bash
cd apps/demo/local-chain
node run-e2e-test.js
```

What it covers:

- x402 402 challenge flow
- EIP-3009 `transferWithAuthorization` signing
- local settlement via `transferWithAuthorization`
- **proofPolicy/router path** (chain-only “human”): deploys a local `MockHumanRegistry` and checks `isVerified(address)` via `SELF_RPC_URL` + `BASE_PROOF_OF_HUMAN_RECEIVER`

Optional (cost model):

- The demo server can also load a proof cost schedule from `apps/demo/server/proof-costs.json` when `ENABLE_PROOF_COSTS=true`.
- This is used to price vendor/API-based verification (and commissions) without hardcoding assumptions about whether a provider is free.

Troubleshooting:

- If port 3001 is stuck: `lsof -ti:3001 | xargs -r kill -9`
- If you want a clean chain: `pkill -f anvil`

## Live: Self (Celo Sepolia → Base Sepolia)

High-level flow:

1. User completes Self verification (rules configured by the QR generator).
2. Celo Sepolia sender contract dispatches a Hyperlane message.
3. Base Sepolia receiver contract updates `isVerified(address)`.
4. The middleware can enforce **chain-only “human”** by reading Base Sepolia state.

### Addresses

- **Base Sepolia receiver**: `BASE_PROOF_OF_HUMAN_RECEIVER=0x4ed8474C2605C314CA1cE829bea7B9c2d1b446c8`
- **Celo Sepolia sender**: `0xA079DCb02E78C8bc042712765Dcbc3E7a22D73d0`

### Important gotcha: sender funding

If the Celo Sepolia sender contract has **0 CELO**, it cannot pay Hyperlane dispatch costs, and Base will never update.

### Server env for live chain checks

Set (example):

```bash
export SELF_RPC_URL="https://sepolia.base.org"
export BASE_PROOF_OF_HUMAN_RECEIVER="0x4ed8474C2605C314CA1cE829bea7B9c2d1b446c8"
```

### Request requirements for chain providers

Include the subject wallet:

- `X-Wallet-Address: 0x...` (or `?wallet=0x...`)

### More design context

See `PROOF_VERIFICATION_PLAN.md`.


