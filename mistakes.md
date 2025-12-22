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

### Assumed an MCP filesystem server existed in this environment

- **Mistake**: Tried to read workspace files via an MCP server name (`filesystem`) that wasn’t configured, which caused avoidable tool errors.
- **Fix**: Use the standard file read/search tools for workspace files unless we’ve confirmed an MCP resource server is available via discovery.
- **Where**: Initial review pass while gathering `claims.js`/tests for the pricing refactor.

## 2025-12-22

### Tried to follow “use MCP for GitHub” but no GitHub MCP server was configured

- **Mistake**: Assumed an MCP GitHub server would be available for code lookups. Discovery returned no MCP resources, so attempting to rely on MCP would have blocked progress.
- **Fix**: Fall back to the authenticated GitHub CLI (`gh`) for repo/code inspection when no MCP GitHub server is configured.
- **Where**: vlayer proof re-integration (needed upstream vlayer contract samples).

### Accidentally kept real secrets in a repo script (`set-vercel-env.sh`)

- **Mistake**: A helper script contained what looked like real CDP credentials and wallet addresses committed in plaintext.
- **Fix**: Deleted `set-vercel-env.sh` and replaced shell automation with Node-based helpers (`scripts/vercel-env.mjs`, `scripts/vercel-deploy.mjs`). Secrets are provided via environment variables (or set in the Vercel Dashboard).
- **Where**: Vercel deployment helpers.

### Bad CLI flag when merging PRs with `gh`

- **Mistake**: Tried `gh pr merge ... --yes` (flag doesn’t exist for `gh pr merge`; it uses non-interactive merge via other flags / API).
- **Fix**: Use `gh api` to merge (or supported `gh pr merge` flags) and check draft state first.
- **Where**: PR merge workflow for `cursor/zx402-self-xyz-proofs-d010`.

### GitHub permission: cannot create PRs with current `gh` integration token

- **Mistake**: Assumed the authenticated GitHub CLI session could create pull requests. `gh pr create` (and REST `POST /pulls`) failed with `Resource not accessible by integration` (HTTP 403).
- **Fix**: Push the branch and have the repo automation / a maintainer create the PR, or adjust the GitHub App/token permissions to allow PR creation.
- **Where**: Attempted PR creation for proof-cost commit on `cursor/zx402-self-xyz-proofs-d010`.

### x402 matching limitation: cannot advertise multiple accepts for same scheme+network

- **Mistake**: Assumed we could publish multiple payment requirements (different proof plans) in `accepts[]` and let the client pick by amount. In `x402@1.0.1`, `findMatchingPaymentRequirements(...)` only matches by **scheme + network**, so multiple requirements for the same pair are ambiguous.
- **Fix**: Treat proof-plan selection as an explicit input (request header / policy) and expose cost metadata in `extra`, rather than relying on multiple `accepts` entries for the same scheme+network.
- **Where**: Proof-cost + soft-provider-selection design in `packages/x402-zkx402`.

### E2E runner failure: assumed Foundry/Anvil installed outside devcontainer

- **Mistake**: Ran the local-chain E2E runner in an environment that wasn’t the devcontainer image, assuming `anvil` would exist on PATH. The runner then failed with `spawn anvil ENOENT`.
- **Fix**: Install Foundry (`foundryup`) in the environment before running E2E, or run inside the devcontainer which already installs Foundry.
- **Where**: `apps/demo/local-chain/run-e2e-test.js` (requires `anvil`, `forge`, `cast`).

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
