# JSON Specs (Policy + Proof Data)

This document defines the JSON formats used by the zkx402 demo for proof policy configuration.

It also describes how we compute integrity hashes and which scripts to run to validate the whole flow end-to-end.

## 1) Proof Policy JSON

### 1.1 File location (demo server)

- **Default path**: `apps/demo/server/proof-policy.json`
- **Override**: set `PROOF_POLICY_PATH` to a custom file path
- **Enable**: set `ENABLE_PROOF_POLICY=true` (otherwise `proofPolicy` is not attached to the route config)

### 1.2 Envelope format (recommended)

`apps/demo/server/proof-policy.json` should be an **envelope**:

```json
{
  "schema": "zkx402.proofPolicyEnvelope.v1",
  "policy": {
    "version": 1,
    "scope": "zkx402",
    "claims": [{ "type": "human" }],
    "allowedProviders": ["self"],
    "preferenceOrder": ["self"],
    "fallback": "none"
  },
  "integrity": {
    "hashAlg": "sha256",
    "hash": "<sha256(stableStringify(policy))>"
  }
}
```

### 1.3 `policy` object schema (v1)

- **`version`** (number): policy schema version (currently `1`)
- **`scope`** (string): app scope for semantics (e.g. `zkx402`)
- **`claims`** (array): canonical claims required by the policy (currently supports `{ "type": "human" }` for chain-only)
- **`allowedProviders`** (array of strings): allowlist of providers (v1 uses `["self"]`)
- **`preferenceOrder`** (array of strings): ordered preference (v1 uses `["self"]`)
- **`fallback`** (string): fallback behavior (v1 uses `"none"` to avoid off-chain/API fallback)

### 1.7 Self.xyz API verification (optional provider)

By default, zkx402 prefers **chain-based** verification (reliable, no vendor API dependency in the request hot path). If you explicitly want to verify Self claims via an off-chain API, enable the `self_api` provider in your policy and send a proof payload with the request.

- **Policy provider name**: `self_api`
- **Environment variables**:
  - `SELF_API_URL`: URL to POST verification requests to
  - `SELF_API_KEY` (optional): bearer token sent as `Authorization: Bearer ...`
  - `SELF_API_TIMEOUT_MS` (optional): request timeout (default 8000ms)
- **Request header**:
  - `X-Self-Proof`: JSON string containing the Self proof/session payload (passed through to the verifier as `proof`)
  - `X-ZK-Proof-Plan` (optional): JSON string that constrains which provider to use (useful when a claim is “soft” and multiple providers are allowed)

`X-ZK-Proof-Plan` shapes (v1):

```json
{ "provider": "self" }
```

or per-claim-key:

```json
{ "providers": { "human": "self_api" } }
```

Security note:

- If `PAYMENT-SIGNATURE` is **not** present (legacy: `X-PAYMENT`), the middleware will **avoid vendor API calls** and treat `X-Proof-Claims` as an *intent signal* (quote mode). Actual enforcement still occurs when the client submits payment + claims.

## 1.7.3 Route-level hard access control (deny unless claims verify)

Discounts (`variableAmountRequired`) are optional. If you need **hard-gated access** (deny the request unless claims verify), configure required claims on the route.

Two supported shapes:

### Shortcut form

Set:

- `config.extra.requiredClaims: [{ "type": "human" }]`

This implies `mode: "deny"` and will return **403** on paid requests if the claim(s) fail verification.

### Explicit (preferred for dashboards/UIs)

Set:

```json
{
  "accessControl": {
    "mode": "deny",
    "statusCode": 403,
    "requiredClaims": [{ "type": "human" }]
  }
}
```

Semantics:

- **Quote mode**: still returns `402` with `accepts[]` (and includes `accessControl` metadata under `accepts[].extra`).
- **Paid mode**: verifies required claims after payment verification; if any fail, returns:
  - HTTP `403`
  - JSON error body with which claim(s) failed and why.

Request body shape sent to `SELF_API_URL`:

```json
{
  "vendor": "self.xyz",
  "scope": "zkx402",
  "subject": { "walletAddress": "0xabc..." },
  "claim": { "type": "human" },
  "proof": { "sessionId": "..." }
}
```

Response handling:

- Any JSON response with `verified: true` or `valid: true` (or `success: true` without `error`) is treated as verified.

### 1.7.2 vlayer verification (API + chain providers)

We support vlayer as a **separate provider family** so apps can choose between:

- **`vlayer_chain`**: reliable request-path verification via **on-chain attestation lookup** (no vendor API calls)
- **`vlayer_api`**: direct verification by POSTing the proof payload to a verifier API (may be billed per request)

#### Provider names

- **Chain provider**: `vlayer_chain`
- **API provider**: `vlayer_api`

#### Canonical claim supported (v1)

- `{ "type": "origin_http_get" }`
  - Optional fields like `url` may be included for app-level UX/debugging, but the v1 cost key is just `origin_http_get`.

#### `vlayer_api` (off-chain verifier)

- **Environment variables**:
  - `VLAYERS_API_URL`: URL to POST verification requests to
  - `VLAYERS_API_KEY` (optional): bearer token sent as `Authorization: Bearer ...`
  - `VLAYERS_API_TIMEOUT_MS` (optional): request timeout (default 8000ms)
- **Request header**:
  - `X-Vlayer-Proof`: JSON string containing the vlayer proof/presentation payload (passed through to the verifier as `proof`)

Request body shape sent to `VLAYERS_API_URL`:

```json
{
  "vendor": "vlayer",
  "scope": "zkx402",
  "subject": { "walletAddress": "0xabc..." },
  "claim": { "type": "origin_http_get" },
  "proof": { "success": true, "data": "..." }
}
```

#### `vlayer_chain` (chain attestation lookup)

This provider assumes a proof was **verified + recorded** on-chain (e.g., by an attestor service), and the API server only needs to do a view call.

- **Environment variables**:
  - `VLAYERS_RPC_URL`: RPC URL for the chain where attestations are stored
  - `VLAYERS_PROOF_REGISTRY`: registry contract address with:
    - `isVerified(address subject, bytes32 claimHash) -> bool`

The `claimHash` is computed as:

- `sha256(stableStringify({ scope, claim }))`

## 1.8 Proof Cost JSON (separate schema; v1)

Proof verification can have a **real cost** (vendor API billing, infra, rate-limits). To keep pricing flexible (and compatible with future real-time quotes), we store proof verification costs in a **separate JSON schema** from `proofPolicy`.

### 1.8.1 File location (demo server)

- **Default path**: `apps/demo/server/proof-costs.json`
- **Override**: set `PROOF_COSTS_PATH`
- **Enable**: set `ENABLE_PROOF_COSTS=true`

### 1.8.2 Envelope format

```json
{
  "schema": "zkx402.proofCostEnvelope.v1",
  "costs": {
    "version": 1,
    "scope": "zkx402",
    "currency": "usd_micros",
    "defaultCommissionBps": 250,
    "entries": [
      { "provider": "self", "claimKey": "human", "costUsdMicros": "0" },
      { "provider": "self_api", "claimKey": "human", "costUsdMicros": "2500" }
    ]
  },
  "integrity": { "hashAlg": "sha256", "hash": "<sha256(stableStringify(costs))>" }
}
```

### 1.8.3 Units / web3 safety

- **`usd_micros`** is used to avoid floats:
  - `"1000000"` == **$1.00**
  - `"2500"` == **$0.0025**
- **v1 assumption**: endpoints are priced in **USDC (6 decimals)** so USD micros map 1:1 to USDC atomic units for fee calculation.
- If you price endpoints in a different asset, you’ll need an oracle/FX layer (not implemented yet).

### 1.8.4 Secrets (where to put them)

Do **not** put secrets in `proof-costs.json` or `proof-policy.json`. Use env vars:

- `SELF_API_URL` (public-ish, but keep in env for deploy flexibility)
- `SELF_API_KEY` (**secret**)
- `VLAYERS_API_KEY` (**future; secret**)


### 1.4 Integrity hashing (sha256 + stable stringify)

Integrity is computed as:

- Take the **`policy` object**
- Serialize using **stable stringify** (deterministic key ordering)
- Compute `sha256` over the resulting UTF-8 string
- Encode as lowercase hex

Pseudo-code:

```js
function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",")}}`;
}

const hashHex = sha256Hex(stableStringify(policy));
```

Where `sha256Hex(s)` is `sha256(s).toString("hex")`.

**Important**: The integrity hash is for **tamper detection**. It does not imply authenticity. Authenticity would require signing (see below).

### 1.5 Signing (optional, not implemented yet)

If/when we add signing, we will extend the envelope with something like:

- `integrity.signatureAlg` (e.g. `eip191`)
- `integrity.signature` (signature over `integrity.hash` or over `stableStringify(policy)`)
- a configured verification key/address on the server

### 1.6 Encryption (optional, usually unnecessary)

Proof policy is typically **not secret**. If we ever need encrypted-at-rest config, do it at the envelope layer.

Do **not** put secrets (API keys) into policy JSON; keep secrets in env vars.

## 2) Removed: institution proof JSON (deprecated)

Earlier iterations of this repo experimented with a hardcoded “institution proof” flow that loaded `proof.json` and called an external verifier.

This path has been **removed** in favor of a cleaner design:

- **Canonical claims** (`proofPolicy`) describe *what* you need.
- **Providers** describe *how* you verify it (chain-first, optional API).

If you need institution-like checks, model them as canonical claims + provider logic rather than a one-off JSON blob.

## 3) Scripts to run (how to validate)

### 3.1 One-command local validation (recommended)

Runs unit tests + local chain E2E:

```bash
cd apps/demo/local-chain
node run-e2e-test.js
```

This validates:

- policy JSON loads correctly (and integrity checks pass)
- 402 challenge flow
- EIP-3009 signing + settlement
- proofPolicy/router path for `human` (local `MockHumanRegistry` on Anvil)

### 3.2 Unit tests only

```bash
cd packages/x402-zkx402
npm test
```


