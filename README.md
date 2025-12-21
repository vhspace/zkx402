# zkx402

zkx402 is an extension of the [x402 payment protocol](https://github.com/coinbase/x402) that adds **proof-aware pricing and access control**.

In practice: your API can require payment via x402 and optionally apply discounts (or reject access) based on **canonical proof claims** (starting with chain-only “human”).

## What’s in this repo

- **`packages/x402-zkx402/`**: the reusable middleware package (production code lives here)
- **`apps/demo/`**: a demo application showing how to use the middleware
  - `apps/demo/server/`: Express server using `x402-zkx402`
  - `apps/demo/local-chain/`: local Anvil + MockUSDC + E2E runner
  - `apps/demo/contracts/`: Foundry contracts (MockUSDC, bridge receiver/sender, etc.)

## Quick start (local E2E)

This is the fastest way to validate changes end-to-end:

```bash
cd apps/demo/local-chain
node run-e2e-test.js
```

It runs:
- `packages/x402-zkx402` unit tests
- starts Anvil and deploys test contracts
- starts the demo server
- executes a full 402 → pay → settle flow (including the proofPolicy/router discount path)

## Run the demo app (dev servers)

From repo root:

```bash
npm install --ignore-scripts --legacy-peer-deps
```

Then:

```bash
npm run dev:server
```

In another terminal:

```bash
npm run dev:client
```

## Using `x402-zkx402` in your own server

The middleware is exported from `packages/x402-zkx402`.

See:
- `packages/x402-zkx402/README.md`
- `packages/x402-zkx402/examples/basic-usage.js`

## Proof policy and JSON formats

See:
- `JSON_SPECS.md` (policy JSON envelope + integrity hashing)
- `PROOF_VERIFICATION_PLAN.md` (design/roadmap)

## Contributing

See `CONTRIBUTING.md`.

## Links

- Demo movie: `https://youtu.be/kEA0Jhq6qjM`
- Demo site: `https://zkx402.io`
