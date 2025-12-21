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

## Installation

```bash
npm install x402-zkx402 express viem
```

If you're using the hosted CDP facilitator, also install `@coinbase/x402`.

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
  facilitator  // CDP facilitator
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

### Supported Proof Types

This middleware uses **canonical claims** end-to-end:

| Claim | Example | Provider support |
|---|---|---|
| human | `{ type: "human" }` | `self` (chain) or `self_api` (API) |
| age_gte | `{ type: "age_gte", age: 21 }` | `self_api` only |
| excluded_countries_not_contains | `{ type: "excluded_countries_not_contains", countries: ["US","RU"] }` | `self_api` only |
| ofac_clear | `{ type: "ofac_clear" }` | `self_api` only |

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
  //     verificationDetails: [...]
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
variableAmountRequired: [
  {
    requiredClaims: [{ type: "human" }],
    amountRequired: "1000"  // Must have proof to pay any amount
  }
]
// Without proof: Full price ($0.01)
// With human proof: Discounted ($0.001)
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
- [Documentation](https://github.com/yourusername/zkx402)
- [x402 Spec](https://x402.org)
- [Issues](https://github.com/yourusername/zkx402/issues)


