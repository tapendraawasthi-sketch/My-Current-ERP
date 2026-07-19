# ADR_0042 — Structural Segmentation / OCR Gate Authority

- **Status:** Accepted (2026-07-19); slice 2 addendum (2026-07-19)
- **Phase:** MAI-25-EXTRACTION-OCR-AND-STRUCTURAL-SEGMENTATION (slice 2)
- **Extends:** ADR_0001, ADR_0041

## Context

MAI-24 owns knowledge-source collection governance. Document structure and OCR
are still ad-hoc. MAI-25 must first annotate structural segments, then consume
them into an extraction/OCR plan without invoking OCR.

## Decision

1. MAI-25 owns `StructuralSegmentationBundleV1` on `CanonicalAIRequestV1`
   after KNOWLEDGE_SOURCE_GOVERNANCE.
2. Slice 1: deterministic line/block segmentation when governance is COMPLETE;
   `ocr_invocations=0`; `extraction_mutations=0`; `ocr_recommended=false`;
   `is_execution_authority=false`.
3. Slice 2: `ExtractionOcrPlanBundleV1` from COMPLETE segments; text →
   `SKIP_OCR`; image attachment cue → `OCR_CANDIDATE` plan step only;
   `ocr_execution_authorized=false` always; forward into `policy_decisions`
   with authority flags stripped.
4. SKIP when governance/segmentation is not COMPLETE or raw text is empty.
5. Does not call OCR providers, execute `ocr.extract`, or mutate indexes/drafts.
6. GAP-P2-008 stays OPEN; GAP-P1-004 / GAP-P1-008 stay REDUCED.
7. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Invoke OCR in ingress | Side effects / wrong authority |
| Authorize OCR from candidate step | Constitution violation |
| Mutate KB raw sources | Immutability violation |
| Segment while governance SKIP | Fail-closed for OOD |

## Related

- `docs/mokxya-ai/MAI_25_EXTRACTION_OCR_AND_STRUCTURAL_SEGMENTATION.md`
- `erp_bot/src/oip/modules/conversation/application/structural_segmentation_service.py`
- `erp_bot/src/oip/modules/conversation/application/extraction_ocr_plan_service.py`
