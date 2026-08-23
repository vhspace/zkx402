# Unified Architecture — agent-economy

Living home is **vhspace/zkx402** (reuse this repo; do not create `agent-economy`).

Target: one coherent "agents pay agents for verified services" stack, assembled from
the existing hackathon prototypes. Per the owner directive (2026-08-22), all source
repos are the owner's code and license compatibility is a non-issue — components are
placed by **technical fit only**.

## Component map (source → target)

| Component | Source repo / path | Target package | Notes |
|---|---|---|---|
| x402 payment middleware | eXpress402 `src/`, goldenmcp `packages/` | `packages/x402-kit` | Merge the two divergent implementations into one middleware with a `PaymentRail` interface. |
| Proof-aware pricing (zk) | zkx402 `packages/`, middleware | `packages/x402-kit/proof-pricing` | Imported directly into the monorepo as an opt-in module — no HTTP boundary, no source-splitting. Fix the ISC-vs-GPL `package.json` hygiene bug during import. |
| Off-chain session channels | eXpress402 (Yellow Network) | `packages/x402-kit/channels` | Keep behind the `PaymentRail` interface so plain on-chain x402 is an alternative rail. |
| Paid MCP server scaffold | eXpress402 | `packages/mcp-server-kit` | MCP 1.9+ server with per-tool pricing, session accounting. |
| Eval engine (accuracy / tool-path / token efficiency) | goldenmcp `packages/`, `benchmarks/` | `packages/eval-engine` | Python — keep uv workspace alongside pnpm. |
| Attestation (Chainlink CRE + Confidential AI) | goldenmcp `contracts/`, `infra/` | `packages/attestation` | Pluggable attestor interface; PoT is a second attestor implementation later. |
| Registry (Arc) + discovery (ENS ENSIP-25/26) | goldenmcp `contracts/`, ENS integration | `packages/discovery`, `apps/registry` | Contracts stay Foundry; deployment scripts move to `apps/registry`. |
| Demo frontends | goldenmcp `apps/`, `demo/`; eXpress402 demo | `apps/demo` | One demo that shows: discover → pay → evaluate → attest. |
| TEE multi-model consensus | proof-of-thought `src/` | external service | Expose `POST /consensus` + proof-chain fetch; monorepo treats it as an attestor over HTTP. Separate for stack reasons (0G/Gensyn vs EVM), not license. Boundary: [`pot-http-attestor.md`](pot-http-attestor.md). |

## Runtime flows

### 1. Discovery → payment → attested eval (the golden path)

```
agent ──ENS lookup──▶ discovery pkg ──▶ MCP server record (Arc registry)
agent ──x402 USDC nanopay──▶ mcp-server-kit (target MCP)
eval-engine ──runs eval suite──▶ attestation pkg ──▶ Chainlink CAI
                                                 └─▶ (phase 2) proof-of-thought service
result ──▶ Walrus blob ──▶ Arc registry write ──▶ ENS text-record update
```

### 2. High-volume market data (eXpress402 path)

```
agent ──open Yellow channel (1 tx)──▶ session key
agent ──N× MCP queries, off-chain accounting──▶ mcp-server-kit
settle ──▶ channel close on-chain
```

### 3. Proof-gated API (zkx402 module, in-process)

```
agent ──▶ mcp-server-kit / any app using x402-kit
        └─ proof-pricing module: canonical proof claim check → discount / reject
```

Proof-aware pricing becomes a config flag on the shared middleware instead of a
separately deployed service. Apps that don't want it simply don't enable the module.

## Monorepo tooling

- **pnpm workspaces** for TS/JS (matches zkx402/eXpress402 conventions),
  **uv workspace** for the Python eval engine (matches goldenmcp `pyproject.toml`/`uv.lock`).
- **Foundry** for contracts (Arc), kept out of the JS build graph.
- CI: per-package change detection; contracts + eval-engine jobs only on relevant paths.
- Release: release-please (zkx402 already uses it) with per-package versioning.

## Migration order (safe, reversible)

1. Create `agent-economy` repo with a single LICENSE (MIT recommended; owner's
   call), workspace scaffolding, CI skeleton.
2. Import **eXpress402** history via `git subtree add` (preserves authorship).
3. Import **goldenmcp** the same way. Keep its Vercel demo deploy working.
4. Import **zkx402** the same way; fold its proof-aware pricing into
   `packages/x402-kit/proof-pricing` and fix its `package.json` license field as
   part of the import commit.
5. Extract `x402-kit` from the three codebases; delete duplicated middleware.
6. Add a LICENSE to **proof-of-thought** (single author — trivial) and define the
   attestor HTTP interface against it. No code moves.
7. Courtesy heads-up PRs/issues to outside contributors of the three imported
   repos (not a blocker — owner directive).
8. Archive source repos only after the monorepo CI is green and demos redeployed.

## What explicitly does NOT happen

- No deletion of hackathon repos (archive only, and only after migration proven).
- No proof-of-thought code moved into the monorepo before its chain stack
  stabilizes (technical sequencing, not licensing).
- lanzo-web and 3Dtapout are untouched.
