# ADR_0062 — Load, Latency, Resource, and Failover Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-45-LOAD-LATENCY-RESOURCE-AND-FAILOVER (slice 2)
- **Extends:** ADR_0001, ADR_0003

## Context

MAI-36–44 cover legal research through security/tenant red-team candidates.
Load/latency/resource/failover work for Nepal deployment conditions needs an
explicit candidate policy before any pilot-SLO-met claim or production
performance approval. Safety must not be bypassed under timeout.

## Decision

1. MAI-45 owns `LoadLatencyFailoverBundleV1` on `CanonicalAIRequestV1`
   after SECURITY_TENANT_RED_TEAM.
2. Semantic gate: cue detection only (load/latency/resource/failover/
   cascade/soak/capacity) — **not** MAI-36 research or MAI-44 pen-test pass.
3. Slice 1: declare
   `pilot_scope=LOAD_LATENCY_FAILOVER_CANDIDATE_ONLY`,
   `release_status=NOT_RELEASED`,
   `gold_questions_status=NOT_RELEASED`,
   `specialist_signoff_status=NOT_SIGNED`,
   `pilot_slos_met=false`,
   `bounded_degradation_proven=false`,
   `safety_bypass_under_timeout=false`,
   `cost_resource_measured=false`,
   `capacity_proven=false`,
   `load_test_passed=false`,
   `failover_proven=false`,
   `production_perf_approved=false`,
   `gap_p2_008_status=OPEN`.
4. Slice 2: consume builds `load_latency_failover_candidate` /
   `load_latency_failover_consume_ready` under default `CANDIDATE_ONLY`.
   Stage profiles, cascade tuning, index benchmarks, load/soak plan,
   capacity plan, and definitive answer stay null. Live ingress forces
   `allow_load_test=false` and `allow_slo_claim=false`. Label-only invoke
   modes exist for unit tests only.
5. Never invent SLO pass, capacity proof, or allow safety bypass under
   timeout from cue detection alone.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Gate on MAI-44 pen_review_passed | Pen review must stay false |
| Claim pilot SLOs met in slice 1–2 | Measured baselines / soak required |
| Live load-test / SLO claim in slice 2 | Authority / honesty risk |
| Safety bypass under timeout | Roadmap gate forbids it |
| Close GAP-P2-008 | Honesty review still required |
| Production perf approval | Capacity / cost / residual risk required |

## Related

- `docs/mokxya-ai/MAI_45_LOAD_LATENCY_FAILOVER.md`
- `docs/mokxya-ai/baselines/MAI_45_SLICE1_BASELINE_SUMMARY.md`
- `docs/mokxya-ai/baselines/MAI_45_SLICE2_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/load_latency_failover_service.py`
- `erp_bot/src/oip/modules/conversation/application/load_latency_failover_consume_service.py`
