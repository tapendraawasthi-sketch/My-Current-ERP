# MAI-05 — Span-Level Script, Language-Form, and Protected Spans

## 1. Objective

Detect Unicode script and language-form at span level, protect identifiers/URLs/etc., populate `LanguageFrameV1` before intent — without normalizing, transliterating, or changing accounting/routing behavior.

## 2. Pre-edit language inventory

| Asset | Role | Authority for MAI-05? |
|-------|------|------------------------|
| `LanguageFrameV1` contract | Structure only (`NOT_RUN`) | Extended |
| `nlu/text_normalize.py` | Rewrites variants | Deferred (MAI-06) |
| `np_kb_adapter` | Enrichment / KB | Deferred |
| `nepali_shop_nlu` | Intent/shop NLU | Unchanged |
| New `language_runtime` | Span analysis | **Yes** |

Stop conditions: none. No dual active analyzers. Raw text preserved at ingress.

## 3. Selected language authority

`erp_bot/src/oip/modules/language_runtime/` — analyzer version `mai-05.1.0`.

## 4. Offset semantics

Canonical unit: **UNICODE_CODE_POINT**. Python `str` slicing; TS helper `mai05CodePointOffsets.ts` uses `Array.from`.

## 5–7. Taxonomies

See `LANGUAGE_FORM_TAXONOMY.md` and `PROTECTED_SPAN_POLICY.md`.

## 8. Detection priority

Protected spans before ordinary tokens; priority list in `domain/protected.py`.

## 9. Input-quality / Unicode flags

Detected, not removed. Trace stores counts/flag names only.

## 10–12. Segmentation / Romanized / Ambiguity

Whitespace/punctuation preserved; Romanized lexicon conservative; ambiguous Latin abstains.

## 13. Compact resources

`language_runtime/resources/*` — hashed pack, load-once cache.

## 14. Active pipeline integration

`oip_chat_ingress.build_canonical_ai_request` after canonical build: `LANGUAGE_ANALYSIS_*` stages, typed `canonical.language_frame`. Failure → `FAILED` frame; raw text intact; no purchase default.

## 15. Trace/privacy

Safe counts/versions only; no raw spans/text in MAI-03 events.

## 16. MAI-05 dataset

`evals/mai05/` — ≥300 cases, prohibited for training. Separate from MAI-04.

## 17–18. Metrics / results

See `baselines/MAI_05_LANGUAGE_SPAN_BASELINE.md`. Gates passed.

## 19. MAI-04 regression

Dataset hash unchanged: `1fe463dc302b7e990b8e3bb0abcd5a0cbf4e05fcab4eaec30a27ed3b4a1b6fac`.

## 20–21. Security / accounting

Positive detection flags; **no** posting/sync/OEC changes.

## 22. Known limitations

Linguist review still needed for many Romanized/naturalness judgments; no transliteration/normalization (MAI-06/07).

## 23. Rollback

Remove `language_runtime`, MAI-05 evals/docs/tests; revert optional contract fields/ingress hook. No destructive git reset.

## 24. Gate verdict

**PASSED**. `production_approved=false`. MAI-06 not started.
