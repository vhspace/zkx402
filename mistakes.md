# Mistakes Log

This file tracks mistakes found during implementation and what we changed to prevent repeats.

## Pre-merge checklist (to prevent repeats)

- **CI-fresh simulation**: Run the same steps CI runs from a clean state (no assumptions about existing `node_modules`, running servers, or open ports).
- **No hardcoded paths**: Avoid absolute paths like `/workspaces/...`; compute paths from `__dirname` or run commands in the correct `cwd`.
- **CLI contract check**: Before baking a CLI invocation into scripts, confirm argument forms and ordering (`--help` / minimal repro).
- **Lockfile policy**:
  - If CI uses `npm ci`, ensure the relevant `package-lock.json` is committed and not ignored.
  - If lockfiles are intentionally not committed, CI must use `npm install` instead of `npm ci`.
- **Runtime deps declared at import site**: If a package imports a module at runtime, it must declare it in its own `dependencies` (not rely on workspace root hoisting).

## 2025-12-21

### Assumed `node_modules` existed when inspecting `@selfxyz/qrcode`

- **Mistake**: Tried to inspect `@selfxyz/qrcode` directly under `/workspace/node_modules/...` even though dependencies weren’t installed in this environment yet, so the path didn’t exist.
- **Fix**: Switched to using the repo’s checked-in sources and only rely on installed `node_modules` when we explicitly install deps. For the Self API verifier, we made the server-side integration payload-driven (`x-self-proof`) and API-endpoint-configured (`SELF_API_URL`) rather than SDK-internals-dependent.
- **Where**: Investigation step while implementing Self.xyz API provider (`packages/x402-zkx402/src/proofs/providers/self_api.js`).

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

### CI/GitHub Actions failure: `npm ci` without a committed lockfile

- **Mistake**: `zkx402-demo/.gitignore` ignored `package-lock.json`, so `zkx402-demo/local-chain/package-lock.json` was never committed. CI runs `npm ci` in `zkx402-demo/local-chain`, which then fails with `EUSAGE` because no lockfile exists in the checkout.
- **Fix**: Stop ignoring `package-lock.json` under `zkx402-demo/` and commit `zkx402-demo/local-chain/package-lock.json`.
- **Where**:
  - `zkx402-demo/.gitignore`
  - `zkx402-demo/local-chain/package-lock.json`

### CI/E2E runner failure: hardcoded `/workspaces/zkx402` path

- **Mistake**: `zkx402-demo/local-chain/run-e2e-test.js` hardcoded the repo path when running unit tests:
  - `node --test /workspaces/zkx402/packages/x402-zkx402/test/*.test.js`
  This fails in GitHub Actions (checkout path is not `/workspaces/zkx402`) and produces “Could not find '/workspaces/zkx402/…'”.
- **Fix**: Compute repo root from `__dirname` and pass the test directory to `node --test` (no absolute path, no glob).
- **Where**: `zkx402-demo/local-chain/run-e2e-test.js`
