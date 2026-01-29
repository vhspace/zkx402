# Claude Code — zkx402 repo instructions

These notes are for **Claude Code** working in this repo.

## Repo layout

- **Core package**: `packages/x402-zkx402/` (production middleware)
- **Demo app**: `apps/demo/`
  - API server: `apps/demo/server/`
  - Next.js client: `apps/demo/client/`
  - Local deterministic E2E: `apps/demo/local-chain/`
  - Contracts: `apps/demo/contracts/`

## Install

Prefer:

```bash
npm install --ignore-scripts --legacy-peer-deps
```

## Local E2E (recommended fastest validation)

```bash
cd apps/demo/local-chain
node run-e2e-test.js
```

If port `3001` is in use:

```bash
lsof -ti:3001 | xargs -r kill -9
```

If you need a clean chain:

```bash
pkill -f anvil
```

## Key conventions / pitfalls

- The `PAYMENT-SIGNATURE` header (legacy: `X-PAYMENT`) must match the **`x402`** npm package schema (not `@coinbase/x402/*`).
- Avoid hardcoded absolute paths like `/workspaces/...` (CI checkout paths differ).
- **Hard proof-gating**: use `config.extra.requiredClaims` (or `config.extra.accessControl`) + `proofPolicy`. Quote mode still returns `402`; paid requests return `403` when required claims fail.

## AI-only pointers (keep these discoverable)

- Mistakes log: `mistakes.md` (pointer) → `docs/process/mistakes.md`
- Vibe setup: `VIBE_CODE_SETUP.md` (pointer) → `docs/guides/VIBE_CODE_SETUP.md`


