# zkx402 — Resume todo (for new chat)

Use this file to resume work after starting a new chat. Copy or reference it when you say “continue from TODO_RESUME.md”.

---

## Where we left off (last session)

- **PR #81** (P1 issue #68 — v2 `accepts[]` route config): CI was failing; we fixed the “quote mode: accepts[] uses quoted API provider for discounts” test by making the 402 response use the **discounted** amount for the primary requirement when `variableAmountRequired` discount is applied. Changes were committed and **pushed** to `p1-issue-68-accepts-config`. Next step: confirm CI is green and merge PR #81 if desired.

---

## Epic: x402 v2 migration (GitHub Epic #63)

Remaining work, by priority:

### P1 (next)

- [ ] **#69** — Map facilitator verify/settle failures into stable zkx402 reason codes

### P2

- [ ] **#70** — Migrate demo server to x402 v2  
- [ ] **#71** — Migrate demo client to x402 v2 payment flow  
- [ ] **#72** — Update docs/examples to x402 v2 headers + CAIP-2  
- [ ] **#73** — Update CI/E2E to run x402 v2 flow  
- [ ] **#77** — Add Vouch (getvouch) proof provider support  

### P3

- [ ] **#74** — Add first-class Solana/SVM payment path in demo + zkx402  
- [ ] **#75** — Remove v1 compatibility layer (after v2 is stable)  

---

## Useful pointers

- **Local E2E:** `cd apps/demo/local-chain && node run-e2e-test.js`  
- **Unit tests (core):** `cd packages/x402-zkx402 && npm test`  
- **Repo rules:** `CLAUDE.md` (install, E2E, conventions)  
- **V2 migration plan:** `.cursor/plans/p0_x402_v2_core_migration_*.plan.md` (P0 is done; plan has gotchas and P2 notes)  

---

*Last updated when creating this file for chat handoff.*
