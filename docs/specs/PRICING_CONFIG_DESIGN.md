# Configurable Pricing Design — Suggestions

*For GitHub issue #23 and frontend-controlled backend use cases*

## Goal

Move pricing from **in-code route config** to a **JSON-backed, extensible** model so:

- Operators can edit pricing without deploying
- A frontend can drive config via API (admin UI → backend)
- Per-URL (or per-route-pattern) pricing is supported

---

## Current state

Pricing is embedded in route config in `server/index.js`:

```js
"GET /motivate": {
  price: "$0.01",
  config: {
    extra: {
      variableAmountRequired: [
        { requiredClaims: [{ type: "human" }], amountRequired: "5000" },
        { requiredClaims: [{ type: "origin_http_get" }], amountRequired: "4000" },
      ],
      proofPolicy: PROOF_POLICY,
      proofCosts: PROOF_COSTS,
    },
  },
}
```

`proof-policy.json` and `proof-costs.json` already exist; they are loaded at startup and merged into route config.

---

## Proposed: JSON route config

### 1. Route config file (per-URL pricing)

```json
{
  "schema": "zkx402.routeConfigEnvelope.v1",
  "routes": {
    "GET /motivate": {
      "price": "$0.01",
      "network": "base-sepolia",
      "config": {
        "description": "get a motivational quote",
        "extra": {
          "variableAmountRequired": [
            { "requiredClaims": [{ "type": "human" }], "amountRequired": "5000" },
            { "requiredClaims": [{ "type": "origin_http_get" }], "amountRequired": "4000" }
          ],
          "proofPolicyRef": "default",
          "proofCostsRef": "default"
        }
      }
    },
    "GET /motivate-gated": {
      "price": "$0.01",
      "network": "base-sepolia",
      "config": {
        "description": "motivational quote (requires payment + verified human proof)",
        "extra": {
          "requiredClaims": [{ "type": "human" }],
          "proofPolicyRef": "default",
          "proofCostsRef": "default"
        }
      }
    },
    "GET /api/:resource": {
      "price": "$0.005",
      "network": "base-sepolia",
      "config": {
        "description": "Dynamic resource API"
      }
    }
  }
}
```

- **Refs**: `proofPolicyRef` / `proofCostsRef` point to named configs (e.g. `default`, `premium`) so policy and cost files stay reusable.
- **Patterns**: `GET /api/:resource` allows per-path-pattern pricing.

---

### 2. Loader contract

```js
// loadRouteConfig(path) → { routes, schema }
// - Reads JSON from file
// - Resolves proofPolicyRef / proofCostsRef by name
// - Returns routes object compatible with paymentMiddleware(payTo, routes, ...)
```

---

### 3. Extensibility for frontend-controlled backend

| Use case | Approach |
|----------|----------|
| **Config from file** | `ROUTE_CONFIG_PATH` env var; default `routes.json` |
| **Config from DB** | `loadRouteConfig` becomes async; fetches from DB or config service |
| **Config from API** | Admin API `POST /admin/config/routes` writes to DB or triggers reload; `loadRouteConfig` reads from same store |
| **Hot reload** | `fs.watch` or webhook on config change → `loadRouteConfig()` → re-inject routes into middleware |
| **Per-tenant** | `routes` keyed by tenant ID or scope; middleware selects tenant from request (e.g. `X-Tenant` header or subdomain) |

---

### 4. API design for admin UI

```
GET  /admin/config/routes     → current route config (read-only)
PUT  /admin/config/routes     → replace route config (role-gated)
PATCH /admin/config/routes    → merge/patch (partial update)
GET  /admin/config/policies   → list proof policy names
GET  /admin/config/costs      → list proof cost config names
```

- Auth: admin/operator role required
- Validation: JSON schema for routes; reject invalid `variableAmountRequired`, negative prices, etc.
- Audit: log who changed what, when (issue #23)

---

### 5. Schema validation

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["routes"],
  "properties": {
    "routes": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["price", "network"],
        "properties": {
          "price": { "type": "string", "pattern": "^\\$[0-9]+\\.?[0-9]*$" },
          "network": { "type": "string" },
          "config": { "type": "object" }
        }
      }
    }
  }
}
```

- Validate on load and on admin API write
- Enforce: no empty URLs, no negative prices, valid `amountRequired` strings

---

### 6. Migration path

1. **Phase 1**: Add `loadRouteConfig(path)`; read `routes.json` if present; fall back to in-code routes if not.
2. **Phase 2**: Move demo routes from `index.js` into `routes.json`; keep `index.js` thin.
3. **Phase 3**: Add admin API + DB/store if needed; add fs/watch or webhook for reload.

---

## Web3 config options

For a web3-native application, JSON config can be managed in decentralized ways:

| Approach | Pros | Cons |
|----------|------|------|
| **IPFS** | Content-addressed (CID); immutable config; pin via Pinata/Infura; fetch via gateway or `ipfs://` | Need gateway or ipfs-http-client; config updates = new CID |
| **ENS** | Human-readable; store JSON or IPFS CID in text record; resolve via `eth_call` or library | Cost to register/update; on-chain gas |
| **Arweave** | Permanent storage; pay once | Not designed for frequent updates |
| **Smart contract** | Store config hash or URI on-chain; config on IPFS; verify integrity on load | Gas cost; deploy/config updates on-chain |
| **Ceramic** | Decentralized composable data; streams; mutable by default | Extra dependency; different data model |

**Practical flow (IPFS + ENS):**

1. Store `routes.json` on IPFS → get CID (e.g. `Qm...`).
2. Set ENS text record: `config.yourapp.eth` → `ipfs://Qm...` (or raw JSON).
3. Loader: resolve ENS → fetch from IPFS gateway → parse and validate.
4. On update: upload new JSON → new CID → update ENS record (or use mutable Ceramic stream).

**Integrity:** Use envelope schema + `integrity.hash` (like proof-policy) so loader can verify config wasn’t tampered with in transit.

---

## References

- Issue #23: Build provider configuration UI (pricing + endpoints)
- `docs/specs/JSON_SPECS.md` — proof policy and cost schema
- `apps/demo/server/proof-policy.json`, `proof-costs.json`
