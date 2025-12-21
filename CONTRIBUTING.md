# Contributing

This repo is intended to be production-quality code (not a one-off demo). Please keep changes small, tested, and easy to review.

## Repo structure

- **`packages/x402-zkx402/`**: reusable middleware package (core logic belongs here)
- **`apps/demo/`**: demo application (should stay thin and mostly wiring)
  - `apps/demo/server/`: Express server using `x402-zkx402`
  - `apps/demo/local-chain/`: local Anvil + MockUSDC + E2E runner
  - `apps/demo/contracts/`: Foundry contracts used by local chain and live integrations

## Development setup

- **Node**: prefer Node 20 (matches CI). Some transitive packages are picky about Node versions.
- **Install** (from repo root):

```bash
npm install --ignore-scripts --legacy-peer-deps
```

## Running locally

### Demo app

```bash
npm run dev:server
```

In another terminal:

```bash
npm run dev:client
```

### Local E2E (recommended before opening a PR)

```bash
cd apps/demo/local-chain
node run-e2e-test.js
```

This runs:
- `packages/x402-zkx402` unit tests
- Anvil + contract deploys
- demo server startup
- the full x402 payment flow, including proofPolicy/router coverage

## Tests

### Package unit tests

```bash
cd packages/x402-zkx402
npm test
```

### CI

CI runs on every push/PR via `.github/workflows/ci.yml`.

If CI is failing locally, ensure submodules are present:

```bash
git submodule update --init --recursive
```

## Code style and conventions

- **Avoid always-on console logging** in shared code (`packages/x402-zkx402`).
  - Use the debug/audit log helpers and gate logs behind env flags.
- **No hardcoded absolute paths** (CI checkout paths differ).
- **Prefer reusable helpers** in `packages/x402-zkx402` over copy/paste in app code.
- **Keep docs consistent**:
  - No bare URLs (wrap in backticks or use markdown links).
  - Prefer `apps/demo/...` paths (no `zkx402-demo` references).

## PR checklist

- Run:
  - `cd packages/x402-zkx402 && npm test`
  - `cd apps/demo/local-chain && node run-e2e-test.js`
- Update docs when you change:
  - paths, scripts, env vars, JSON formats, or CI behavior
- If you discover a mistake, update `mistakes.md`.

## Useful docs

- `DEVELOPER_TESTING.md`
- `JSON_SPECS.md`
- `PROOF_VERIFICATION_PLAN.md`
- `mistakes.md`


