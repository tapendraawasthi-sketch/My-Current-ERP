# ADR_0028 — Response Language and Register Policy Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-11-RESPONSE-LANGUAGE-AND-REGISTER-POLICY (slice 1)
- **Extends:** ADR_0006, ADR_0025, ADR_0027

## Context

LanguageFrame already has `dominant_response_language` and `linguistic_register`
fields, but MAI-05 leaves them unset (`deferred to MAI-11`). Product replies
still rely on unversioned prompt tone. Shop users expect the assistant to
mirror their script/form (Devanagari / Romanized Nepali / English) and use an
appropriate register (shop informal vs accounting formal).

## Decision

1. MAI-11 owns **response language + register policy** via
   `ResponseRegisterBundleV1` on `LanguageFrame` — annotation / policy only;
   never mutates raw user text; never auto-rewrites model output in slice 1.
2. Policy sets `dominant_response_language` and `linguistic_register` on the
   frame from distribution + code-mix + honorific/accounting cues.
3. Response language taxonomy: `NEPALI_DEVANAGARI`, `ROMANIZED_NEPALI`,
   `ENGLISH`, `MIXED`, `UNKNOWN`.
4. Register taxonomy: `SHOP_INFORMAL`, `ACCOUNTING_FORMAL`, `NEUTRAL`,
   `UNKNOWN`.
5. Mirror-user recommendation is explicit (`mirror_user_language=true` when
   confident); MIXED / UNKNOWN must not force a single script rewrite.
6. Slice 1 is engineering-gated: `production_approved=false`. Prompt/template
   consumption is slice 2+.

## Rejected

| Alternative | Why |
|-------------|-----|
| Keep prompt-only tone | Unversioned; not measurable |
| Silent response rewrite in ingress | Silent mutation |
| Always reply Devanagari | Breaks romanized shop users |

## Related

- `docs/mokxya-ai/MAI_11_RESPONSE_LANGUAGE_AND_REGISTER_POLICY.md`
- `erp_bot/src/oip/modules/language_runtime/response_register/`
