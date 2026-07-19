# MAI-11 — Response Language and Register Policy

**Date:** 2026-07-19  
**Status:** `PASSED_ENGINEERING`  
**Authority:** [ADR_0028](decisions/ADR_0028_RESPONSE_LANGUAGE_AND_REGISTER_POLICY_AUTHORITY.md)  
**Runtime:** `mai-11.0.2-slice2` (engineering; not production-approved)  
**Closure:** [MAI_11_ENGINEERING_CLOSURE.md](baselines/MAI_11_ENGINEERING_CLOSURE.md)

## Objective

Decide which language/script and register the assistant should use when
replying — mirroring the user when confident — and consume that policy in
provider system prompts without rewriting SSE/model output text.

## Slice 1

1. `ResponseRegisterBundleV1` policy service (`response_register` package)
2. Fill `LanguageFrame.dominant_response_language` + `linguistic_register`
3. Honorific cues (`tapai`/`hajur`) → `SHOP_INFORMAL`; accounting English →
   `ACCOUNTING_FORMAL`; else `NEUTRAL` / `UNKNOWN`
4. Wire attach after MAI-10 in `oip_chat_ingress`
5. `evals/mai11` fixtures + baseline

## Slice 2

1. `prompt_directive.py` — format policy into a system-prompt block
2. Canonical adapter emits `metadata.response_register`
3. Orchestrator forwards policy into route `policy_decisions`
4. Provider `HttpProviderAdapter` appends directive to system prompt
5. Still `applied_response_rewrite=false` (guide model; no post-hoc rewrite)

## Gates

| Case | Expect |
|------|--------|
| Romanized shop text | directive contains `ROMANIZED_NEPALI` |
| Devanagari shop text | directive contains `NEPALI_DEVANAGARI` |
| Formal EN accounting | directive contains `ACCOUNTING_FORMAL` |
| Provider system prompt | includes MAI-11 policy block when metadata present |
| Bundle | `silent_applications=0`; no SSE rewrite |

## Non-goals

- Post-hoc rewriting of model SSE tokens
- Linguist / production approval
- MAI-12 training pipeline
