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

> **Owner directive:** all in-scope repos are the owner's code; licenses are
> not a constraint (see `docs/unify/README.md`).

## What it is

An onchain reputation layer for Web3 MCP servers: evals score live MCPs on
data accuracy / tool-path / token efficiency; results are attested by Chainlink
Confidential AI, stored on Walrus, written to a registry on Arc, and made
discoverable via ENS — queryable by agents for a USDC nanopayment (x402).

## Eval engine — scoring contract

Per capability, three weighted dimensions plus a binary security gate
(`security_scorer` runs first; any fail → composite 0.0):

| Score | Weight | Measures |
|-------|--------|----------|
| DataScore | 0.45 | Output correctness vs golden `expected_data` |
| PathScore | 0.35 | Tool-call sequence vs golden `expected_path` |
| TokenEfficiency | 0.20 | `1 - min(tokens/baseline_tokens, 1)` |

**Composite** = `0.45×Data + 0.35×Path + 0.20×Token`

Binary fail reasons: prompt injection patterns in MCP responses, tools outside
the `allowed_tools` allowlist, suspicious URLs / credential harvesting, policy
violations (e.g. `execute_swap` during a quote-only benchmark).

Golden benchmarks live at `benchmarks/golden/{mcp}/{capability}.yaml`
(expected path, allowed tools, baseline tokens, expected data bounds, policy).
Evals run with [Inspect](https://inspect.aisi.org.uk/) (`packages/inspect-web3`),
and an HTTP service (`packages/eval-runner`) exposes "next benchmark" +
"run/poll eval" to the CRE workflow.

Source: https://github.com/vhspace/goldenmcp/blob/main/docs/scoring.md

## Attestation — CRE + Confidential AI semantics

- A Chainlink CRE workflow orchestrates the pipeline as **two event-driven
  handlers**: Handler A (HTTP run trigger) scores one benchmark via
  `eval-runner`, then submits the manifest to Confidential AI with a
  `cre_callback` and returns (no blocking). Handler B is a fresh execution
  started by CAI's callback.
- **The attestation is the completed TEE inference** — there is no synthetic
  tx hash. CAI processes the manifest inside the enclave; the pipeline records
  the CAI `inference_id` plus a `bytes32` **transcript hash** (the enclave's
  `response_digest`, falling back to `sha256(output)`) onchain via
  `recordAttestation`.
- When CAI/callbacks are unconfigured, Handler A falls back to an inline
  `runPipeline` (score → poll → publish → write) so the flow stays simulatable
  without secrets.

Source: `workflows/eval-pipeline/src/{pipeline,workflow}.ts`,
https://github.com/vhspace/goldenmcp/blob/main/docs/architecture.md

## Storage / registry / discovery (context)

- **Walrus** holds every score manifest + raw Inspect `.eval` log;
  `walrus://<blobId>` pointers are what ENS text records and the Arc registry
  reference.
- **Arc MCPRegistry** (`recordAttestation`, `updateCapabilityScore`) is the
  onchain reputation store; ERC-8004-inspired, Foundry contracts.
- **ENS ENSIP-25/26**: each scored MCP is a `*.goldenmcp.eth` subname with
  text records for agent context, MCP endpoint, and the Walrus eval blob; ENSv2
  TTL expiry marks stale identities.

## Import plan into zkx402

Target packages per `docs/unify/architecture.md`:

| goldenmcp source | Target here | Status |
|---|---|---|
| `packages/inspect-web3`, `benchmarks/golden`, `packages/eval-runner` | `packages/eval-engine` (Python, uv workspace alongside pnpm) | **stub added** (`zkx402-eval-engine`) |
| `workflows/eval-pipeline`, `contracts/mcp-registry`, `packages/walrus-client` | `packages/attestation` (pluggable attestor; proof-of-thought as second attestor later) | **stub added** (`zkx402-attestation`) |
| `contracts/mcp-registry` deploy scripts, ENS integration | `packages/discovery`, `apps/registry` | later issue |

Stubs pin only the scoring + record contracts (`SCORING_WEIGHTS`,
composite/binary-gate math, attestation record shape, transcript-hash rule) so
other packages can code against them before the real Python/CRE import lands.
The demo is intentionally untouched in this step.

## References

- https://github.com/vhspace/goldenmcp
- https://github.com/vhspace/goldenmcp/blob/main/docs/scoring.md
- https://github.com/vhspace/goldenmcp/blob/main/docs/architecture.md
