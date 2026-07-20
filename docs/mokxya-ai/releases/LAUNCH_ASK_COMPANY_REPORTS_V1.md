# Release dossier — LAUNCH-ASK-COMPANY-REPORTS V1

**Date:** 2026-07-20  
**Step:** PR-C2 / ADR_0092  
**Capability row:** `LAUNCH-ASK-COMPANY-REPORTS`  
**Flag status:** **OFF** (`production_approved=false`)  
**Depth:** ANNOTATION_ONLY (not PRODUCTION until PR-C2-ARM)

## 1. Scope

Ask Mode narrow launch — authorized company report questions:

- Balance Sheet, Profit & Loss, Trial Balance, ledger / party statement
  answers from authorized company-scoped data
- Languages: English, Nepali Devanagari, Romanized Nepali, light code-mix
- Refuse / no-answer when evidence is missing (never invent current tax/law)

Out of Ask AI launch set:

- Autonomous posting or any ledger mutation from Ask Mode
- Guaranteed legal/tax conclusions without reviewed sources
- Settlement / returns / bank recon drafts (Accountant Mode / later rows)
- Track I (speech / OCR / CA / calendar)

## 2. Supported utterance families (minimum)

| Family | Examples |
|--------|----------|
| Report ask | balance sheet / trial balance / P&L / ledger for party X |
| Refuse | current tax rate / unreviewed legal cite → abstain |
| Clarify | ambiguous period or party → ask one slot |

## 3. Limitations (disclosed)

1. Ask Mode is **zero mutation** — never posts or drafts sales/purchase.
2. Natural-language “yes” / assent **does not post** (`nl_assent_posts=false`).
3. Legal / tax-current answers may **abstain** (GAP-P2-008 REDUCED).
4. Production retrieval is **LEXICAL_ONLY** (ADR_0081; GAP-P2-001 REDUCED).
5. Ungrounded claims force abstain / citation honesty (ADR_0080 / ADR_0088).

## 4. Residual gaps (not CLOSED)

| Gap | Status | Relevance |
|-----|--------|-----------|
| GAP-P2-008 | REDUCED | Knowledge honesty; staging review PENDING |
| GAP-P2-001 | REDUCED | Prod LEXICAL_ONLY |
| GAP-P1-002 | REDUCED | Sync honesty (Ask itself does not enqueue posts) |

## 5. Blocking tickets before flag arm

| Ticket | Blocks |
|--------|--------|
| TICKET-PR-B1-001 | Staging operator attestation |
| TICKET-PR-B1-002 | Connected E2E green on staging |
| TICKET-PR-B5-001 | Staging professional knowledge review |

## 6. Monitoring (after arm)

| Signal | Intent |
|--------|--------|
| Ask abstain rate | Detect over/under refuse |
| Citation force-abstain count | Detect ungrounded answer pressure |
| `mode_restriction` counts | Detect out-of-freeze Ask traffic |
| Unexpected mutation attempt count | Detect Ask→post path regressions |

## 7. Rollback

1. Set `LAUNCH_ASK_COMPANY_REPORTS_PRODUCTION_APPROVED=false` (env) **and**
   registry `flag_armed=false` / row `production_approved=false`.
2. Effect: Ask report answers for this capability row disabled; ERP report
   screens remain.
3. Do **not** force-push or rewrite Lovable history as rollback.

## 8. On-call owner

| Role | Owner | Contact |
|------|-------|---------|
| Product owner (sign-off) | **PENDING** | — |
| Engineering on-call | Repository maintainer | GitHub `tapendraawasthi-sketch/My-Current-ERP` |

Owner name + date required in `artifacts/prod-ready-pr-c2/OWNER_SIGNOFF.md` before flag arm.

## 9. Arm checklist (PR-C2-ARM)

- [ ] TICKET-PR-B1-001 PASS  
- [ ] TICKET-PR-B1-002 PASS  
- [ ] TICKET-PR-B5-001 PASS (or accepted residual with owner note)  
- [ ] Owner sign-off filed for Ask reports  
- [ ] Staging golden path green within 48h of flip  
- [ ] Zero-mutation proof still green  
- [ ] Matrix row → `depth=PRODUCTION`, `production_approved=true` **for this row only**  
- [ ] Runtime flag armed  

## Explicit non-claims

- Not production_approved (row or global)
- Not NEXT-20 DONE (first row still PR-C1-ARM)
- Not staging golden path green
- Not owner sign-off complete
