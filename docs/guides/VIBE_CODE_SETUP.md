# Vibe Coding Setup (Cursor / Claude Code / v0 / Lovable / agents)

This doc is written for “AI coding assistants” and fast-moving humans. It describes the **minimum reliable steps** to set up this repo, run tests, and extend proof providers (vlayer + future systems) without getting stuck.

## Repo shape (where things live)

- **Middleware package**: `packages/x402-zkx402/`
- **Demo**: `apps/demo/`
  - **Express server**: `apps/demo/server/`
  - **Next.js client**: `apps/demo/client/`
  - **Local deterministic E2E runner**: `apps/demo/local-chain/`
  - **Foundry contracts**: `apps/demo/contracts/`

## One-command validation (recommended)

This is the fastest “does everything work?” loop:

```bash
cd apps/demo/local-chain
node run-e2e-test.js
```

It runs:
- unit tests for `packages/x402-zkx402`
- Anvil (local chain) + deploys `MockUSDC`, `MockHumanRegistry`, and `VlayerProofRegistry`
- starts the demo server
- runs a paid x402 flow + proof-aware discount checks (Self + vlayer)
- runs a hard-gated endpoint check (`/motivate-gated`) to ensure “paying without proofs” still returns **403** (no settlement)

## Prereqs

- **Node.js**: 18+ (repo often works on newer, but Node 24 can break native builds; see `.cursor/rules/01-repo-basics.md`)
- **Foundry**: required for Anvil/forge/cast

Foundry install:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

## Fresh install (monorepo)

From repo root:

```bash
npm install --ignore-scripts --legacy-peer-deps
```

Notes for agent tools:
- Don’t assume per-folder installs are enough; some runtime deps resolve via the workspace layout.
- Keep secrets out of committed files; use `.env` / `.env.local`.

## Running the demo (web-first)

### Server

```bash
npm run dev:server
```

### Client

```bash
npm run dev:client
```

## Replit support (vibe coding)

This repo includes a Replit-friendly setup:

- `.replit` runs: `npm run dev:replit`
- `replit.nix` installs Node

### Recommended Replit flow

1) **Set Secrets** (Replit “Secrets” tab) instead of committing `.env` files:
   - `RECEIVER_WALLET` (required)
   - If using hosted CDP facilitator:
     - `CDP_API_KEY_ID`
     - `CDP_API_KEY_SECRET`
   - If using the demo client:
     - `NEXT_PUBLIC_CDP_PROJECT_ID`
2) Run the setup wizard (optional, writes local env files):

```bash
npm run vibe:setup
```

3) Install deps and start:

```bash
npm install --ignore-scripts --legacy-peer-deps
npm run dev:replit
```

Notes:
- `dev:replit` runs both the demo server and Next.js client in one process using `concurrently`.
- The local deterministic E2E (`apps/demo/local-chain`) requires Foundry/Anvil and is better suited for a full devcontainer/local machine.

## No-shell principle (repo automation)

Where we provide automation, we prefer **Node scripts** over bash:

- Setup wizard: `npm run vibe:setup`
- Vercel deploy helper: `npm run vercel:deploy`
- Vercel env helper: `npm run vercel:env`

## vlayer proofs in this repo (how to “get” them)

We support two verification paths:

### 1) `vlayer_chain` (chain attestation lookup; recommended request-path)

**What it means**: the server checks an on-chain registry that says “a valid vlayer proof was recorded for this subject + claim”.

**Required server env**:
- `VLAYERS_RPC_URL`
- `VLAYERS_PROOF_REGISTRY`

**Client headers**:
- `X-Wallet-Address: 0x...`
- `X-Proof-Claims: [{"type":"origin_http_get"}]`

**Where the local demo gets this**:
- `apps/demo/local-chain/run-e2e-test.js` deploys `apps/demo/contracts/src/VlayerProofRegistry.sol` and seeds an attestation for the test payer.

### 2) `vlayer_api` (verify a presented proof payload)

**What it means**: the server POSTs the proof payload to a verifier API.

**Required server env**:
- `VLAYERS_API_URL`
- `VLAYERS_API_KEY` (optional)

**Client headers**:
- `X-Wallet-Address: 0x...` (optional but recommended)
- `X-Proof-Claims: [{"type":"origin_http_get"}]`
- `X-Vlayer-Proof: <stringified payload or hex string>`

**Important**: when `PAYMENT-SIGNATURE` is missing (legacy: `X-PAYMENT`), the middleware is in **quote mode** and will avoid vendor API calls (including `vlayer_api`). Verification happens on the paid retry.

## Adding a new proof provider (agent-friendly checklist)

When implementing “future proofs”:

1) **Define a canonical claim**
   - edit `packages/x402-zkx402/src/proofs/claims.js`
   - ensure `claimKey(...)` is stable and bounded (avoid huge strings like URLs)

2) **Add routing**
   - edit `packages/x402-zkx402/src/proofs/router.js`
   - map claim → method name (e.g. `verifySomething`)

3) **Implement provider(s)**
   - add files under `packages/x402-zkx402/src/proofs/providers/`
   - choose `kind: "chain"` or `kind: "api"`
   - read required inputs from request context (headers parsed in middleware)

4) **Wire providers into middleware**
   - edit `packages/x402-zkx402/src/middleware.js`
   - parse headers you need (keep secrets server-side)

5) **Cost model**
   - add `{ provider, claimKey, costUsdMicros }` entries (USD micros; avoid floats)
   - update `apps/demo/server/proof-costs.json` (+ integrity hash) if the demo should exercise it

6) **Tests**
   - unit: add `packages/x402-zkx402/test/*.test.js`
   - e2e: extend `apps/demo/local-chain/test-e2e.js` if pricing/discount behavior changes

7) **Docs**
   - update `packages/x402-zkx402/README.md`
   - update `apps/demo/README.md`
   - add config + env var notes to `docs/specs/JSON_SPECS.md` when new providers are introduced

## “Do not do” (for agent tools)

- Don’t commit secrets into JSON policy/cost files (those are intentionally portable).
- Don’t rely on vendor APIs during the 402 “quote” request; the middleware intentionally avoids that.
- Don’t start long-lived processes in CI-style runs; prefer `apps/demo/local-chain/run-e2e-test.js`.

