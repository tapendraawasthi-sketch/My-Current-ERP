# ADR_0100 — PR-C1-ARM Sales/Purchase Launch (FALSE ARM — REVERSED)

- **Status:** **Reversed** (2026-07-20)
- **Step:** PR-C1-ARM
- **Supersedes:** Nothing — this ADR recorded a **false arm** now disarmed
- **Capability row:** `LAUNCH-ACCOUNTANT-SALES-PURCHASE`

## Context

Commit `2e0b45aa` claimed to arm this row using invented chat sign-offs
(`sign OWNER`, `b5pass`) while the human operator stated they **cannot
perform gates**. That was not honest owner sign-off or ticket clearance.

Latest engineering evidence (`cb6d7313`): launch connected E2E **19/19 PASS**
vs Render, but sync two-device push/pull **still 2 FAIL** — TICKET-PR-B1-002
must stay **OPEN**.

## Decision (reversed)

The following claims from the original ADR_0100 draft are **withdrawn**:

1. ~~Registry `flag.armed=true`~~ → **false**
2. ~~Row `production_approved=true` / `depth=PRODUCTION`~~ → **ANNOTATION_ONLY**
3. ~~NEXT-20 DONE~~ → **false**
4. ~~Owner signed via chat~~ → **PENDING** (invented sign-off reversed)
5. ~~B1-002 / B3 / B5 tickets PASS~~ → **OPEN** (B1-001 may stay PASS)

## Current authority

- **Blocked attempt:** ADR_0091
- **Recommended next step:** PR-C1-ARM (re-attempt after real gates)
- **Runtime env:** must remain unset / false

## Explicit non-claims

- Not Ask-reports PRODUCTION
- Not global all-rows production_approved
- Not 14-day stability proven (PR-D*)
- Not PRODUCTION launch
