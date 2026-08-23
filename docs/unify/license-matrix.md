# License Facts & Hygiene (verified 2026-08-22)

> **Owner directive (2026-08-22):** all repos in scope are the owner's code.
> **Licenses are not a constraint.** This document is retained as a factual
> inventory (what LICENSE files exist today) plus hygiene items to clean up during
> the monorepo import. Nothing here gates unification.

Verification method: GitHub Licenses API (`gh api repos/<owner>/<repo>/license`)
plus on-disk inspection of shallow clones (`git ls-files | grep -i license`,
`package.json` license field). Badges in READMEs are **not** treated as evidence.

| Repo | LICENSE file | gh api | package.json | Contributors (humans) | On-disk status |
|---|---|---|---|---|---|
| vhspace/zkx402 | `LICENSE` | GPL-3.0 | ISC ⚠️ contradicts | markballew, netun0, vhew, lamtrinh259, Ghost-xDD (+cursoragent, bots) | GPL-3.0 text on disk |
| vhspace/goldenmcp | none | 404 | n/a (pyproject; no license field seen) | markballew, Maddoxx88 | No LICENSE file |
| vhspace/eXpress402 | none | 404 | none | markballew, MarouaBoud, andrestudents (+cursoragent) | No LICENSE file |
| vhspace/proof-of-thought | none | 404 | none | markballew | No LICENSE file (single author) |
| spooky-fox/ethglobal-nyc2026 | none | 404 | n/a | docs-only | No LICENSE file |
| spooky-fox/lanzo-web | none | 404 | none | — | No LICENSE file |
| vhspace/3Dtapout | none | 404 | n/a | — | No LICENSE file |

## Hygiene items (do during import, not before)

1. **Pick one license for the monorepo** (MIT recommended; owner's call) and apply
   it uniformly to all imported code at import time.
2. **Fix zkx402's `package.json`** — it declares `ISC` while `LICENSE` says
   GPL-3.0. The field should match whatever the monorepo carries after import.
   Conventional commit: `fix(license): align package.json with monorepo license`.
3. **Add LICENSE to proof-of-thought** (single author — trivial) whenever
   convenient.
4. **Courtesy heads-up** to outside contributors (Maddoxx88; MarouaBoud,
   andrestudents; netun0, vhew, lamtrinh259, Ghost-xDD) via an issue/PR on each
   source repo before archiving. Not a blocker.

## Dependency licenses (not audited here)

Before the monorepo ships anything, run `license-checker` / `pip-licenses` in CI.
Known watch items: Coinbase x402 (Apache-2.0), Foundry (MIT/Apache-2.0),
0G/Gensyn SDKs (verify before any proof-of-thought integration). Third-party
dependency licenses are unaffected by the owner directive and still deserve a
CI check.

## Decision record

- **ADR-1 (superseded):** ~~zkx402 stays GPL-3.0, separate repo, HTTP boundary.~~
  Superseded by the 2026-08-22 owner directive: zkx402 is imported into the
  monorepo like the other prototypes.
- **ADR-2:** Monorepo carries a single license (MIT recommended), applied at
  import time to goldenmcp + eXpress402 + zkx402.
- **ADR-3:** proof-of-thought stays a separate repo until its chain stack
  stabilizes — a technical decision, not a license one.
