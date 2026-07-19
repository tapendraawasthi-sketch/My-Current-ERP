# MAI-45 — Load, Latency, Resource, and Failover

**Date:** 2026-07-19  
**Status:** `PASSED_ENGINEERING`  
**Authority:** [ADR_0062](decisions/ADR_0062_LOAD_LATENCY_FAILOVER_AUTHORITY.md)  
**Runtime:** `mai-45.0.2-slice2` (engineering; not production-approved)

## Objective

Declare a candidate policy for load/latency/resource/failover topics (load/
soak tests, latency SLOs, resource budgets, cascade tuning, capacity plans)
without claiming pilot SLOs met, allowing safety bypass under timeout, or
production performance approval.

## Slice 1

1. Ingress `LOAD_LATENCY_FAILOVER_*` after SECURITY_TENANT_RED_TEAM
2. Semantic input: cue detection (not MAI-36 research / MAI-44 pen-test)
3. Scope: `LOAD_LATENCY_FAILOVER_CANDIDATE_ONLY`
4. Release / gold = `NOT_RELEASED`
5. Specialist sign-off = `NOT_SIGNED`
6. `pilot_slos_met=false`; `safety_bypass_under_timeout=false`;
   `capacity_proven=false`; `production_perf_approved=false`
7. GAP-P2-008 OPEN

## Slice 2

1. `resolve_load_latency_failover_consume_mode` /
   `build_load_latency_failover_candidate`
2. Default `CANDIDATE_ONLY` — stage profiles / cascade / benchmarks /
   soak plan / capacity plan / definitive = null
3. Fake SLO claim → `BLOCKED`; non-pilot → `SKIP`
4. Live path forces `allow_load_test=false` / `allow_slo_claim=false`
5. Metadata: `load_latency_failover_consume_ready` +
   `load_latency_failover_candidate`

## Gates

| Case | Expect |
|------|--------|
| Load / latency / failover / cascade / capacity cues | COMPLETE → `CANDIDATE_ONLY` |
| Fake pilot_slos_met claim | `BLOCKED` |
| Purchase / VAT / security-only without perf cues | SKIP |
| Any live path | never claim SLOs met / never bypass safety; gap OPEN |

## Non-goals

- Measured load/soak execution
- Pilot SLO pass claim
- Safety bypass under timeout
- Production performance approval
- Closing GAP-P2-008
