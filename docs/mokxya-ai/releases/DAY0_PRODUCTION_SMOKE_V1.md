# Day-0 production smoke — LAUNCH rows V1

**Date:** _pending run_  
**Step:** PR-C3 / ADR_0093  
**Pack status:** **READY**  
**Smoke status:** **NOT_RUN** (do not mark PASS until executed)

## Preconditions

- [ ] At least `LAUNCH-ACCOUNTANT-SALES-PURCHASE` armed (PR-C1-ARM) **or**
      owner-written pilot acceptance naming residual risks
- [ ] Designated production or pilot company selected
- [ ] Operator has confirm path + Day Book / registers access
- [ ] Rollback known: set launch flags OFF if smoke FAIL

## Smoke cases (must all PASS for PR-C3-RUN)

| # | Case | Result | Evidence |
|---|------|--------|----------|
| 1 | One purchase (draft → confirm → receipt) | _pending_ | receipt id / screenshot |
| 2 | One sale (draft → confirm → receipt) | _pending_ | receipt id / screenshot |
| 3 | One Ask company report (BS / P&L / TB / ledger) | _pending_ | answer + company scope |
| 4 | One refuse / abstain case (ungrounded tax/law) | _pending_ | refuse string |
| 5 | Receipt IDs visible in Day Book / registers | _pending_ | register refs |
| 6 | Sync badge honesty (queued ≠ synced) | _pending_ | badge state note |

## Operator notes

_Company:_  
_Environment URL:_  
_Operator name:_  
_Start / end time:_  

## Verdict

| Field | Value |
|-------|-------|
| Smoke pack | READY (ADR_0093) |
| Smoke execution | NOT_RUN |
| Smoke PASS | **false** until table above is filled green |
| Rollback triggered | n/a until run |

## Explicit non-claims (until PR-C3-RUN)

- Not production Day-0 green
- Not NEXT-20 DONE by this file alone
- Not a substitute for staging golden path (PR-B1)
