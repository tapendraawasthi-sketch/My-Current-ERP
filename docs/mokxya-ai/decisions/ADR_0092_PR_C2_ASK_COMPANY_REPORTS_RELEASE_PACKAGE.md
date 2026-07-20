# ADR_0092 — PR-C2 Ask Company Reports Release Package

- **Status:** Accepted (2026-07-20)
- **Step:** PR-C2
- **Outcome:** Engineering package **READY**; capability flag **OFF**

## Context

PR-C1 shipped the sales/purchase release package (ADR_0090) with the gate
wired off. PR-C1-ARM remains BLOCKED on human staging tickets and owner
sign-off (ADR_0091). The plan allows PR-C2 (Ask company reports) to ship
as the same shape of release package while the first-row arm waits.

## Decision

1. File release dossier for `LAUNCH-ASK-COMPANY-REPORTS`.
2. Wire registry + Python/TS policy gates with `flag_armed=false` and
   `production_approved=false`.
3. Document zero-mutation proof, LEXICAL_ONLY prod retrieval, citation /
   no-answer honesty, monitoring, and rollback.
4. **Do not** set matrix `depth=PRODUCTION` or claim NEXT-20 DONE.
5. Keep `recommended_next_step = PR-C1-ARM` (first PRODUCTION row still
   blocked on humans). Arm for Ask reports is a later **PR-C2-ARM**.

## Explicit non-claims

- Not production_approved (row or global)
- Not second PRODUCTION row live
- Not owner-signed for Ask reports
- Not staging golden path green

## Related

- ADR_0090 / ADR_0091 (sales/purchase package + arm attempt)
- `docs/mokxya-ai/releases/LAUNCH_ASK_COMPANY_REPORTS_V1.md`
- `docs/mokxya-ai/MAI_LAUNCH_ASK_COMPANY_REPORTS_RELEASE_REGISTRY.json`
- `erp_bot/src/oip/modules/conversation/application/launch_ask_company_reports_release_policy.py`
- `src/platform/release/launchAskCompanyReportsReleasePolicy.ts`
- `artifacts/prod-ready-pr-c2/`
- `docs/mokxya-ai/baselines/PR_C2_LAUNCH_ASK_COMPANY_REPORTS_RELEASE_PACKAGE.md`
