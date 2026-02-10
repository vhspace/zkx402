# zkx402 Text Client

A text-based CLI for real testing of x402 endpoints with Self and vouch proofs.

## Quick start (local chain)

1. Start the local chain and server (keeps running until Ctrl+C):
   ```bash
   cd apps/demo/local-chain && node serve.js
   ```

2. In another terminal:
   ```bash
   cd apps/demo/client-cli
   npm install
   ```

3. Copy env from local-chain (created by setup):
   ```bash
   cp ../local-chain/.env.local .env 2>/dev/null || true
   ```

4. Run the client:
   ```bash
   npm start -- --local --endpoint /motivate
   ```

## Self verification (real Base Sepolia)

For `/motivate-gated` or discounted `/motivate` on real Base Sepolia, you need to verify as human first:

```bash
npm start -- --server https://your-server.vercel.app --verify-self --popup-qr --endpoint /motivate-gated
```

- `--verify-self` – Show Self QR before the request
- `--popup-qr` – Open QR in system image viewer (default: terminal)
- Without `--popup-qr` – QR is printed in the terminal

Set env vars for Self (see `.env.example`):

- `CELO_BRIDGE_ADDRESS` – Celo bridge contract (default: production)
- `BASE_REGISTRY_ADDRESS` – Base registry for verification

## Options

| Option | Description |
|--------|-------------|
| `--local` | Use local-chain (SERVER_URL, RPC_URL from .env.local) |
| `--server <url>` | Server URL (default: localhost:3001) |
| `--endpoint <path>` | `/motivate` or `/motivate-gated` |
| `--verify-self` | Show Self QR before request |
| `--popup-qr` | Open QR in image viewer instead of terminal |
| `--claims <json>` | X-Proof-Claims override (default: `[{"type":"human"}]`) |

## Vouch

Vouch (getvouch) proof provider is supported as `vouch_chain`/`vouch_api`. Use `--claims` to test vouch-backed claim tiers.
