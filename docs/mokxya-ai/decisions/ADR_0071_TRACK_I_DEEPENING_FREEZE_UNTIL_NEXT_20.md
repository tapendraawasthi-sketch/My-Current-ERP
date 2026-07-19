# ADR_0071 — Track I Deepening Freeze Until NEXT-20

- **Status:** Accepted (2026-07-19)
- **Step:** NEXT-01 (`MOKXYA_AI_WHAT_MUST_BE_DONE_NEXT_V1.txt`)
- **Extends:** ADR_0001; companion matrix NEXT-00
- **Applies to:** MAI-50, MAI-51, MAI-52, MAI-53 (master Track I)

## Context

Master roadmap Track I (speech, private documents, CA workpapers, compliance
calendar) reached `PASSED_ENGINEERING` as policy + `CANDIDATE_ONLY` consume
only. The product still lacks Bars A–E (safety, shop language quality,
bookkeeping loop, knowledge honesty, one narrow production release).

Deepening Track I now would add feature theatre without launch capability.

## Decision

1. MAI-50…MAI-53 remain `PASSED_ENGINEERING` / `CANDIDATE_CONSUMED` and
   **dormant** for implementation deepening.
2. Forbidden until **NEXT-20** is `DONE` (or the owner records a written risk
   acceptance that explicitly reopens Track I early):
   - live ASR / TTS / microphone arming / audio persistence
   - private document ingest / live QA over uploads
   - CA engagement open / workpaper post / binder release
   - compliance calendar enable / obligation create / reminder send /
     automation arm / filing submit
3. Existing fail-closed flags stay false on live paths
   (`allow_*=false`, speech disabled, ingest disabled, etc.).
4. Post-MAI-53 work follows Waves 1–5 in
   `MOKXYA_AI_WHAT_MUST_BE_DONE_NEXT_V1.txt` (NEXT-02 onward).
5. Exception path: owner may reopen Track I only via a dated risk-acceptance
   note that names which NEXT-30…33 step is authorized and which Bar A–E
   items remain accepted-open.

## Rejected

| Alternative | Why |
|-------------|-----|
| Invent MAI-54+ Track I policy phases | Roadmap exhausted; policy stubs already exist |
| Build speech/OCR/CA/calendar before NEXT-20 | Violates product bar order; inflates false readiness |
| Treat PASSED_ENGINEERING as production speech/docs | Honesty violation |

## Consequences

- Cursor “go” default advances to **NEXT-02** (GAP-P0-001), not Track I.
- Truth matrix `live_effect=DORMANT_TRACK_I` remains binding.
- NEXT-30…33 stay `BLOCKED_UNTIL_NEXT-20` until release or exception.

## Related

- `MOKXYA_AI_WHAT_MUST_BE_DONE_NEXT_V1.txt` (NEXT-01, NEXT-20, NEXT-30…33)
- `docs/mokxya-ai/MAI_CAPABILITY_TRUTH_MATRIX.json`
- ADR_0067…ADR_0070 (Track I policy authorities — unchanged; not deepened)
