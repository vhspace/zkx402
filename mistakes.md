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


