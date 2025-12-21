# JSON Specs (Policy + Proof Data)

This document defines the JSON formats used by the zkx402 demo for proof policy configuration and (legacy) institution proof verification input.

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

## 2) Institution Proof JSON (legacy)

### 2.1 File location (repo)

- `apps/demo/proof.json`

This file is a captured proof payload used by the legacy “institution=NYT” verifier path.

### 2.2 Loader behavior

The middleware attempts to load `proof.json` from these candidate paths:

- `packages/x402-zkx402/proof.json` (if a consumer places it next to the package)
- `<cwd>/proof.json`
- `<cwd>/apps/demo/proof.json` (this repo’s layout)

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


