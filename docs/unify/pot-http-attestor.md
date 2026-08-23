# Proof-of-Thought — satellite HTTP attestor

Decision (issue #111): `vhspace/proof-of-thought` stays a **separate satellite
service**, consumed by this monorepo strictly over HTTP. See ADR-3 in
[`license-matrix.md`](license-matrix.md). Its 0G/Gensyn chain stack is still
stabilizing, so **no PoT code imports into this repo yet** — no `git subtree`,
no vendoring, and no 0G/Gensyn SDK dependencies in any workspace package.
The only contract between the two repos is the HTTP attestor boundary
documented here.

## Why a satellite

- **Stack mismatch:** PoT runs TEE-verified inference via 0G Compute, persists
  reports to 0G Storage, and coordinates agents over Gensyn AXL. This monorepo
  is EVM/x402-first.
- **Operational independence:** PoT can redeploy models or agents without a
  monorepo release, and vice versa.
- **Sequencing, not licensing:** per the owner directive licenses are not a
  constraint; the split is purely technical (see "What explicitly does NOT
  happen" in [`architecture.md`](architecture.md)).

## Boundary at a glance

```
zkx402 API server                     proof-of-thought service (satellite)
─────────────────────                 ────────────────────────────────────
proofs router ───HTTPS POST──────▶  POST /api/consensus   (SSE progress + report)
              ◀──report id + potHash──
verify / fetch ──x402 paid GET───▶  GET  /api/report/:id  ($0.01, base-sepolia)
              ◀──PoTReport + receipt──
audit ───────────GET─────────────▶  GET  /api/reports     (recent-report index)
health ──────────GET─────────────▶  GET  /api/status      (agents, wallet, registry)
```

## HTTP surface (observed 2026-08-22)

Source of truth: `src/server/api.ts` in `vhspace/proof-of-thought`.

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/consensus` | POST | open | Dispatch a query to N TEE agents; responds `text/event-stream` |
| `/api/report/:id` | GET | x402 ($0.01, base-sepolia) | Fetch one stored `PoTReport` plus payment receipt |
| `/api/reports` | GET | open | List recent reports (`id`, `potHash`, `consensusScore`, `modelCount`) |
| `/api/status` | GET | open | Health: agent/model list, payment wallet, registry address |

Notes:

- `POST /api/consensus` takes `{ "query": string, "network": "testnet" | "mainnet" }`
  and streams SSE events: `pipeline_started` → `agent_thinking` →
  `agent_responded` / `agent_error` → `consensus_reached` → report events.
- Each model response carries `teeVerified`, a TEE `teeSignature`, and an
  attestation URL from the enclave. The consensus engine aggregates agreement,
  then produces a `potHash` and a full `proofChain`.
- Reports are persisted to 0G Storage and registered on-chain by the PoT
  service itself (`PoTReportRegistry.sol`). Consumers never touch 0G directly.

## How zkx402 consumes it (planned provider — not implemented here)

When wired up, PoT becomes one more provider behind the existing pluggable
interface (`packages/x402-zkx402/src/proofs/router.js`, see
[`specs/PROOF_VERIFICATION_PLAN.md`](../specs/PROOF_VERIFICATION_PLAN.md)).
Sketch only:

```js
// future packages/x402-zkx402/src/proofs/providers/pot_http.js (illustrative)
{
  name: "pot_http",
  kind: "api", // like self_api/vouch_api: skipped during quote mode
  supportsClaims: ["origin_http_get"],
  async verifyOriginHttpGet({ claim }) {
    // POST /api/consensus → wait for consensus_reached
    // GET /api/report/:id (paid) → check potHash + proofChain against the claim
  },
}
```

Semantics that must hold when this lands:

- **Quote mode** (no `X-PAYMENT`): an `api`-kind attestor is not called; claims
  are quoted as verified for pricing (`quoted: true`) and the server replies
  `402`.
- **Paid mode:** verification runs for real; failed required claims return
  `403` via access control (see [`proof-concepts.md`](../proof-concepts.md)).
- **Config via env only** (e.g. `POT_BASE_URL`, optional `POT_API_KEY`) — never
  PoT/0G/Gensyn packages in any `package.json`.

## Rules of engagement

1. Do not import PoT source into this monorepo, or monorepo source into PoT,
   until its 0G/Gensyn stack stabilizes (ADR-3).
2. No 0G or Gensyn SDK dependencies anywhere under `apps/` or `packages/`.
3. Integration stays HTTPS (+ x402 for paid report fetch). If HTTP is not
   enough, extend PoT's own server — do not fork its internals here.
4. Migration step 6 in [`architecture.md`](architecture.md) covers adding a
   LICENSE to PoT and freezing this interface. Until then this document is the
   boundary of record.

## References

- [vhspace/proof-of-thought](https://github.com/vhspace/proof-of-thought)
- [`docs/repos/proof-of-thought.md`](../repos/proof-of-thought.md)
- [`docs/unify/architecture.md`](architecture.md)
- [`docs/unify/license-matrix.md`](license-matrix.md)
