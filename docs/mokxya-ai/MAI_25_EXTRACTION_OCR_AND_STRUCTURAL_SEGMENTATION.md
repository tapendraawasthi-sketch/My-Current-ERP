# MAI-25 — Extraction, OCR, and Structural Segmentation

**Date:** 2026-07-19  
**Status:** `PASSED_ENGINEERING`  
**Authority:** [ADR_0042](decisions/ADR_0042_STRUCTURAL_SEGMENTATION_AUTHORITY.md)  
**Runtime:** `mai-25.0.2-slice2` (engineering; not production-approved)

## Objective

Annotate structural segments, then consume them into an extraction/OCR plan —
without invoking OCR or granting execution authority.

## Slice 1

1. Ingress `STRUCTURAL_SEGMENTATION_*` after KNOWLEDGE_SOURCE_GOVERNANCE
2. `StructuralSegmentationBundleV1` on `CanonicalAIRequestV1`
3. COMPLETE governance → line/block kinds
4. `ocr_invocations=0`; `ocr_recommended=false`

## Slice 2

1. Ingress `EXTRACTION_OCR_PLAN_*` after STRUCTURAL_SEGMENTATION
2. `ExtractionOcrPlanBundleV1` from COMPLETE segments
3. Text input → `SKIP_OCR`; image attachment cue → `OCR_CANDIDATE` (plan only)
4. `ocr_execution_authorized=false` always; `tool_executions=0`
5. Forward plan into `policy_decisions` / execution metadata (stripped of authority)

## Gates

| Case | Expect |
|------|--------|
| Purchase text | COMPLETE plan; SKIP_OCR |
| RECORD / table | PARSE_* steps; SKIP_OCR |
| Image attachment cue | OCR_CANDIDATE; still not authorized |
| OOD | SKIP |
| Any bundle | `ocr_invocations=0` |

## Non-goals

- Calling OCR providers / `ocr.extract` execution
- Closing GAP-P2-008 / GAP-P1-004 / GAP-P1-008
- Production approval
