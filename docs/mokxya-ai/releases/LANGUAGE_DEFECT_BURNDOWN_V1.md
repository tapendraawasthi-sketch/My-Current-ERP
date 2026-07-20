# Language defect burn-down — launch rows V1

**Date:** 2026-07-20  
**Step:** PR-D2 / ADR_0098  
**Pack status:** **READY**  
**Defects collected from live traffic:** **false**

## 1. Purpose

After arm (or staging), capture real user EN / Nepali Devanagari /
Romanized / code-mix failures on launch intents, freeze them as cases,
and fix without weakening assertions.

## 2. In scope

- Sales / purchase clarify + draft language (Accountant Mode)
- Ask company report questions + refuse strings
- Number/money/date role mistakes (“5 months” ≠ NPR 5)
- Clarification continuing in the user’s language form

## 3. Out of scope (do not widen)

- Settlement / returns / bank recon AI drafts (until PR-E)
- Track I speech / OCR / CA / calendar
- Weakening MAI-04 / honesty / vacuous-green gates to go green

## 4. Defect log template

Record each row under `artifacts/prod-ready-pr-d2/defects/` (gitignored OK):

| Field | Example |
|-------|---------|
| id | LD-YYYYMMDD-001 |
| language_form | en / ne_devanagari / ne_romanized / code_mix |
| utterance | … |
| mode | Accountant / Ask |
| expected | clarify slot X / draft preview / refuse |
| actual | wrong intent / wrong language / invented cite |
| frozen_case_path | evals/… or language_runtime fixture |
| fix_commit | … |
| status | OPEN / FROZEN / FIXED |

## 5. Burn-down rules

1. **Reproduce** once with company context.
2. **Freeze** a non-vacuous case (ADR_0095) before or with the fix.
3. **Fix** the smallest path; prefer new frozen case over prompt theatre.
4. **Never** `assert True`, empty PASS, or delete failing language gates.
5. **Linguist / product sample** path remains PR-A3 / GAP-P1-009 residual —
   do not claim linguist_approved from this pack alone.

## 6. Exit (future)

Burn-down “complete” only when owner accepts residual open defects and
launch language samples stay green — **not claimed in this ship**.

## Explicit non-claims

- Not defects collected  
- Not burn-down complete  
- Not production_approved  
- Not linguist_approved  
