# MAI-25 — Extraction, OCR, and Structural Segmentation

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0042](decisions/ADR_0042_STRUCTURAL_SEGMENTATION_AUTHORITY.md)  
**Runtime:** `mai-25.0.1-slice1` (engineering; not production-approved)

## Objective

Annotate deterministic structural segments of request text when knowledge-source
governance is COMPLETE — without invoking OCR or mutating sources/indexes.

## Slice 1

1. Ingress `STRUCTURAL_SEGMENTATION_*` after KNOWLEDGE_SOURCE_GOVERNANCE
2. `StructuralSegmentationBundleV1` on `CanonicalAIRequestV1`
3. COMPLETE governance → line/block kinds (HEADING, RECORD_BLOCK, TABLE_CUE,
   LIST_ITEM, FREE_TEXT)
4. Governance SKIP / empty text → SKIP
5. `ocr_invocations=0`; `ocr_recommended=false`; `is_execution_authority=false`

## Gates

| Case | Expect |
|------|--------|
| Purchase utterance | COMPLETE; FREE_TEXT segment(s) |
| RECORD / heading / table cues | matching kinds |
| OOD | SKIP |
| Any bundle | `ocr_invocations=0` |

## Non-goals

- OCR provider calls / consume (later slice)
- Closing GAP-P2-008 / GAP-P1-004 / GAP-P1-008
- Production approval
