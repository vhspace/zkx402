# Local Testing for x402 Middleware

End-to-end testing workflow for the x402 middleware server using a local Anvil chain and test wallets.

## Quick Start

```bash
node run-e2e-test.js
```

If you want the step-by-step flow instead:

```bash
npm install
npm run setup
npm test
```

## What This Does

This testing suite provides a complete local environment to test the x402 payment middleware:

1. **Local Chain**: Starts Anvil (Foundry's local Ethereum node) on port 8545
2. **Mock USDC**: Deploys a test USDC token contract with 6 decimals
3. **Test Accounts**: Uses Anvil's deterministic accounts with funded balances
4. **E2E Tests**: Tests the complete payment flow including dynamic pricing with zkproofs

## Commands

### Setup

```bash
npm run setup
```

Starts Anvil, deploys MockUSDC, funds test accounts, and creates `.env.local` configuration.

### Run Tests

```bash
npm test
```

Runs the end-to-end test suite that validates:

- Server health
- 402 Payment Required response
- USDC approval
- EIP-712 payment signature
- Payment verification and settlement
- Dynamic pricing with zkproofs

### Teardown

```bash
npm run teardown
```

Stops the Anvil process.

### Clean

```bash
npm run clean
```

Stops Anvil and removes all PID files.

## Test Accounts

The setup uses Anvil's default deterministic accounts:

- **Deployer/Receiver**: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- **Test Payer**: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` (funded with 10,000 USDC)

## Architecture

### Components

#### setup.js

- Starts Anvil local chain
- Deploys MockUSDC contract
- Funds test payer account
- Generates `.env.local` for server

#### test-e2e.js

- Tests complete payment flow
- Validates 402 responses
- Creates EIP-712 signatures
- Verifies balance changes
- Tests dynamic pricing with zkproofs

#### teardown.js

- Stops Anvil process
- Cleans up PID files

#### local-facilitator.js

- Mock facilitator for local testing
- Simulates payment verification
- Simulates settlement without external dependencies

### Flow

```text
1. Setup
   ├── Start Anvil (localhost:8545)
   ├── Deploy MockUSDC
   ├── Fund test accounts
   └── Create .env.local

2. Test
   ├── Check balances
   ├── Request protected endpoint (get 402)
   ├── Approve USDC
   ├── Sign payment with EIP-712
   ├── Submit payment
   ├── Verify settlement
   └── Test zkproof discounts

3. Teardown
   └── Stop Anvil
```

## Configuration

After running `npm run setup`, a `.env.local` file is created in `../server/`:

```env
CHAIN_ID=31337
RPC_URL=http://localhost:8545
USDC_ADDRESS=0x...
RECEIVER_WALLET=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
RECEIVER_PRIVATE_KEY=0x...
PAYER_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
PAYER_PRIVATE_KEY=0x...
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
USE_LOCAL_FACILITATOR=true
```

## Running the Server

After setup, start the x402 server:

```bash
cd ../server
npm run dev
```

The server will use the local chain configuration and MockUSDC.

## Testing Workflow

```bash
# Terminal 1: Setup and keep Anvil running
cd apps/demo/local-chain
npm install
npm run setup

# Terminal 2: Start the server
cd apps/demo/server
npm run dev

# Terminal 3: Run tests
cd apps/demo/local-chain
npm test

# When done
npm run teardown
```

## Troubleshooting

### Anvil already running

```bash
npm run teardown
npm run setup
```

### Port 8545 in use

```bash
lsof -ti:8545 | xargs kill -9
npm run setup
```

### Server not responding

Check that the server is running on port 3001 and using the local configuration.

### Test failures

Ensure Anvil is running and the server has loaded the `.env.local` file.

## Development

### Adding New Tests

Edit `test-e2e.js` to add new test scenarios. The test suite uses:

- `ethers.js` for blockchain interactions
- `node-fetch` for HTTP requests
- Standard Node.js assertions

### Modifying MockUSDC

The MockUSDC contract source is in `../contracts/src/MockUSDC.sol`. After changes:

```bash
cd ../contracts
forge build
cd ../local-chain
npm run clean
npm run setup
```

### Custom Facilitator Logic

Edit `local-facilitator.js` to modify payment verification or settlement logic for local testing.

## Dependencies

- **Foundry**: For Anvil and contract deployment
- **ethers.js**: Ethereum library
- **node-fetch**: HTTP client
- **dotenv**: Environment configuration

## Network Details

- **Chain ID**: 31337 (Anvil default)
- **RPC**: `http://localhost:8545`
- **Block Time**: 1 second
- **Gas Price**: 0 (free transactions)
