# vhspace/goldenmcp

Onchain reputation / eval / attestation layer for web3 MCP servers.
Import path: eval-engine + attestation + discovery into this monorepo
(issue #110). Licenses are not a constraint.

Local clone: `~/Documents/repos/vhspace/goldenmcp`
(default branch `main`; ~54 remote branches; last push 2026-06-14).

## Stack (verified 2026-08-22)

- Python 3.12 **uv workspace** (`pyproject.toml` + `uv.lock`) — Inspect AI evals
- TypeScript/Bun for apps + CRE workflow; Next.js 15 / React 19 web app
- Solidity via **Foundry** (`contracts/mcp-registry/`)
- Terraform (`infra/terraform/eval-runner`, DigitalOcean)
- CI: single `ci.yml` python job

## Key paths

- `packages/inspect-web3/` — Inspect AI tasks/scorers; connectors to lifi, odos,
  jupiter, kyberswap, 1inch MCPs
- `packages/walrus-client/` — Walrus blob-store HTTP client + `walrus://` fsspec adapter
- `packages/marketplace-mcp-ts/` — current x402 USDC marketplace server on Arc
  (`eip155:5042002`); `POST /tools/lookup` with a score-scaled price ladder and
  Circle Gateway settlement (supersedes legacy Python `marketplace-mcp`)
- `packages/identity/` — ENS text-record resolver + registry SDK
- `packages/eval-runner/` — HTTP service the CRE workflow calls to run/score/publish evals
- `apps/web/` — leaderboard, eval viewer, ENS resolver UI (Vercel demo:
  https://goldenmcp-e9l6.vercel.app/demo)
- `workflows/eval-pipeline/` — Chainlink CRE TS workflow: Handler A runs the eval +
  submits to Confidential AI TEE; Handler B parses the attestation, publishes to
  Walrus, writes `recordAttestation` + `updateCapabilityScore` on-chain
- `contracts/mcp-registry/` — `MCPRegistry.sol`, ERC-8004-inspired, on Arc testnet;
  implements Chainlink `IReceiver.onReport`, ERC-165, ERC-2771 forwarder. Registry
  at testnet.arcscan.app `0x8db0…20e3`. Evals target Base/Fraxtal; ENS identity on
  Sepolia (`child.goldenmcp.eth` subnames, ENSIP-25/26 text records)
- `benchmarks/golden/` — golden datasets per MCP

## Eval scoring

Composite = data accuracy 0.45 + tool-path 0.35 + token efficiency 0.20;
binary fail on prompt injection. Scores attested by Chainlink Confidential AI,
stored on Walrus, written to Arc, discoverable via ENS.

## First import slice (issue #110)

Docs/package stub for eval-engine + attestation here; no demo rewrite in that step.
The eXpress402-style per-tool x402 gate and this repo's marketplace server converge
on the shared `PaymentRail` middleware (architecture.md row 1).

## References

- https://github.com/vhspace/goldenmcp
