# ADR_0042 — Structural Segmentation / OCR Gate Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-25-EXTRACTION-OCR-AND-STRUCTURAL-SEGMENTATION (slice 1)
- **Extends:** ADR_0001, ADR_0041

## Context

MAI-24 owns knowledge-source collection governance. Document structure and OCR
are still ad-hoc. MAI-25 must first annotate structural segments of request
text without invoking OCR or mutating indexes/drafts.

## Decision

1. MAI-25 owns `StructuralSegmentationBundleV1` on `CanonicalAIRequestV1`
   after KNOWLEDGE_SOURCE_GOVERNANCE.
2. Slice 1: deterministic line/block segmentation when governance is COMPLETE;
   `ocr_invocations=0`; `extraction_mutations=0`; `ocr_recommended=false`;
   `is_execution_authority=false`.
3. SKIP when governance is not COMPLETE or raw text is empty.
4. Does not call OCR providers, parsers that rewrite sources, or index builders.
5. Slice 2 (later): consume segments into extraction/OCR planning under
   constitution gates.
6. GAP-P2-008 stays OPEN; GAP-P1-004 / GAP-P1-008 stay REDUCED.
7. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Invoke OCR in ingress | Side effects / wrong authority |
| Mutate KB raw sources | Immutability violation |
| Segment while governance SKIP | Fail-closed for OOD |

## Related

- `docs/mokxya-ai/MAI_25_EXTRACTION_OCR_AND_STRUCTURAL_SEGMENTATION.md`
- `erp_bot/src/oip/modules/conversation/application/structural_segmentation_service.py`
