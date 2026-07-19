# MAI Capability Truth Matrix

**Date:** 2026-07-19  
**Authority:** `MOKXYA_AI_WHAT_MUST_BE_DONE_NEXT_V1.txt` → **NEXT-00**  
**Machine copy:** [`MAI_CAPABILITY_TRUTH_MATRIX.json`](MAI_CAPABILITY_TRUTH_MATRIX.json)  
**Master:** `MOKXYA_AI_MASTER_ARCHITECTURE_AND_CURSOR_ROADMAP_V1.txt`

## Verdict

| Field | Value |
|-------|-------|
| Master phase IDs | Exhausted at **MAI-53** |
| MAI-08…53 ledger | `PASSED_ENGINEERING` |
| Any continuum row `PRODUCTION` | **0** |
| Any continuum row `PILOT` | **0** |
| Track I (MAI-50…53) | **Dormant / FREEZE ACTIVE** ([ADR_0071](decisions/ADR_0071_TRACK_I_DEEPENING_FREEZE_UNTIL_NEXT_20.md)) until **NEXT-20** |
| `production_approved` (product) | **false** |
| `legal_effective_dates_proven` | **false** |
| Recommended next step | **NEXT-14** (prod retrieval without Ollama) |

**PASSED_ENGINEERING ≠ master Gate proven ≠ production released.**

## Depth legend

| Depth | Meaning |
|-------|---------|
| `ANNOTATION_ONLY` | Policy/bundle only; no consume |
| `CANDIDATE_CONSUMED` | Policy + `CANDIDATE_ONLY` consume; live `allow_*=false`; master Gate not proven |
| `GATE_PROVEN` | Master Gate satisfied for stated scope |
| `PILOT` | Limited human-reviewed cohort |
| `PRODUCTION` | Explicit human `production_approved` for a capability row |

## Blocking gaps (still open / reduced)

| Gap | Status | Blocks |
|-----|--------|--------|
| GAP-P0-001 | REDUCED | Dual writers remain; sole-OEC still false (ADR_0072) |
| GAP-P1-001 | REDUCED | Prod secondary mounts gated (ADR_0073); code remains |
| GAP-P1-002 | REDUCED | Accounting EVENT_SYNC_QUEUE (ADR_0074); residual dual OPEN |
| GAP-P1-004 / P1-008 | REDUCED | NEXT-06 turn-relation suite 35/35 component green |
| GAP-P1-007 | REDUCED | NEXT-06 number_roles suite 40/40 component green |
| GAP-P1-009 | OPEN | NEXT-07 NLU consume landed; linguist/product still OPEN |
| GAP-P1-012 | OPEN | Linguist approval path |
| GAP-P2-001 | OPEN | Prod retrieval without Ollama |
| GAP-P2-002 | REDUCED | NEXT-11 ADR_0078 owners+labels; display estimates remain |
| GAP-P2-008 | REDUCED | NEXT-13 ADR_0080 force-abstain gate; reviewer sign-off still needed |

## Phase matrix (MAI-00 … MAI-53)

| Phase | Depth | Live effect | Prod approved | Linked gaps |
|-------|-------|-------------|---------------|-------------|
| MAI-00 | GATE_PROVEN | docs | false | — |
| MAI-01 | GATE_PROVEN | primary path partial | false | P1-001, P1-006 |
| MAI-02 | GATE_PROVEN | contracts | false | — |
| MAI-03 | GATE_PROVEN | observability | false | — |
| MAI-04 | GATE_PROVEN | harness (ctx+num green; multi HR) | false | P1-007/008/009, P2-008 |
| MAI-05 | GATE_PROVEN | pipeline active | false | P1-009 |
| MAI-06 | GATE_PROVEN | pipeline active | false | P1-009 |
| MAI-07 | GATE_PROVEN | runtime active (transliteration) | false* | P1-009, P1-012 |
| MAI-08 | CANDIDATE_CONSUMED | pipeline partial | false | P1-009 |
| MAI-09 | CANDIDATE_CONSUMED | pipeline partial | false | P1-007 |
| MAI-10 | CANDIDATE_CONSUMED | pipeline partial | false | P1-009 |
| MAI-11 | CANDIDATE_CONSUMED | pipeline partial | false | P1-009 |
| MAI-12 | CANDIDATE_CONSUMED | tooling | false | P2-005 REDUCED |
| MAI-13 | CANDIDATE_CONSUMED | pipeline partial | false | — |
| MAI-14 | CANDIDATE_CONSUMED | pipeline partial | false | P1-004, P1-008 |
| MAI-15 | CANDIDATE_CONSUMED | pipeline partial | false | — |
| MAI-16 | CANDIDATE_CONSUMED | pipeline partial | false | P1-001 |
| MAI-17…23 | CANDIDATE_CONSUMED | scaffold / partial | false | — |
| MAI-24…30 | CANDIDATE_CONSUMED | scaffold (knowledge) | false | P2-008, P2-001 |
| MAI-31…35 | CANDIDATE_CONSUMED | scaffold (action/sync) | false | P0-001, P1-002, P2-002 |
| MAI-36…43 | CANDIDATE_CONSUMED | scaffold (legal/tax) | false | P2-008 |
| MAI-44…49 | CANDIDATE_CONSUMED | scaffold (ops/release) | false | — |
| **MAI-50…53** | **CANDIDATE_CONSUMED** | **DORMANT Track I** | **false** | (no deepen until NEXT-20) |

\*MAI-07 R3S cut over an active transliteration runtime/pack. That is **not** product-wide `production_approved` for Ask/Accountant capabilities.

## Launch capability candidates (master §32)

| Launch row | Depth | Prod approved | Blocked by |
|------------|-------|---------------|------------|
| Ask — company report questions | ANNOTATION_ONLY | false | P1-001, P2-008, P2-001, NEXT-12/13/20 |
| Accountant — sales/purchase draft+confirm | ANNOTATION_ONLY | false | P0-001, P1-002, P1-007/008, P2-002, NEXT-02/12/20 |
| Ask — product/accounting explanation | ANNOTATION_ONLY | false | P2-008, NEXT-13/20 |

**None are PRODUCTION. None are PILOT.**

## Counts

| Depth | Count |
|-------|------:|
| GATE_PROVEN | 8 (MAI-00…07) |
| CANDIDATE_CONSUMED | 46 (MAI-08…53) |
| ANNOTATION_ONLY (phases) | 0 |
| PILOT | 0 |
| PRODUCTION | 0 |
| Track I dormant | 4 |
| Launch rows PRODUCTION | 0 |

## What this unlocks next

Per `MOKXYA_AI_WHAT_MUST_BE_DONE_NEXT_V1.txt` default order:

1. ~~NEXT-01~~ — Track I freeze (ADR_0071)  
2. ~~NEXT-02~~ — Mutation authority Option A / GAP-P0-001 REDUCED (ADR_0072)  
3. ~~NEXT-03~~ — Production AI stack strangler / GAP-P1-001 REDUCED (ADR_0073)  
4. ~~NEXT-04~~ — Sync authority / GAP-P1-002 REDUCED (ADR_0074)  
5. ~~NEXT-06~~ — MAI-04 language suites reproof (ctx+num green; multi HR waived)  
6. ~~NEXT-05~~ — Confirm path honesty (ADR_0075 Model B tokens)  
7. ~~NEXT-07~~ — Gated language candidate NLU consume (ADR_0076)  
8. ~~NEXT-10~~ — Launch event spec freeze (ADR_0077)  
9. ~~NEXT-11~~ — Calc authority honesty / GAP-P2-002 REDUCED (ADR_0078)  
10. ~~NEXT-12~~ — E2E launch slice evidence (ADR_0079)  
11. ~~NEXT-13~~ — Knowledge citation honesty / GAP-P2-008 REDUCED (ADR_0080)  
12. **NEXT-14** — Production retrieval without Ollama (GAP-P2-001)

## Explicit non-claims

- Does not close any gap  
- Does not authorize speech, document ingest, CA engagement, calendar arm, cutover, or traffic  
- Does not mark any MAI-08…53 row GATE_PROVEN or PRODUCTION  
