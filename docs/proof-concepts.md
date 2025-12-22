# Proof concepts (zkx402 / x402-zkx402)

This repo uses a few similar-sounding terms. This page defines them and shows how they fit together.

## Canonical claims (what you want)

Canonical claims are **vendor-neutral** JSON objects describing *what* should be verified.

They are sent by the client via the `X-Proof-Claims` header:

- `X-Proof-Claims: [{"type":"human"}]`
- `X-Proof-Claims: [{"type":"origin_http_get"}]`

Canonical claims are used for:

- **Discount routing** (`extra.variableAmountRequired[].requiredClaims`)
- (Future) **access control gating** (“deny unless verified”)

## `proofPolicy` (how you verify)

`proofPolicy` is server-side configuration that selects **which providers are allowed** and **in what order** for a given route.

It lives under route config as:

- `config.extra.proofPolicy`

Without `proofPolicy`, the middleware will **not apply proof-gated discounts** (to avoid trusting self-asserted client input).

## Providers (who verifies, and where)

Providers implement verification strategies. In v1 there are two kinds:

- **chain**: read-only RPC checks (reliable in the request hot path)
- **api**: verifier HTTP calls (optional; can cost money; skipped in quote-mode)

Current provider names:

- `self` (chain): reads `isVerified(address)` from a configured receiver contract
- `self_api` (api): posts to `SELF_API_URL` using `X-Self-Proof`
- `vlayer_chain` (chain): reads `isVerified(address, claimHash)` from a configured registry
- `vlayer_api` (api): posts to `VLAYERS_API_URL` using `X-Vlayer-Proof`

## Proof payload headers (what you present)

Some providers require a proof payload in request headers:

- `X-Self-Proof`: payload forwarded to `SELF_API_URL`
- `X-Vlayer-Proof`: payload forwarded to `VLAYERS_API_URL` (or a raw string/hex blob)

Chain providers generally require a subject wallet:

- `X-Wallet-Address: 0x...`

## `contentMetadata` (informational only)

`config.extra.contentMetadata` is **not enforced** by `x402-zkx402`.

It’s intended for:

- provenance/hints for clients
- discoverability/UX

Do not treat it as cryptographic proof.

## Quote mode vs paid mode (important)

The middleware behaves differently depending on whether the request includes payment:

- **Quote mode**: no `X-PAYMENT` header
  - The server responds `402` with `accepts[]` (payment requirements).
  - **API providers are not called** (to avoid paid-request vendor calls during discovery).
  - Metadata may mark some checks as `quoted: true` when computing prices/fees.

- **Paid mode**: includes `X-PAYMENT`
  - The server verifies payment and (if configured) performs proof verification via the configured providers.
  - The route handler can read `req.verificationMetadata`.

