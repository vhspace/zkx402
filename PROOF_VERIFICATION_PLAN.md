# Proof Verification Plan (Canonical Claims + Vendor Routing)

This document records the current design decisions for proof checking in `apps/demo/server/middleware.js` and the direction we’ll take to modularize proof verification.

It is intentionally a planning record (not final polished docs).

## Goals

- **Canonical claim model**: Express proof requirements in a vendor-neutral way (e.g., `human`, `age_gte(21)`), so routes describe *what is required* rather than *who verifies it*.
- **Modular verification**: Separate proof verification into:
  - **Chain-based verifiers** (read on-chain state)
  - **API/off-chain verifiers** (vendor verifier or self-hosted verifier)
- **Reliability-first**: Avoid hard dependency on vendor APIs in the request hot path.
- **Clear evolution path**: Rich claims should be representable today even if not yet enforceable, so we can stub the surface area and implement incrementally.
- **Auditability/debuggability**: Add structured audit/debug logging (stubbed initially) so verification decisions are inspectable.

## Non-goals (for the first iteration)

- Implementing full “rich claim” verification (age, country, OFAC, etc.)
- Adding production-grade audit logging storage (e.g., DB / SIEM)
- Enforcing “disclosure” semantics server-side (what the user reveals vs what is checked)

## Key Decisions

### 1) Canonical Claims (Vendor Neutral)

We will represent required proofs as canonical claims (internal representation) rather than vendor-specific strings.

Examples (illustrative; final schema TBD):

- `human == true`
- `age_gte(21)`
- `excluded_countries_not_contains(["US", "RU"])`
- `ofac_clear == true`

Routes and pricing config should reference these canonical claims (or a string form that maps 1:1 to the canonical model).

### 1.1) App-specific Semantics (Default)

Canonical claims are vendor-neutral, but we need a clear meaning for claims like “human” so they’re enforceable and upgradeable.

**Default**: app-specific semantics.

- Claim: `human == true`
- Policy: “human under zkx402’s scope/version and provider allowlist”

This avoids ambiguous “global humanity” assumptions (proved somewhere else under unknown rules).

We can optionally allow “any supported human provider” per-route by widening policy, without changing the claim model.

### 2) Chain-only Enforcement (Start Here)

For the first iteration, we will enforce only claims that can be satisfied purely by on-chain reads.

For Self specifically, “human” can be satisfied by reading a boolean from a Self receiver contract (e.g. `isVerified(address)`), which is chain-based and reliable.

**Any rich claim** (age, nationality, gender, OFAC, etc.) will return a **NOT IMPLEMENTED** result, even if the claim is representable in the canonical model.

### 2.1) Cross-chain Reality + Preferred Chain-only Strategy

Some proof systems keep their source-of-truth on chains that are not Base (e.g., Self state on Celo; other ecosystems may have their own chains).

Because a Base contract cannot directly read another chain’s state, chain-only “human” checks on Base require one of:

- a mirror/replica contract on Base (driven by cross-chain messaging), or
- a Base-native verifier + root update pipeline, or
- a Base receipt/attestation derived from a cross-chain proven event.

**Preferred engineering choice (chain-only)**: mirror/replicate the “human” receipt/state onto Base, then check that on Base.

Rationale: simplest Base-side check, good UX (one-time cost, cached thereafter), no vendor API dependency in the request hot path.

### 3) Vendor-neutral Proof Checking + Ordered Vendor Preference

We will keep the claim model vendor-neutral, but we still need a mechanism to decide *how* to satisfy a claim.

We will introduce a routing layer (conceptually “zkverify”) that:

- Accepts a canonical claim (or parsed form)
- Computes an ordered list of verification strategies (“providers”)
- Executes providers in order until one:
  - verifies the claim, or
  - returns an explicit “unsupported/not-implemented” result, or
  - fails (timeout/network/etc.)

Provider selection will support:

- **Hard preference**: only use provider X (fail if unavailable)
- **Soft preference**: try provider X first, then fallback to others
- **Order of preference**: explicit provider list `[self-chain, self-local-verifier, vendor-api]`

Initial implementation will only include **chain providers**.

### 3.1) Policy-driven Provider Allowlist + Preference Order

Even with app-specific semantics, we still want vendor neutrality at the claim layer.

We will express vendor/provider selection as policy:

- `allowedProviders`: list of acceptable providers for this endpoint (e.g., `["self"]`)
- `preferenceOrder`: ordered list to try when multiple providers are allowed (e.g., `["self", "worldcoin"]`)
- `mode`: “hard” vs “soft” preference / fallback behavior

### 3.2) Preference Modes

- **Hard**: only allow the first provider; fail if unavailable.
- **Soft**: try providers in order; allow fallback if preferred is unavailable.

### 3.3) Backend Configuration for x402 Endpoints (Web3-friendly)

We will keep x402 route configuration in code initially, but introduce a `proofPolicy` object that is:

- deterministic
- versioned
- hashable (for audit/debug)
- portable (can later be moved to JSON file, signed payload, or on-chain)

Suggested shape (conceptual, not final schema):

```json
{
  "version": 1,
  "scope": "zkx402",
  "claims": [
    { "type": "human" }
  ],
  "allowedProviders": ["self"],
  "preferenceOrder": ["self"],
  "fallback": "none"
}
```

We will compute a policy hash (e.g., keccak256 over a canonical JSON encoding) and include it in verification metadata and audit logs.

Optional later: sign policy objects with an “app policy key” and log signature + hash.

#### 3.3.1) JSON envelope (integrity-first; optional signing/encryption)

For “web3-friendly” distribution, the policy can be stored as a **portable JSON envelope**:

- **Versioned** via `schema` + `policy.version`
- **Hashable** via deterministic encoding (stable stringify)
- **Integrity-checked** via `integrity.hash`

Example (v1):

```json
{
  "schema": "zkx402.proofPolicyEnvelope.v1",
  "policy": { "version": 1, "scope": "zkx402", "claims": [{ "type": "human" }], "allowedProviders": ["self"], "preferenceOrder": ["self"], "fallback": "none" },
  "integrity": { "hashAlg": "sha256", "hash": "<sha256(stableStringify(policy))>" }
}
```

**Signing (optional later)**: add an `integrity.signature` (e.g., EIP-191 over the hash) and verify using an app public key.

**Encryption**: not required for web3-friendliness (policy is not a secret). If we ever need encrypted-at-rest config, do it at the envelope layer (and keep secrets like API keys in env vars).

### 4) Not Implemented Behavior for Rich Claims

Rich claims will return a structured “not implemented” outcome so we can:

- preserve the API surface and claim vocabulary now
- implement the actual verifiers later without changing route config format

This should be surfaced in:

- verification metadata attached to the request (for debug)
- any pricing/discount logic that depends on proofs (e.g., “not eligible because claim not implemented”)

### 5) Audit Logging and Debug Logging (Stub First)

We will add stubs for:

- **Audit log event**: a structured record containing
  - request correlation id
  - claim(s)
  - chosen provider order
  - provider results (success/failure/not-implemented)
  - decision (verified / not verified / not implemented)
  - timestamps + durations

- **Debug log**: verbose (developer-facing), gated behind an env flag

Initial version can log to stdout in structured JSON; later versions can send to persistent storage.

## Notes from Recent Discussion (Context)

- Age/country/OFAC are verification rules checked during proof generation/verification (not derivable from a boolean chain receipt alone). See `https://docs.self.xyz/frontend-integration/disclosure-configs`.
- In this repo, the client QR flow configures Self verification rules at QR generation time (e.g. `minimumAge: 21`), which can cause verification to fail before anything is bridged on-chain.
- Our current on-chain receiver integration (`ProofOfHumanReceiver.isVerified(address)`) is a boolean receipt; rich checks will remain “not implemented” until we add a verifier path.
- For local router-path testing, we deploy a tiny `MockHumanRegistry` (same `isVerified(address)` shape) on Anvil and point `BASE_PROOF_OF_HUMAN_RECEIVER` at it.

## Implementation Outline (Incremental)

### Phase 1: Refactor into Modules (No Behavior Change Except Stubs)

- Create a `proofs/` directory under `apps/demo/server/`:
  - `proofs/claims/*` (canonical claim parsing/model)
  - `proofs/chain/*` (chain checkers; start with Self)
  - `proofs/router/*` (provider selection and execution)
  - `proofs/audit/*` (audit/debug logging helpers)

- Migrate Self chain boolean check into `proofs/chain/self.js`.

- Modify the existing proof checking in `middleware.js` to:
  - parse requested proofs into canonical claims
  - route each claim through the chain-only router
  - return “not implemented” for rich claims

#### Implementation Notes (as built)

The initial implementation is done inside the `x402-zkx402` package (runtime path for the demo server):

- `packages/x402-zkx402/src/proofs/claims.js`: legacy `zkproofOf(...)` -> canonical claim parsing (v1 supports `human`; others map to NOT_IMPLEMENTED).
- `packages/x402-zkx402/src/proofs/policy.js`: `proofPolicy` normalization + stable stringify (audit/debug hash stub).
- `packages/x402-zkx402/src/proofs/providers/self_chain.js`: Self chain provider (reads `isVerified(address)`).
- `packages/x402-zkx402/src/proofs/router.js`: chain-only router; only `human` is enforceable in v1.
- `packages/x402-zkx402/src/proofs/audit.js`: stub audit/debug logging + correlation id + policy hash (sha256).

Wiring:

- `packages/x402-zkx402/src/middleware.js` uses canonical routing **only when** `extra.proofPolicy` is provided for the route.
- If `extra.proofPolicy` is omitted, behavior falls back to the legacy string-based proof checks (to preserve backwards compatibility).

Env flags:

- `ZKX402_AUDIT_LOG=true` enables JSON stdout audit events.
- `ZKX402_DEBUG_LOG=true` enables JSON stdout debug events.
- `ENABLE_PROOF_POLICY=true` (demo server) enables adding `extra.proofPolicy` for `/motivate`.

Required request fields for chain providers:

- `X-Wallet-Address` header (or `?wallet=` query param) is used as the subject for chain-based checks.

### Phase 2: Add Provider Ordering Configuration

- Add config format for provider preference:
  - global defaults (env/config)
  - per-route override (optional)

- Store the provider decision + results in request verification metadata for later use.

### Phase 3: Add Rich Claim Verification (Later)

When we’re ready:

- Implement additional providers:
  - self-hosted verifier (preferred over vendor SaaS)
  - vendor API verifier (optional fallback)

- Decide which rich claims are enforceable and how:
  - which are “rules” (enforced)
  - which are “disclosures” (optional reveal, not enforced)

## Notes / References

- Self “Disclosure Configs” describes `minimumAge`, `excludedCountries`, `ofac` as verification rules and distinguishes them from data disclosures: `https://docs.self.xyz/frontend-integration/disclosure-configs`
- Self repo README describes attribute-level proofs (e.g., nationality, DOB, gender) and “humanity only” use cases: `https://github.com/selfxyz/self`
