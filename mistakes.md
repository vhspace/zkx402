# Mistakes Log

This file tracks mistakes found during implementation and what we changed to prevent repeats.

## 2025-12-21

### `forge create` flags/args ordering

- **Mistake**: Used `forge create ... --constructor-args ... --rpc-url ... --private-key ...` in an order that caused Foundry to not recognize the private key and fail with “Error accessing local wallet”.
- **Fix**: Reordered the command so wallet flags are parsed correctly:
  - `forge create ... --rpc-url ... --private-key ... --broadcast --constructor-args ...`
- **Where**: `zkx402-demo/local-chain/run-e2e-test.js` (`deployMockHumanRegistry`).

### Local E2E runner could pass while server failed to start (port in use)

- **Mistake**: Earlier runner behavior treated “timeout” as “server may have started”, which allowed tests to run against a stale server (or otherwise hide startup failure).
- **Fix**:
  - Fail fast on `EADDRINUSE` and on early server exit.
  - Run `teardown.js` at the start of `run-e2e-test.js` (best-effort cleanup).
  - Ensure `teardown.js` kills anything bound to `3001`.
- **Where**:
  - `zkx402-demo/local-chain/run-e2e-test.js`
  - `zkx402-demo/local-chain/teardown.js`

### Patch context mismatch while editing `test-e2e.js`

- **Mistake**: Applied a patch using stale context (file changed since last read), causing the patch to fail.
- **Fix**: Re-read the relevant section and re-apply with an exact match.
- **Where**: `zkx402-demo/local-chain/test-e2e.js`

### CI/GitHub Actions failure: `x402` not declared as a runtime dependency of `x402-zkx402`

- **Mistake**: `packages/x402-zkx402` imports `x402/*` at runtime but `x402` was only installed at the repo root. In a clean CI environment (no root install), the demo server crashes with `ERR_MODULE_NOT_FOUND: Cannot find package 'x402'`.
- **Fix**: Added `"dependencies": { "x402": "1.0.1" }` to `packages/x402-zkx402/package.json` so consumers/CI install it automatically.
- **Where**: `packages/x402-zkx402/package.json`

### CI/GitHub Actions failure: missing `@solana/kit` during clean installs

- **Mistake**: CI was installing dependencies per-subdirectory. In a clean environment this can produce a dependency layout where Solana libraries are present but their required peer/runtime packages are not, causing server startup to crash with `ERR_MODULE_NOT_FOUND` for `@solana/kit`.
- **Fix**: Updated CI to do a single **root workspace install** (`npm install` at repo root) before running unit tests and the local E2E runner. This matches how the monorepo resolves/hoists dependencies and avoids missing runtime modules.
- **Where**: `.github/workflows/ci.yml`


