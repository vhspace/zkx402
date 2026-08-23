# vhspace/proof-of-thought

TEE-verified multi-model AI consensus ("PoW for intelligence"). Built for
ETHGlobal Open Agents 2026. Stays a **satellite HTTP attestor** — do not import
0G/Gensyn code until that stack stabilizes (ADR-3, issue #111).

Local clone: `~/Documents/repos/vhspace/proof-of-thought`
(default branch `main`; last commit 2026-04-27, merge of PR #27).

## Stack (verified 2026-08-22)

- TypeScript ESM + vitest (primary); small Python side (`scripts/setup.py`,
  flask/httpx/pydantic) for AXL nodes / MCP router setup
- 0G: `@0glabs/0g-serving-broker` (TEE-verified inference broker),
  `@0gfoundation/0g-ts-sdk` (storage/KV)
- Payments: `x402`, `x402-express`, `viem`, Uniswap v3/v4 SDKs; own contract
  `src/contracts/PoTReportRegistry.sol`
- Gensyn AXL used via HTTP client only (`src/agents/axl-client.ts`) — no SDK dep
- TEE attestation delegated to the 0G broker (`teeVerified`, `teeSignature`,
  `attestationUrl`) — no SGX/Gramine/Nitro code in-repo

## Service surface

- `POST /api/consensus` — `{query, network}`; SSE events: `pipeline_started`,
  `agent_thinking`, `agent_responded`, `consensus_reached`, `report_built`, `stored`
- `GET /api/reports`, `GET /api/report/:id`, `GET /api/status`
- Models (0G Compute): testnet `qwen/qwen-2.5-7b-instruct`; mainnet
  `deepseek/deepseek-chat-v3-0324`, `zai-org/GLM-5-FP8`, `qwen3.6-plus`
- Consensus is **lexical**, not LLM-judged: claim extraction → normalize/stem →
  keyword-overlap agreement score (`src/consensus/comparator.ts`)
- PoT Report carries `potHash` + proof chain; persisted to 0G Storage/KV and
  registered on-chain via `PoTReportRegistry`

## Deployment & hygiene

Dev-container only; runs locally via `npm run dev`. No `.github/workflows/` CI.
No LICENSE file on disk (README badge claims MIT) — trivial to add, single author.

## Role in unification

External attestor over HTTP: expose `POST /consensus` + proof-chain fetch;
monorepo's attestation package treats it as a second attestor implementation.
Define the HTTP interface contract in docs before any integration (issue #111).

## References

- https://github.com/vhspace/proof-of-thought
