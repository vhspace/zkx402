# Proof-of-Thought HTTP attestor contract

**Status:** contract of record for issue [#116](https://github.com/vhspace/zkx402/issues/116)
**Version:** 1.0.0-draft (pre-freeze)
**Attestor repo:** [vhspace/proof-of-thought](https://github.com/vhspace/proof-of-thought)
**Boundary decision:** [`pot-http-attestor.md`](pot-http-attestor.md) (ADR-3)

This document pins the wire contract between the zkx402 monorepo (consumer)
and the `proof-of-thought` satellite service (attestor). It is a **spec
only**: no PoT/0G/Gensyn code is imported into this monorepo, now or later
(see [Rules of engagement](pot-http-attestor.md#rules-of-engagement)).

The key words MUST, MUST NOT, SHOULD, and MAY are to be interpreted as
described in RFC 2119.

---

## 1. Scope and conformance

The contract covers exactly four endpoints:

| # | Endpoint | Method | Auth | Purpose |
|---|---|---|---|---|
| 1 | `/api/consensus` | POST | open | Dispatch a query to N TEE agents; responds `text/event-stream` |
| 2 | `/api/report/:id` | GET | x402 ($0.01, base-sepolia) | Fetch one stored `PoTReport` + payment receipt |
| 3 | `/api/reports` | GET | open | Recent-report index |
| 4 | `/api/status` | GET | open | Health: agents, wallet balance, registry address |

Anything outside this surface (0G Storage internals, Gensyn AXL coordination,
`PoTReportRegistry.sol` calls) is **behind the boundary**. The consumer MUST
NOT depend on it. The attestor persists reports to 0G Storage and registers
`potHash`es on-chain itself; consumers never touch 0G directly.

Conformance target for this version: service behavior observed 2026-08-22
(`src/server/api.ts`, `src/types/index.ts` at
[vhspace/proof-of-thought](https://github.com/vhspace/proof-of-thought)),
restated as normative requirements so the interface can be frozen before
integration.

## 2. General conventions

- **Base URL** is configured on the consumer via env only: `POT_BASE_URL`
  (required), optional `POT_API_KEY` (sent as `Authorization: Bearer <key>`
  when present). No PoT/0G/Gensyn packages in any monorepo `package.json`.
- **Encoding:** request/response bodies are UTF-8 JSON (`application/json`)
  except endpoint 1, which streams `text/event-stream`.
- **Timestamps:** ISO 8601 UTC strings (`2026-08-22T12:00:00.000Z`).
- **Durations:** numbers, milliseconds.
- **Report ids:** form `pot-<unix_ms>-<6 base36 chars>`; opaque to consumers,
  who MUST treat them as such.
- **Network selector:** wherever `network` appears it is
  `"testnet" | "mainnet"`; omitted means `"testnet"`.
- **Money fields** (`price`, `amount`) are display strings; the machine
  source of truth for the paid fetch is the x402 accepts payload from the
  `402` response.

## 3. Endpoints

### 3.1 `POST /api/consensus`

Request:

```json
{ "query": "string (required)", "network": "testnet" }
```

Response: `200 OK`, `Content-Type: text/event-stream`,
`Cache-Control: no-cache`. Body is a sequence of SSE frames per §4. The
stream ends with exactly one terminal event (`report_complete` or `error`)
and then closes.

Validation failures (missing/empty `query`) return
`400 {"error":"<message>"}` before any stream opens.

Consumer usage: buffer events; await `report_complete`. The planned provider
(`pot_http`, kind `"api"`) awaits `report_complete`, then performs the paid
report fetch of §3.2.

### 3.2 `GET /api/report/:id`

x402-gated at `$0.01` USDC on `base-sepolia`; standard x402 flow:

- No `X-PAYMENT` header → `402` with the x402 accepts payload.
- Valid `X-PAYMENT` → `200` below.
- Unknown id → `404`.

Success response:

```json
{
  "report": { "...": "PoTReport, see §5" },
  "receipt": {
    "reportId": "pot-...",
    "potHash": "0x…",
    "amount": "$0.01",
    "network": "base-sepolia",
    "proofChain": [
      { "model": "m", "provider": "p", "chatID": "c",
        "teeVerified": true, "teeSignature": "0x…" }
    ],
    "consensusScore": 0.87,
    "timestamp": "2026-08-22T12:00:00.000Z"
  }
}
```

### 3.3 `GET /api/reports`

Open. Index of recent reports (bounded retention window):

```json
{
  "reports": [
    {
      "id": "pot-...",
      "query": "…",
      "timestamp": "2026-08-22T12:00:00.000Z",
      "consensusScore": 0.87,
      "modelCount": 3,
      "potHash": "0x…",
      "storedOn": "0g://<rootHash>"
    }
  ],
  "paymentInfo": { "price": "$0.01", "network": "base-sepolia" }
}
```

`storedOn` MAY be absent while storage is pending. Audit/listing only — no
proof material here.

### 3.4 `GET /api/status?network=testnet`

Open. Health + capability discovery:

```json
{
  "wallet": "0x…",
  "balance": "0.123",
  "network": "testnet",
  "agents": [
    { "name": "agent-a", "model": "qwen/qwen-2.5-7b-instruct",
      "provider": "0g-compute", "status": "idle" }
  ],
  "registryAddress": "0x…"
}
```

Consumers SHOULD call this before dispatching consensus to fail fast on
misconfiguration. `registryAddress` may be empty; on-chain registration is
then skipped by the attestor.

## 4. SSE event schema

### 4.1 Framing

Named SSE events, UTF-8, each frame `\n\n`-terminated:

```
event: <event-name>
data: <single-line JSON object>

```

Exactly one `data:` line per frame, holding one JSON object. Consumers parse
by event name and MUST tolerate unknown event names (forward compatibility).

### 4.2 Event order

```
pipeline_started
  → agent_thinking*                    one per configured agent
  → (agent_responded | agent_error)*   one per agent attempt
  → consensus_reached                  only if ≥1 agent responded
  → report_built
  → stored | store_error               storage outcome
  → storage_verified                   when stored
  → chain_registered | chain_error     when registry configured
  → report_complete                    terminal, success path
```

Terminals: `report_complete` (success), `error` (failure). `error` may occur
at any point after `pipeline_started`. After a terminal event the server
closes the stream.

### 4.3 Event payloads

| Event | Payload fields |
|---|---|
| `pipeline_started` | `query: string`, `network`, `wallet: string`, `balance: string`, `modelCount: number` |
| `agent_thinking` | `name: string`, `model: string`, `provider: string` |
| `agent_responded` | `name`, `model`, `provider`, `content: string`, `chatID: string`, `teeVerified: boolean\|null`, `teeSignature: TEESignature\|null` (§5.2), `attestationUrl: string`, `timings: Timings` (§5.4), `timestamp: string` |
| `agent_error` | `name`, `model`, `error: string` |
| `consensus_reached` | `agreementScore: number` in [0,1], `convergedClaims: Claim[]`, `divergences: Divergence[]` (§5.3), `timings: { models, consensus }` |
| `report_built` | `id: string`, `potHash: string`, `proofChain: ProofChainEntry[]` (§5.1) |
| `stored` | `txHash: string`, `rootHash: string`, `storedOn: "0g://<rootHash>"`, `duration: number` |
| `store_error` | `error: string` |
| `storage_verified` | `verified: boolean`, `error: string \| null` |
| `chain_registered` | `txHash: string`, `blockNumber: number` |
| `chain_error` | `error: string` |
| `report_complete` | `report: PoTReport` (§5.1), `totalTime: number`, `reportUrl: "/api/report/<id>"`, `paymentInfo: { price, network, payTo }` |
| `error` | `message: string` |

Semantics the consumer relies on:

- `teeVerified === true` with a non-null `teeSignature` means that individual
  model response was TEE-verified by the serving broker; `attestationUrl`
  points at the enclave attestation for audit.
- Consensus is **lexical** (claim extraction → normalize/stem → keyword
  overlap), not LLM-judged. Consumers MUST NOT present `agreementScore` as an
  LLM-judged verdict.
- Zero successful agent responses ⇒ `error`; the stream never reaches
  `consensus_reached`.
- Storage/on-chain steps are best-effort: `store_error` / `chain_error`
  reduce durability but do not invalidate the report or its `potHash`.

## 5. Report JSON schema

### 5.1 `PoTReport`

```jsonc
{
  "id": "pot-1755772800000-x7f2k1",   // §2 id rule
  "query": "…",
  "timestamp": "2026-08-22T12:00:00.000Z",
  "responses": [                       // ModelResponse[], §5.4 order preserved
    {
      "model": "qwen/qwen-2.5-7b-instruct",
      "provider": "0g-compute",
      "content": "…full model answer…",
      "chatID": "…",
      "teeVerified": true,
      "teeSignature": {                // TEESignature | null, §5.2
        "text": "…", "signature": "0x…", "signing_address": "0x…",
        "signing_algo": "…", "provider_type": "…",
        "provider_identity": "…", "tls_cert_fingerprint": "…"
      },
      "attestationUrl": "https://…",
      "timestamp": "2026-08-22T12:00:01.200Z",
      "timings": {                     // Timings, §5.4
        "inference": 900, "verification": 40,
        "signatureFetch": 60, "total": 1000
      }
    }
  ],
  "consensus": {                       // ConsensusResult, §5.3
    "agreementScore": 0.87,
    "convergedClaims": [
      { "text": "…claim…", "modelsAgreeing": ["agent-a"], "confidence": 0.9 }
    ],
    "divergences": [
      { "topic": "…", "positions": [{ "model": "agent-a", "stance": "…" }] }
    ]
  },
  "proofChain": [                      // ProofChainEntry[]; one per response
    {
      "model": "qwen/qwen-2.5-7b-instruct",
      "provider": "0g-compute",
      "chatID": "…",
      "teeVerified": true,
      "teeSignature": "0x…"            // signature hex only, null if absent
    }
  ],
  "potHash": "0x…64 hex…",             // keccak256, definition below
  "storedOn": "0g://<rootHash>"        // optional; set once storage completes
}
```

**`potHash` definition.** `potHash = keccak256(utf8Bytes(canonicalInput))`
where `canonicalInput` is `JSON.stringify` of an object with exactly these
keys and values:

- `query`: the report's `query`
- `timestamp`: the report's `timestamp`
- `responses`: array of, per original response order,
  `{ model, provider, content, chatID, teeSignature, teeVerified }` where
  `teeSignature` is the TEESignature `signature` hex (or undefined/null)
- `consensus`: the full `ConsensusResult`

Consumers SHOULD recompute and compare `potHash` after a paid fetch; a
mismatch is a failed claim. The hash covers content + TEE signatures +
consensus verdict — it is the unit of on-chain registration.

### 5.2 `TEESignature`

| Field | Type | Meaning |
|---|---|---|
| `text` | string | signed payload text |
| `signature` | string | signature hex (this value alone goes into `proofChain`) |
| `signing_address` | string | signer address |
| `signing_algo` | string | e.g. ECDSA scheme identifier |
| `provider_type` | string | enclave/broker provider class |
| `provider_identity` | string | provider identity string |
| `tls_cert_fingerprint` | string | TLS cert fingerprint of the endpoint |

Nullability: `ModelResponse.teeSignature` and `.teeVerified` are nullable;
a `null` means verification was not performed for that response.

### 5.3 Consensus types

- `Claim`: `{ text: string, modelsAgreeing: string[], confidence: number }` —
  a claim extracted from answers, which models agree with it, confidence in
  [0,1].
- `Divergence`: `{ topic: string, positions: [{ model: string,
  stance: string }] }` — where agents disagree.
- `agreementScore`: keyword-overlap agreement across responses, in [0,1].

### 5.4 Shared objects

- `Timings`: `{ inference, verification, signatureFetch, total }` — numbers,
  ms.
- `ModelResponse` field order in `report.responses` matches agent dispatch
  order; consumers SHOULD NOT rely on it beyond display.

## 6. Error codes

| Status | Where | Meaning / consumer action |
|---|---|---|
| `400` | POST `/api/consensus` body check | Missing/empty `query` (or malformed JSON). Fix request; do not retry unchanged. |
| `402` | GET `/api/report/:id` | x402 payment required. Body is the x402 accepts payload; client signs payment and retries with `X-PAYMENT`. |
| `403` | consumer-side gate (zkx402) | Required proof claims failed after paid verification. Never returned by PoT itself; produced by zkx402 access control. |
| `404` | GET `/api/report/:id` | Unknown/expired report id (retention window). Re-run consensus if still needed. |
| `500` | any endpoint | Attestor internal error (`{"error": "<message>"}`). Retry with backoff; treat repeated 500s as attestor outage. |

Stream-level failures (SSE): transport errors before terminal event are
incomplete runs — discard state; there is no resume. An `error` event is
terminal and carries `message`.

## 7. Consumer requirements (zkx402 side)

When the planned `pot_http` provider lands behind
`packages/x402-zkx402/src/proofs/router.js`:

1. **Quote mode** (no `X-PAYMENT`): `api`-kind attestor is not called; claims
   quoted as verified (`quoted: true`); reply `402`. No network calls to PoT.
2. **Paid mode**: run §3.1 to completion, fetch §3.2, verify `potHash` against
   recomputation and check `proofChain` TEE entries against the required
   claims; failures yield `403` via access control.
3. **Config via env only** (`POT_BASE_URL`, optional `POT_API_KEY`). No
   PoT/0G/Gensyn SDK dependencies, ever.

## 8. Versioning and freeze

- This spec is versioned in its header. Additive changes (new optional
  fields, new SSE event names) bump the minor version; breaking changes
  (field removal/retype, event semantic change, price/network change) bump
  major and require updating this file plus `pot-http-attestor.md` together.
- Migration step 6 in [`architecture.md`](architecture.md) freezes this
  interface once `vhspace/proof-of-thought` gains a LICENSE. Until then,
  this document plus the observed behavior of its `src/server/api.ts` are
  the contract of record.

## References

- [vhspace/proof-of-thought](https://github.com/vhspace/proof-of-thought)
  (source of truth: `src/server/api.ts`, `src/types/index.ts`,
  `src/consensus/report.ts`)
- [`docs/unify/pot-http-attestor.md`](pot-http-attestor.md) — boundary decision
- [`docs/unify/architecture.md`](architecture.md) ·
  [`docs/unify/license-matrix.md`](license-matrix.md)
- [`docs/specs/PROOF_VERIFICATION_PLAN.md`](../specs/PROOF_VERIFICATION_PLAN.md)
  — planned `pot_http` provider slot
- x402 payment protocol: https://www.x402.org
