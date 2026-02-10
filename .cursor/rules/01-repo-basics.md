# zkx402 — Repo basics (Cursor rules)

## What this repo is

`zkx402` extends the `x402` payment protocol with proof-aware pricing/access control.

## Monorepo layout

- `packages/x402-zkx402/`: reusable middleware package (core logic lives here)
- `apps/demo/`: demo app using the middleware
  - `apps/demo/server/`: Express server
  - `apps/demo/client/`: Next.js client
  - `apps/demo/local-chain/`: local Anvil + MockUSDC + E2E runner
  - `apps/demo/contracts/`: Foundry contracts

## Install

- Prefer: `corepack enable && pnpm install --ignore-scripts`
- Avoid Node 24 for installs (native deps may fail). Node 20/22 is safest.

## AI-agent pointers

- Mistakes log (AI-only): `docs/process/mistakes.md` (root pointer: `mistakes.md`)
- Vibe coding setup: `docs/guides/VIBE_CODE_SETUP.md` (root pointer: `VIBE_CODE_SETUP.md`)


