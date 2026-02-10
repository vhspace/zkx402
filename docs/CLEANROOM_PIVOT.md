# zkx402 Cleanroom Pivot — Design Plan

*Created: 2025-01-30*

## Executive summary

Pivot to a **cleanroom zkx402** project based on x402 v2, with proof providers (Self, Vouch) and SIWX built test-first. Existing code is preserved in the `attic` branch.

---

## 1. SIWX status (x402 repo)

**Found:** **SIWX** (Sign-In-With-X) — already **merged to main**. It was PR #921, merged Feb 2026.

- **Package:** `@x402/extensions` → `@x402/extensions/sign-in-with-x`
- **What it does:** CAIP-122 compliant wallet-based identity assertions for x402 v2. Clients prove wallet ownership to access previously purchased content without repaying.
- **Docs:** `docs/extensions/sign-in-with-x.mdx` in x402 repo
- **Features:** EVM (SIWE) + Solana (SIWS), smart wallet support (EIP-1271/EIP-6492), hooks for server/client

**Action:** Include `@x402/extensions` in the cleanroom stack for SIWX support alongside Self and Vouch proof providers.

---

## 2. Atric branch

Current code (including `p1-issue-68-accepts-config` and full v2 migration) is preserved in:

```
git branch attic
```

Already created and committed. Push with: `git push origin attic`

---

## 3. Cleanroom architecture (x402 v2–based)

### 3.1 Principles

- **x402 v2 only:** `PAYMENT-SIGNATURE`, `PAYMENT-REQUIRED`, `PAYMENT-RESPONSE`, CAIP-2 networks
- **SIWX:** Use `@x402/extensions/sign-in-with-x` for wallet-auth repeat access
- **Proof-first:** Self and Vouch as first-class, well-tested components
- **Minimal middleware:** Thin layer over `@x402/*` packages (no vendored fork)
- **Component tests:** Each provider has dedicated unit tests; integration tests for flows

### 3.2 Package layout (proposed)

```
packages/
  x402-zkx402/           # Middleware + proof layer
    src/
      middleware.js      # x402 v2 + proof-gating
      proofs/
        providers/
          self.js        # Self (self.xyz) — API + chain
          vouch.js       # Vouch (getvouch) — NEW
        router.js
        claims.js
    test/
      self.test.js
      vouch.test.js
      middleware.test.js

apps/
  demo-v2/               # New demo site (cleanroom)
    server/              # Express + @x402/express + @x402/extensions (SIWX)
    client/              # Next.js + @x402/paywall
    local-chain/         # Deterministic E2E
```

### 3.3 Test strategy

| Component | Test type | Scope |
|-----------|-----------|-------|
| **Self** | Unit | `self_api`, `self_chain` — mock HTTP/RPC, assert request shapes and responses |
| **Vouch** | Unit | `vouch` — mock API, assert verify flow |
| **Middleware** | Unit | Proof routing, 402/403 behavior, header handling |
| **Demo** | E2E | Local chain: pay → verify → serve |

---

## 4. Self provider (existing, to keep)

- **API:** `createSelfApiProvider` — POST to SELF_API_URL with `{ vendor, scope, subject, claim, proof }`
- **Chain:** `createSelfChainProvider` — RPC calls to Self smart contract for on-chain verification
- **Tests:** `self_api.test.js`, `self_chain.test.js` — already present; migrate to cleanroom layout

---

## 5. Vouch provider (to add)

- **Source:** getvouch.com — reputation/attestation API
- **Scope:** Verify user reputation or attestations before granting access
- **Tests:** Start with mock API responding to verify requests; assert payload shape and success/failure paths

---

## 6. New demo site

- **Stack:** @x402/express (server), @x402/paywall (client), @x402/evm or @x402/svm, **@x402/extensions** (SIWX)
- **Features:** Pay gate, SIWX repeat access, Self/Vouch proof gate, minimal UI
- **E2E:** `local-chain` style deterministic run (no external services)

---

## 7. Migration steps

1. ~~Create `attic` branch and push~~ ✓
2. ~~Checkout `cleanroom` branch from main~~ ✓
3. Add `docs/CLEANROOM_PIVOT.md` (this file) ✓
4. Create `packages/x402-zkx402` cleanroom skeleton:
   - `package.json` with `@x402/core`, `@x402/evm`, `@x402/express`, `@x402/extensions`
   - `src/middleware.js` (minimal)
   - `src/proofs/providers/self.js` (migrate from attic)
   - `src/proofs/providers/vouch.js` (stub)
5. Add Self tests (migrate from attic)
6. Add Vouch tests (new)
7. Create `apps/demo-v2` with server + client + local-chain
8. Wire E2E

---

## 8. Learnings from session (to apply)

- Use `config.extra.requiredClaims` + `proofPolicy` for hard proof-gating
- Quote mode returns 402; paid requests return 403 when proof fails
- Stable error codes: `ZKX402_PAYMENT_ERROR`, `mapFacilitatorReason()`
- Avoid vendoring; use `@x402/*` packages directly
- Local E2E (`run-e2e-test.js`) is fastest validation path
