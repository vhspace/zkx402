# zkx402-attestation (STUB)

> **Status: stub.** Pins the attestation record contract only — the real
> pipeline (Chainlink CRE workflow, Confidential AI TEE attestor, Walrus
> publishing, Arc registry writes) will be imported from
> [vhspace/goldenmcp](https://github.com/vhspace/goldenmcp). Do not build demo
> features on top of this yet.

## What this stub provides

- `ATTESTOR_KINDS` — `cai` (Chainlink Confidential AI, primary in goldenmcp)
  and `pot` (proof-of-thought HTTP consensus service, planned second attestor).
- `REGISTRY_CALLS` — the MCPRegistry entry points the CRE workflow writes to:
  `recordAttestation` + `updateCapabilityScore`.
- `emptyAttestationRecord()` / `isCompleteAttestation()` — record shape:
  `inference_id`, `transcript_hash`, `capability`, `score`, `walrus_blob`,
  `attestor`.
- `transcriptHash()` — goldenmcp's transcript-hash rule: use the enclave's
  `response_digest` when present; otherwise `sha256(output)`; always a
  `bytes32` hex string onchain.

## Key semantic (from goldenmcp)

The attestation **is** the completed TEE inference — there is no synthetic tx
hash. The eval manifest is scored inside the CAI enclave; the pipeline records
the CAI `inference_id` and the `bytes32` transcript hash via
`recordAttestation`.

## What will be imported later

| Source (vhspace/goldenmcp) | Purpose |
|---|---|
| `workflows/eval-pipeline/` | Two-handler CRE workflow (run trigger → CAI → callback) |
| `packages/walrus-client/` | `walrus://` blob storage for manifests + raw eval logs |
| `contracts/mcp-registry/` | ERC-8004-inspired registry (`recordAttestation`, `updateCapabilityScore`) |

## Notes

- See [`docs/repos/goldenmcp.md`](../../docs/repos/goldenmcp.md) for the full
  eval/attestation import notes.
- Run tests: `pnpm --filter zkx402-attestation test`
