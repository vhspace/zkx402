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

### Wrong local `file:` dependency path broke Vercel/server installs

- **Mistake**: Set `apps/demo/server/package.json` to `"x402-zkx402": "file:../../packages/x402-zkx402"`, but from `apps/demo/server` that resolves to `apps/packages/x402-zkx402` (non-existent). This would fail `npm install` on Vercel (and any clean install).
- **Fix**: Corrected it to `"file:../../../packages/x402-zkx402"` and aligned the root lockfile entry.
- **Where**: `apps/demo/server/package.json`, `package-lock.json`, `VERCEL_DEPLOYMENT.md`

### Missed Next.js App Router requirement: `useSearchParams()` needs Suspense

- **Mistake**: Tried to ship the demo client with `/demo` and `/consumer` pages calling `useSearchParams()` directly at the page level, which causes `next build` to fail with “missing suspense boundary”.
- **Fix**: Wrapped the hook usage behind `<Suspense>` by moving hook logic into inner components and keeping the exported page component as the Suspense boundary.
- **Where**: `apps/demo/client/app/demo/page.tsx`, `apps/demo/client/app/consumer/page.tsx`

### Overly narrow `NavLink` typing blocked valid anchor props

- **Mistake**: Our `NavLink` wrapper props didn’t include standard anchor attributes, so passing `target="_blank"` / `rel="noopener noreferrer"` caused a TypeScript error.
- **Fix**: Updated `NavLink` props to extend `React.AnchorHTMLAttributes<HTMLAnchorElement>` (omitting `href`) and forward props safely.
- **Where**: `apps/demo/client/components/NavLink.tsx`, `apps/demo/client/components/Header.tsx`

### Vercel docs weren’t explicit about Self chain env var values

- **Mistake**: The Vercel deployment guide listed `SELF_RPC_URL` + `BASE_PROOF_OF_HUMAN_RECEIVER` but didn’t say they must point to **Base Sepolia RPC** + the **Base Sepolia ProofOfHumanReceiver** address (and where to find that address in this repo).
- **Fix**: Added a dedicated section to `VERCEL_DEPLOYMENT.md` explaining expected values and a minimal example.
- **Where**: `VERCEL_DEPLOYMENT.md`

### Docs drift: placeholder repo links + confusing facilitator guidance

- **Mistake**: Some docs and package metadata still referenced placeholder repo URLs (`yourusername/...`) and the demo server root endpoint pointed to a different repo. Also, facilitator usage was underspecified, leading to confusion about whether the middleware expects `x402` or `@coinbase/x402`.
- **Fix**:
  - Updated `packages/x402-zkx402/package.json` repository/bugs/homepage to the real repo.
  - Updated `packages/x402-zkx402/README.md` and `examples/basic-usage.js` to clarify facilitator shapes and to link to `docs/proof-concepts.md`.
  - Updated `apps/demo/server/index.js` root `github` link to this repo.
- **Where**: `packages/x402-zkx402/*`, `apps/demo/server/index.js`

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

## 2025-12-25

### CDP Embedded Wallet “network error” caused by Vercel Preview env drift

- **Mistake**: The helper script `scripts/vercel-env.mjs` only set env vars for the **production** target. If you tested a Vercel **preview** deployment, the frontend often ran without `NEXT_PUBLIC_CDP_PROJECT_ID`, and `@coinbase/cdp-hooks` surfaced the misconfig as a generic “network error”.
- **Fix**:
  - Update `scripts/vercel-env.mjs` to set env vars for **production + preview** by default.
  - Make the demo client fail fast with a clear error when `NEXT_PUBLIC_CDP_PROJECT_ID` is missing.
  - Document the CDP “Allowed origins” + “redeploy after env changes” gotchas in `VERCEL_DEPLOYMENT.md` and `VIBE_CODE_SETUP.md`.
- **Where**: `scripts/vercel-env.mjs`, `apps/demo/client/app/providers.tsx`, `VERCEL_DEPLOYMENT.md`, `VIBE_CODE_SETUP.md`

### Shared a deployment token in chat (secret leakage)

- **Mistake**: Posting what appears to be a `VERCEL_TOKEN` (or any deployment credential) in a chat/tooling context. Chat transcripts/logs are not a secure secret store.
- **Fix**:
  - Immediately **revoke/rotate** the token in Vercel.
  - Prefer Vercel Dashboard for configuration, or store tokens in a secret manager / CI secret store (never commit, never paste into PRs/issues/chats).
- **Where**: Vercel config troubleshooting during demo deployment.
