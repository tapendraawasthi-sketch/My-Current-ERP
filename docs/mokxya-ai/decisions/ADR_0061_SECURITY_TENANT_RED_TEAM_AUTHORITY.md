# ADR_0061 — Security and Tenant Red Team Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-44-SECURITY-AND-TENANT-RED-TEAM (slice 2)
- **Extends:** ADR_0001, ADR_0002

## Context

MAI-36–43 cover legal research through continuous-change candidates. Security
and tenant red-team work (isolation, authorization, confirmation attacks,
prompt/tool injection, document safety, secret leakage) needs an explicit
candidate policy before any pen-test pass claim or production security
approval. GAP-P0-001 and GAP-P2-008 remain open.

## Decision

1. MAI-44 owns `SecurityTenantRedTeamBundleV1` on `CanonicalAIRequestV1`
   after CONTINUOUS_CHANGE_INTELLIGENCE.
2. Semantic gate: cue detection only (tenant/authz/confirm/injection/doc/
   secret) — **not** MAI-36 research completeness (security ≠ legal research).
3. Slice 1: declare
   `pilot_scope=SECURITY_TENANT_RED_TEAM_CANDIDATE_ONLY`,
   `release_status=NOT_RELEASED`,
   `gold_questions_status=NOT_RELEASED`,
   `specialist_signoff_status=NOT_SIGNED`,
   `isolation_proven=false`,
   `zero_critical_findings_claimed=false`,
   `confirmation_attacks_blocked_proven=false`,
   `injection_capability_broadening_blocked_proven=false`,
   `pen_review_passed=false`,
   `remediation_closed=false`,
   `production_security_approved=false`,
   `gap_p0_001_status=OPEN`,
   `gap_p2_008_status=OPEN`.
4. Never invent pen-test pass, zero-critical claims, or production security
   approval from cue detection alone.
5. Slice 2: consume builds `security_red_team_candidate` /
   `security_red_team_consume_mode` (`CANDIDATE_ONLY` default for
   POLICY_DECLARED / SCOPE_PARTIAL; `BLOCKED` for fake authority;
   `SKIP` for non-pilot). Live path forces `allow_pen_review=false`
   and `allow_zero_critical_claim=false` — does **not** claim pen-test
   pass or zero critical findings. Gaps stay OPEN.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Gate on MAI-36 research COMPLETE | Security red team ≠ legal research |
| Claim zero critical findings in slice 1–2 | Pen review / remediation required |
| Live pen-review pass in slice 2 | Authority / honesty risk |
| Close GAP-P0-001 / GAP-P2-008 | Honesty review still required |
| Production security approval | Residual risks must be owner-accepted |

## Related

- `docs/mokxya-ai/MAI_44_SECURITY_TENANT_RED_TEAM.md`
- `docs/mokxya-ai/baselines/MAI_44_SLICE2_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/security_tenant_red_team_service.py`
- `erp_bot/src/oip/modules/conversation/application/security_tenant_red_team_consume_service.py`
