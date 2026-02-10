# Contributing

This repo is intended to be production-quality code (not a one-off demo). Please keep changes small, tested, and easy to review.

## Repo structure

- **`packages/x402-zkx402/`**: reusable middleware package (core logic belongs here)
- **`apps/demo/`**: demo application (should stay thin and mostly wiring)
  - `apps/demo/server/`: Express server using `x402-zkx402`
  - `apps/demo/local-chain/`: local Anvil + MockUSDC + E2E runner
  - `apps/demo/contracts/`: Foundry contracts used by local chain and live integrations

## Development setup

- **Node**: prefer Node 22 (matches CI and `package.json` engines).
- **Install** (from repo root):

```bash
corepack enable
pnpm install --ignore-scripts
```

## Running locally

### Demo app

```bash
pnpm run dev:server
```

In another terminal:

```bash
pnpm run dev:client
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
pnpm --filter x402-zkx402 test
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
  - `pnpm --filter x402-zkx402 test`
  - `cd apps/demo/local-chain && node run-e2e-test.js`
- Update docs when you change:
  - paths, scripts, env vars, JSON formats, or CI behavior
- If you discover a mistake, update `docs/process/mistakes.md`.

## Releases (GitHub Releases)

This repo uses **Release Please** to generate release PRs and GitHub Releases for `packages/x402-zkx402`.

- **How it works**:
  - On merges to `main`, Release Please will open/refresh a **Release PR** that bumps the package version and updates `packages/x402-zkx402/CHANGELOG.md`.
  - When that Release PR is merged, it automatically creates a **Git tag** + **GitHub Release**.
- **Commit messages**: Prefer **Conventional Commits** so version bumps are correct:
  - `fix: ...` → patch
  - `feat: ...` → minor
  - `feat!: ...` or `fix!: ...` → major (breaking)

## Useful docs

- `docs/guides/DEVELOPER_TESTING.md`
- `docs/specs/JSON_SPECS.md`
- `docs/specs/PROOF_VERIFICATION_PLAN.md`
- `docs/process/mistakes.md`
