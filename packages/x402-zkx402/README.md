# x402-zkx402

> Zero-knowledge proof verification middleware for the x402 protocol

`x402-zkx402` extends the [x402 payment protocol](https://x402.org) with zero-knowledge proof verification, enabling **identity-based variable pricing** and **content provenance verification**. This allows APIs to offer discounted rates to verified users (journalists, verified humans, organization members) while maintaining privacy through zkproofs.

## Features

- ✅ **zkProof-Gated Discounts** - Offer different prices based on verified credentials
- ✅ **Content Provenance** - Prove content authenticity with zkproofs (vlayer integration)
- ✅ **Privacy-Preserving** - Verify identity without revealing sensitive information
- ✅ **Drop-in Replacement** - Works with existing x402 infrastructure
- ✅ **Multiple Proof Types** - Support for human verification, institution proofs, and more
- ✅ **Cross-chain Compatible** - Works with Base, Celo, and other EVM chains

## Installation

```bash
npm install x402-zkx402 @coinbase/x402 viem express
```

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
          // Users with zkproof get 50% discount
          variableAmountRequired: [
            {
              requestedProofs: "zkproofOf(human)",
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

Offer different prices based on verified zkproofs:

```javascript
extra: {
  variableAmountRequired: [
    {
      // Multiple proofs required (all must verify)
      requestedProofs: "zkproofOf(human), zkproofOf(institution=NYT)",
      amountRequired: "5000"  // 0.005 USDC
    },
    {
      // Fallback discount (checks sequentially)
      requestedProofs: "zkproofOf(human)",
      amountRequired: "7500"  // 0.0075 USDC
    }
  ]
}
```

**How it works:**
1. Middleware checks each discount tier in order
2. First matching tier is applied
3. If no proofs match, full price is charged
4. Proofs are verified via API or simple string matching

### Content Metadata

Attach zkproofs about content provenance:

```javascript
extra: {
  contentMetadata: [
    { proof: "zkproof(verified-journalist)" },
    { proof: "zkproof(timestamp-2024-12)" },
    { proof: "zkproof(institution=NYT)" }
  ]
}
```

### Supported Proof Types

| Proof Type | Example | Verification Method |
|------------|---------|---------------------|
| Human | `zkproofOf(human)` | String matching or API |
| Institution | `zkproofOf(institution=NYT)` | API verification (vlayer) |
| Custom | `zkproof(your-proof-type)` | String matching |

## Client Usage

Include zkproofs in request headers:

```javascript
// Client makes request with proofs
const response = await fetch('http://localhost:3001/api/data', {
  headers: {
    'X-User-Proofs': JSON.stringify([
      'zkproofOf(human)',
      'zkproofOf(institution=NYT)'
    ])
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
  //   requestedProofs: "zkproofOf(human)",
  //   discountedAmount: "5000",
  //   discountedPrice: "$0.005000",
  //   userProofs: ["zkproofof(human)"],
  //   verificationResult: {
  //     isValid: true,
  //     verifiedCount: 1,
  //     totalRequired: 1,
  //     verificationDetails: [...]
  //   }
  // }
});
```

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
          requestedProofs: "zkproofOf(institution=NYT)",
          amountRequired: "500000"  // $0.50 for verified journalists
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
    requestedProofs: "zkproofOf(human)",
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
    requestedProofs: "zkproofOf(organization=acme-corp)",
    amountRequired: "0"  // Free for organization members
  }
]
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Client sends request with X-User-Proofs header        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  x402-zkx402 Middleware                                 │
│  1. Extract zkproofs from header                        │
│  2. Verify proofs (API or string matching)              │
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
- [vlayer](https://vlayer.xyz) - ZK email/TLS proofs for content provenance
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

