# zkx402-eval-engine (STUB)

> **Status: stub.** Pins the goldenmcp scoring contract only — the real engine
> is Python (Inspect + scorers + golden benchmarks) and will be imported from
> [vhspace/goldenmcp](https://github.com/vhspace/goldenmcp) into a **uv
> workspace** alongside pnpm (per `docs/unify/architecture.md`). Do not build
> demo features on top of this yet.

## What this stub provides

- `SCORING_WEIGHTS` — goldenmcp composite weights: DataScore 0.45,
  PathScore 0.35, TokenEfficiency 0.20.
- `compositeScore()` / `tokenEfficiency()` / `scoreRun()` — reference math for
  the composite and the binary security gate (any fail → composite 0.0).
- `emptyManifest()` — score-manifest shape incl. Walrus blob pointer +
  attestation linkage (`attestation_id`, `transcript_hash`) that the
  attestation package writes to the registry.

Binary-fail reasons mirrored from goldenmcp's `security_scorer`: prompt
injection, disallowed tools, suspicious URLs, policy violations.

## What will be imported later

| Source (vhspace/goldenmcp) | Purpose |
|---|---|
| `packages/inspect-web3/` | Inspect tasks + scorers (data/path/token/security) |
| `benchmarks/golden/{mcp}/{capability}.yaml` | Golden expected path/data/tool allowlists |
| `packages/eval-runner/` | HTTP service the CRE workflow calls |
| `docs/scoring.md` | Scoring spec |

## Notes

- See [`docs/repos/goldenmcp.md`](../../docs/repos/goldenmcp.md) for the full
  eval/attestation import notes.
- Run tests: `pnpm --filter zkx402-eval-engine test`
