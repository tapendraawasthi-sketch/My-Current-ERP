# MAI-11 — Response Language and Register Policy

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0028](decisions/ADR_0028_RESPONSE_LANGUAGE_AND_REGISTER_POLICY_AUTHORITY.md)  
**Runtime:** `mai-11.0.1-slice1` (engineering; not production-approved)

## Objective

Decide which language/script and register the assistant should use when
replying — mirroring the user when confident — without silently rewriting
raw input or model text in slice 1.

## Slice 1

1. `ResponseRegisterBundleV1` policy service (`response_register` package)
2. Fill `LanguageFrame.dominant_response_language` + `linguistic_register`
3. Honorific cues (`tapai`/`hajur`) → `SHOP_INFORMAL`; accounting English →
   `ACCOUNTING_FORMAL`; else `NEUTRAL` / `UNKNOWN`
4. Wire attach after MAI-10 in `oip_chat_ingress`
5. `evals/mai11` fixtures + baseline

## Gates (slice 1)

| Case | Expect |
|------|--------|
| Mostly Devanagari shop text | response=`NEPALI_DEVANAGARI` |
| Mostly romanized (`aaja ko bikri`) | response=`ROMANIZED_NEPALI` |
| Formal EN accounting | response=`ENGLISH`, register=`ACCOUNTING_FORMAL` |
| `tapai` / `hajur` | register=`SHOP_INFORMAL` |
| Bundle | `silent_applications=0`; raw unchanged |

## Non-goals

- Rewriting model SSE output in ingress
- Linguist / production approval
- MAI-12 training pipeline
