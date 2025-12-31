# Testing (Cursor rules)

## Local E2E (recommended)

Quick run:

```bash
cd apps/demo/local-chain
node run-e2e-test.js
```

What the runner does:
- Starts Anvil on `:8545` (if not already running)
- Deploys `MockUSDC` (EIP-3009 `transferWithAuthorization` enabled)
- Mints 10,000 USDC to the test payer
- Writes server env file: `apps/demo/server/.env.local`
- Starts server: `apps/demo/server/index.js`
- Runs client test: `apps/demo/local-chain/test-e2e.js`

If port `3001` is already in use:

```bash
lsof -ti:3001 | xargs -r kill -9
```

If Anvil is already running and you want a clean chain:

```bash
pkill -f anvil
```


