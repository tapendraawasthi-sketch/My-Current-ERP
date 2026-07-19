# MAI-09 — Number, Date, Money, Quantity, Duration, and ID Roles

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 2)  
**Authority:** [ADR_0026](decisions/ADR_0026_NUMBER_ROLE_AUTHORITY.md)  
**Runtime:** `mai-09.0.2-slice2`

## Objective

Stop treating the first number as money. Assign digit surfaces to duration,
quantity, money, percentage, invoice/ID, or unknown with evidence spans.

## Slice 1

1. `NumberRoleBundleV1` candidate parser (`number_roles` package)
2. Duration-before-amount; protected ID/invoice never amount; default `unknown`
3. Wire attach after MAI-08 in `oip_chat_ingress`
4. Harden `EntityExtractor` `\d+ ko` so duration is not amount
5. Point eval adapter at the same parser
6. `evals/mai09` critical fixtures + baseline

## Gates (slice 1)

| Case | Expect |
|------|--------|
| `5 maina ko` | role=`duration`, not amount |
| `invoice 9001 … 400` | 9001 ≠ amount |
| PAN/phone surfaces | role=`identifier`, protected |
| Uncued bare digits | `unknown` until money cue |

## Slice 2

1. Word numerals: saya/hajar/lakh/crore (+ tin/dui/…) → amount with NPR normalize
2. Deterministic BS/AD service (`bs_ad_service.py`) for BS 2000–2090
3. Date role candidates on LanguageFrame (`date_candidates`)
4. EntityExtractor expands hajar/lakh/crore; duration no longer blocks word amounts

## Non-goals

- Production approval / MAI-10
- Full spoken ordinal/date-period NLP beyond YMD literals
