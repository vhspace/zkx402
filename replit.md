# Replit AI — zkx402 project hints

These notes are for **Replit AI / Agent** working in this repo.

## Repo layout (monorepo)

- Core middleware package: `packages/x402-zkx402/`
- Demo app: `apps/demo/`
  - API server: `apps/demo/server/`
  - Next.js client: `apps/demo/client/`
  - Local deterministic E2E: `apps/demo/local-chain/`
  - Foundry contracts: `apps/demo/contracts/`

## Install

Prefer:

```bash
npm install --ignore-scripts --legacy-peer-deps
```

## Fast validation loop (recommended)

```bash
cd apps/demo/local-chain
node run-e2e-test.js
```

## Guardrails

- Avoid hardcoded absolute paths like `/workspaces/...` (CI checkout paths differ).
- Keep core logic changes in `packages/x402-zkx402/` focused and tested.
- If you add UI that depends on env vars, Preview deployments must fail **gracefully** (visible error, not a crash).
- `PAYMENT-SIGNATURE` (legacy: `X-PAYMENT`) must match the **`x402`** npm package schema (not `@coinbase/x402/*`).

## AI pointers (important)

- Mistakes log: `mistakes.md` (pointer) → `docs/process/mistakes.md`
- Vibe setup: `VIBE_CODE_SETUP.md` (pointer) → `docs/guides/VIBE_CODE_SETUP.md`
- Claude instructions: `CLAUDE.md`
- v0 instructions: `V0.md`
- Cursor rules: `.cursor/rules/`


