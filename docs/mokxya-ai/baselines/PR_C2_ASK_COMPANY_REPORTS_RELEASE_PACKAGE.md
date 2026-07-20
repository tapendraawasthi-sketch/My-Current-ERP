# PR-C2 — Ask Company Reports Release Package

**Date:** 2026-07-20  
**Step:** PR-C2  
**ADR:** ADR_0092  
**Row:** LAUNCH-ASK-COMPANY-REPORTS  

## Proven (engineering package)

| Claim | Evidence |
|-------|----------|
| Release dossier filed | `docs/mokxya-ai/releases/LAUNCH_ASK_COMPANY_REPORTS_V1.md` |
| Capability gate wired (OFF) | registry + `launchAskCompanyReportsReleasePolicy` |
| Zero-mutation disclosed | dossier §3 + policy constants |
| Monitoring / rollback documented | dossier §6–7 |
| Flag not armed | `flag_armed=false`; row `production_approved=false` |

## Not proven (blocks arm)

| Row | Status |
|-----|--------|
| Owner sign-off (Ask reports) | PENDING |
| Staging golden path green | PENDING (PR-B1 tickets) |
| Knowledge staging ticket | OPEN (TICKET-PR-B5-001) |
| Matrix depth=PRODUCTION | **not set** |

## Pointer

recommended_next_step → **PR-C1-ARM** (first PRODUCTION row still human-blocked)  
PR-C2-ARM → after Ask tickets + owner sign-off (parallel after C1 arm or when ready)
