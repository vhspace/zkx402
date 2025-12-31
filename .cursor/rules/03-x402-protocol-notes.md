# x402 / zkx402 protocol notes (Cursor rules)

## Important header schema

The `X-PAYMENT` header must match the `x402` npm package schema:

```json
{
  "x402Version": "...",
  "scheme": "...",
  "network": "...",
  "payload": {
    "signature": "...",
    "authorization": {
      "from": "...",
      "to": "...",
      "value": "...",
      "validAfter": "...",
      "validBefore": "...",
      "nonce": "..."
    }
  }
}
```

## Import rule

In this repo, `x402-zkx402` middleware imports from the **`x402`** npm package (not `@coinbase/x402/*` subpaths).


