# x402-zkx402

> Zero-knowledge proof verification middleware for the x402 protocol

`x402-zkx402` extends the [x402 payment protocol](https://x402.org) with **proof-aware pricing**.

Routes can quote/charge different prices based on **canonical proof claims** (starting with chain-first “human”), while keeping verification modular (chain checks first, optional API checks when explicitly enabled).

## Features

- ✅ **zkProof-Gated Discounts** - Offer different prices based on verified credentials
- ✅ **Web3-first units** - Pricing math uses atomic units + USD micros (no floats)
- ✅ **Policy-driven routing** - Vendor-neutral claims with provider allowlists + preference order
- ✅ **Drop-in Replacement** - Works with existing x402 infrastructure
- ✅ **Multiple claim types (opt-in)** - Human (chain), plus richer claims via API provider when configured
- ✅ **Cross-chain Compatible** - Works with Base, Celo, and other EVM chains
- ✅ **vouch support (API + chain)** - Verify “web origin” proofs via `vouch_api` or chain-first `vouch_chain`

## Installation

```bash
npm install x402-zkx402 express viem
```

### Facilitator integration (important)

`paymentMiddleware(payTo, routes, facilitator, paywall)` accepts **either**:

1) A **facilitator client object** (used as-is) with functions:

- `verify(decodedPayment, paymentRequirements)`
- `settle(decodedPayment, paymentRequirements)`
- `supported()`

This is what the demo uses via `@coinbase/x402` (CDP).

2) A **facilitator config object** (passed through to `x402`’s `useFacilitator(...)`), if you are using a hosted facilitator implementation.

If you're using the CDP facilitator client, install `@coinbase/x402` too.

## Quick Start

```javascript
import express from 'express';
import { paymentMiddleware } from 'x402-zkx402';
import { facilitator } from '@coinbase/x402';

const app = express();

// Apply zkproof-enabled payment middleware
app.use(paymentMiddleware(
  '0xYourWallet',  // Receiver address
  {
    "GET /api/data": {
      price: "$0.01",  // Default price
      network: "base-sepolia",
      config: {
        description: "Access to verified data",
        extra: {
          // REQUIRED for secure proof-gated pricing
          proofPolicy: {
            version: 1,
            scope: "zkx402",
            claims: [{ type: "human" }],
            allowedProviders: ["self"],
            preferenceOrder: ["self"],
            fallback: "none"
          },
          // Users who satisfy the required claims get 50% discount
          variableAmountRequired: [
            {
              requiredClaims: [{ type: "human" }],
              amountRequired: "5000"  // 0.005 USDC
            }
          ]
        }
      }
    }
  },
  facilitator  // Facilitator client (verify/settle/supported)
));

// Protected endpoint
app.get("/api/data", (req, res) => {
  const verification = req.verificationMetadata;

  res.json({
    data: "Your protected data",
    discount: verification?.discountApplied ? "50% off" : "none"
  });
});

app.listen(3001);
```

### v2 `accepts[]` route config

You can provide v2 payment requirements directly:

```js
"GET /api/data": {
  accepts: [
    {
      scheme: "exact",
      network: "base-sepolia",
      amount: "10000",
      payTo: "0xYourWallet",
      asset: "0xUSDC",
      extra: { name: "USDC", version: "2" },
    },
  ],
  config: {
    extra: {
      proofPolicy: { /* ... */ },
      variableAmountRequired: [ /* ... */ ],
    },
  },
},
```

Notes:

- `config.extra` (proofPolicy, proofCosts, accessControl, etc.) is applied to **every** entry in `accepts[]`.
- If an `accept.extra` field is present, it is merged first; route-level `config.extra` then overrides conflicting keys.
- Discounts from `variableAmountRequired` are applied uniformly to all `accepts[]` entries.

## Configuration

### Variable Amount Required (Discounts)

Offer different prices based on verified claims:

```javascript
extra: {
  variableAmountRequired: [
    {
      requiredClaims: [{ type: "human" }],
      amountRequired: "5000"  // 0.005 USDC
    }
  ]
}
```

**How it works:**
1. Middleware checks each discount tier in order
2. First matching tier is applied
3. If no claim set matches, full price is charged
4. Discounts are only applied when the server is configured to verify claims (`proofPolicy`)

Security note:

- If you omit `proofPolicy`, discounts are **disabled by default** (to avoid insecure “self-asserted proofs”).

### Access control (hard proof-gating)

If you want to **deny access unless proofs verify** (not just discount pricing), configure required claims on the route:

```js
extra: {
  proofPolicy: {
    version: 1,
    scope: "zkx402",
    allowedProviders: ["self"],
    preferenceOrder: ["self"],
    fallback: "none",
  },
  // Shortcut form (implies deny-on-failure):
  requiredClaims: [{ type: "human" }],
  // Preferred explicit form for dashboards/UIs:
  // accessControl: { mode: "deny", statusCode: 403, requiredClaims: [{ type: "human" }] },
}
```

Behavior:

- In **quote mode** (no `X-PAYMENT`), the server still returns `402` with `accepts[]`.
- In **paid mode**, after payment verifies, the server verifies required claims and returns **403** if they fail.

#### Quote-mode vs paid-mode for API providers (important)

When a route’s `proofPolicy` allows an **API provider** (e.g. `self_api`, `vouch_api`):

- **Quote mode** (no `X-PAYMENT`):
  - the middleware **does not call** the vendor API
  - the claim is treated as **quoted** (assumed verified for pricing) so the client can see the intended discount + any verification fees/commission
- **Paid mode** (with `X-PAYMENT`):
  - the middleware performs the real verification (including vendor API calls when configured)
  - `requiredClaims` / `accessControl` are enforced *after* payment verification (returning `403` on failure)

### Content Metadata

Attach zkproof-like strings as metadata (not enforced by this middleware):

```javascript
extra: {
  contentMetadata: [
    { proof: "zkproof(verified-journalist)" },
    { proof: "zkproof(timestamp-2024-12)" },
    { proof: "zkproof(source=NYT)" }
  ]
}
```

Note:

- `contentMetadata` is **informational only** (UX / discovery). Enforcement uses canonical claims + `proofPolicy`.

### Supported Proof Types

This middleware uses **canonical claims** end-to-end:

| Claim | Example | Provider support |
|---|---|---|
| human | `{ type: "human" }` | `self` (chain) or `self_api` (API) |
| age_gte | `{ type: "age_gte", age: 21 }` | `self_api` only |
| excluded_countries_not_contains | `{ type: "excluded_countries_not_contains", countries: ["US","RU"] }` | `self_api` only |
| ofac_clear | `{ type: "ofac_clear" }` | `self_api` only |
| origin_http_get | `{ type: "origin_http_get" }` | `vouch_chain` (chain) or `vouch_api` (API) |

## vouch proofs (step-by-step)

There are **two** supported paths. Use **chain** if you want reliability and low request-path latency; use **API** if you want to verify a newly presented proof on demand.

### Option A: `vouch_chain` (recommended for production request-path)

This assumes an attestor/prover flow already recorded an attestation on-chain. The middleware does a **read-only** chain lookup during request handling.

1) **Deploy/choose a registry** contract that exposes:

- `isVerified(address subject, bytes32 claimHash) -> bool`

2) **Set server env**:

- `VOUCH_RPC_URL=<rpc url>`
- `VOUCH_PROOF_REGISTRY=<0x...>`

3) **Enable the provider in policy**:

```js
proofPolicy: {
  version: 1,
  scope: "zkx402",
  claims: [{ type: "origin_http_get" }],
  allowedProviders: ["vouch_chain"],
  preferenceOrder: ["vouch_chain"],
  fallback: "none",
}
```

4) **Client request headers**:

- `X-Wallet-Address: 0x...`
- `X-Proof-Claims: [{"type":"origin_http_get"}]`

Notes:
- In the default implementation, the claim hash includes `{ scope, claim }`. **If you add fields** (like `url`) to the *required* claim, they become part of the attestation key.

### Option B: `vouch_api` (verify presented proof payload)

This calls a verifier endpoint during paid requests (and is **skipped in quote mode** when `X-PAYMENT` is missing).

1) **Set server env**:

- `VOUCH_API_URL=<https://...>` (required)
- `VOUCH_API_KEY=<secret>` (optional)
- `VOUCH_API_TIMEOUT_MS=8000` (optional)

2) **Enable the provider in policy**:

```js
proofPolicy: {
  version: 1,
  scope: "zkx402",
  claims: [{ type: "origin_http_get" }],
  allowedProviders: ["vouch_api"],
  preferenceOrder: ["vouch_api"],
  fallback: "none",
}
```

3) **Client sends the proof payload**:

- `X-Vouch-Proof: <json string or hex string>`

4) (Optional) **Constrain provider selection** (useful when multiple providers are allowed):

- `X-ZK-Proof-Plan: {"provider":"vouch_api"}`

5) **Costing**:

Add `proofCosts` so the server can quote + include verification fees/commission in the required payment amount.

## Adding a new proof provider (future-proof checklist)

When adding a new proof system (Worldcoin, zkPassport, custom ZK, etc.), follow this checklist:

1) **Add/extend a canonical claim** in `src/proofs/claims.js` (+ update `claimKey(...)`).
2) **Route the claim** in `src/proofs/router.js` by mapping claim → provider method name.
3) **Implement a provider** in `src/proofs/providers/`:
   - choose a `name` and `kind` (`"chain"` or `"api"`)
   - implement the `verifyX(...)` method(s)
4) **Wire provider into middleware** (`src/middleware.js`) and parse any needed headers.
5) **Add proof cost entries** (`proofCosts.entries[]`) for `{ provider, claimKey }` and update docs.
6) **Add unit tests**:
   - provider tests (success/failure/not_configured)
   - router tests (claim maps to method, respects allowlist/order)
7) **Update demo config** (`apps/demo/server/proof-policy.json`, `proof-costs.json`) and E2E if relevant.

## Client Usage

Include zkproofs in request headers:

```javascript
// Client makes request with claim intent (for discount quotes)
const response = await fetch('http://localhost:3001/api/data', {
  headers: {
    // required for chain-based checks (e.g., `self` provider)
    'X-Wallet-Address': '0xabc...',
    'X-Proof-Claims': JSON.stringify([
      { type: 'human' },
      { type: 'age_gte', age: 21 }
    ]),
  }
});

// Server verifies proofs and returns 402 with adjusted price
// Client handles payment with x402-fetch or similar
```

## Verification Metadata

Access verification results in your route handlers:

```javascript
app.get("/api/data", (req, res) => {
  const metadata = req.verificationMetadata;

  console.log(metadata);
  // {
  //   qualified: true,
  //   discountApplied: true,
  //   requiredClaims: [{ type: "human" }],
  //   discountedAmount: "5000",
  //   discountedPrice: "$0.005000",
  //   verificationFeeAtomic: "0",
  //   presentedClaims: [{ type: "human" }],
  //   verificationResult: {
  //     isValid: true,
  //     verifiedCount: 1,
  //     totalRequired: 1,
  //     verificationDetails: [
  //       {
  //         claimKey: "human",
  //         claim: { type: "human" },
  //         verified: true,
  //         status: "verified",
  //         provider: "self",
  //         quoted: false,
  //         attempts: [{ provider: "self", ok: true, status: "verified" }]
  //       }
  //     ]
  //   }
  // }
});
```

## Proof verification costs (vendor APIs + commission)

Some proof providers can incur a **per-request cost** (e.g., vendor API billing) or you may want to add a **commission** on verification. In v1, this is configured separately from `proofPolicy` via `extra.proofCosts`.

- **Costs are stored in USD micros** (`"2500"` == $0.0025) to avoid floats.
- **v1 assumption**: your priced asset is USDC (6 decimals), so USD micros map 1:1 to USDC atomic units.
- **Secrets** (API keys) must stay in env vars (never in JSON).

Client-selectable provider (soft checks):

- Send `X-ZK-Proof-Plan: {"provider":"self_api"}` (or per-claim key) to constrain provider routing when multiple providers are allowed.

## Use Cases

### 1. Journalist Marketplace
Whistleblowers sell sensitive content at premium prices, but offer discounts to verified journalists:

```javascript
"GET /api/leak/:id": {
  price: "$100.00",  // Public price
  config: {
    extra: {
      variableAmountRequired: [
        {
          requiredClaims: [{ type: "human" }],
          amountRequired: "500000"  // $0.50 for verified humans
        }
      ]
    }
  }
}
```

### 2. Proof of Humanity Gating
Only allow verified humans to access API:

```javascript
extra: {
  proofPolicy: {
    version: 1,
    scope: "zkx402",
    allowedProviders: ["self"],
    preferenceOrder: ["self"],
    fallback: "none",
  },
  // Hard-gate: deny unless claim verifies (even if the user pays)
  requiredClaims: [{ type: "human" }],
}
```

### 3. Organization Members
Offer discounts to verified organization members:

```javascript
variableAmountRequired: [
  {
    // NOTE: custom claims are not implemented by default.
    // To support them, extend `ClaimType` + add a provider method + update the router.
    requiredClaims: [{ type: "human" }],
    amountRequired: "0"  // Example only
  }
]
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Client sends request with X-Proof-Claims header       │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  x402-zkx402 Middleware                                 │
│  1. Extract claim intent from header                    │
│  2. Verify claims via `proofPolicy` + provider routing  │
│  3. Check variableAmountRequired tiers                  │
│  4. Adjust price if qualified                           │
│  5. Attach verification metadata to request             │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  x402 Payment Flow                                      │
│  1. Return 402 with adjusted price                      │
│  2. Client pays (via CDP facilitator)                   │
│  3. Middleware verifies payment                         │
│  4. Route handler executes                              │
└─────────────────────────────────────────────────────────┘
```

## TypeScript Support

Full TypeScript definitions included:

```typescript
import type {
  ZkProofRequest,
  VerificationMetadata,
  ZkProofRoutes
} from 'x402-zkx402';

app.get("/api/data", (req: ZkProofRequest, res) => {
  const metadata: VerificationMetadata | undefined = req.verificationMetadata;
  // Full type safety!
});
```

## API Reference

### `paymentMiddleware(payTo, routes, facilitator, paywall)`

Creates Express middleware with zkproof verification.

**Parameters:**
- `payTo` (string) - Ethereum address to receive payments
- `routes` (ZkProofRoutes) - Route configurations with zkproof settings
- `facilitator` (Facilitator) - Payment facilitator (from @coinbase/x402)
- `paywall` (PaywallConfig) - Optional paywall configuration

**Returns:** Express middleware function

## Integration with x402 Ecosystem

`x402-zkx402` is built on top of official x402 packages:
- Uses `@coinbase/x402` facilitator
- Compatible with `x402-fetch` client
- Works with x402 Bazaar (discovery)
- Follows x402 HTTP 402 specification

## Development Status

⚠️ **Alpha Release** - This package is in active development. The implementation is functional but may have rough edges. Contributions and feedback welcome!

## Examples

See the `/examples` directory for:
- `basic-usage.js` - Simple setup with zkproof discounts
- More examples coming soon!

## Related Projects

- [x402 Protocol](https://x402.org) - HTTP 402 payment standard
- [Self.xyz](https://self.xyz) - ZK passport verification
- [Hyperlane](https://hyperlane.xyz) - Cross-chain messaging for verification

## Roadmap

- [ ] Additional proof verifiers (Worldcoin, zkPassport, etc.)
- [ ] On-chain proof verification
- [ ] Proof caching and optimization
- [ ] Support for Solana/SVM networks
- [ ] Integration with x402 Bazaar
- [ ] MCP (Model Context Protocol) support

## Contributing

Contributions welcome! This package was built as part of the zkx402 project demonstrating zkproof-gated payments for a whistleblower marketplace.

## License

MIT

## Links

- [Full Demo](https://zkx402.io)
- [Documentation](https://github.com/vhspace/zkx402)
- [x402 Spec](https://x402.org)
- [Issues](https://github.com/vhspace/zkx402/issues)

## More docs

- `docs/proof-concepts.md` (claims vs policy vs proofs vs contentMetadata)


