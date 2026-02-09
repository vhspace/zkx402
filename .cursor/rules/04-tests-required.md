# Tests must pass (Cursor rule)

## After code changes

Run relevant tests automatically after code changes:

- If core middleware or proof logic changed, run `cd packages/x402-zkx402 && npm test`
- If demo server/client or contracts changed, run `cd apps/demo/local-chain && node run-e2e-test.js`
- If UI changes were made, run `npm run test:e2e`

## Before opening a PR

All tests must pass:

- **Repo tools**: `npm run test:tools` (root)
- **x402-zkx402 unit tests**: `cd packages/x402-zkx402 && npm test`
- **Local E2E**: `cd apps/demo/local-chain && node run-e2e-test.js`
- **Playwright E2E** (if changed UI): `npm run test:e2e`

## Before merging to main

The CI workflow must be green:
- `CI (lint/build)` job must pass
- `unit-and-e2e` job must pass
- For PRs: `deploy-preview` + `Browser E2E (Preview URL)` must pass

If CI fails, investigate the logs, patch the issue, and rerun until green.

