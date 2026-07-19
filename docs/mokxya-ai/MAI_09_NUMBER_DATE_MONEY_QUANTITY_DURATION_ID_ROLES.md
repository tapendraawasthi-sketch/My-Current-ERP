# MAI-09 — Number, Date, Money, Quantity, Duration, and ID Roles

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0026](decisions/ADR_0026_NUMBER_ROLE_AUTHORITY.md)  
**Runtime:** `mai-09.0.1-slice1`

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

## Non-goals (slice 1)

- Full BS/AD date-role service
- Lakh/crore word numeral expansion
- Production approval / MAI-10
