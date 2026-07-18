# TRACE_EVENT_CATALOGUE

Stage names are stable string enums (`mai03_stages.TraceStage`). Statuses are closed enums.

## Active on Orbix path (may emit today)

| Stage | When | Notes |
|-------|------|-------|
| GATEWAY_RECEIVED | `/orbix/chat/stream` ingress | Always for active stream |
| AUTHENTICATION_RESOLVED | Trusted principal resolved | MAI-01 |
| TENANT_SCOPE_VALIDATED | Company/tenant validated | |
| CONSTITUTION_POLICY_EVALUATED | Policy decision | |
| CLIENT_CONTRACT_VALIDATED | Legacy/canonical client contract | |
| CANONICAL_REQUEST_BUILT | CanonicalAIRequestV1 built | |
| ORCHESTRATOR_STARTED | Kernel submit | |
| DETERMINISTIC_PREPROCESS_STARTED/COMPLETED | ERP preprocess executed | skip_llm path must not emit model complete |
| MODEL_REQUEST_STARTED/COMPLETED | Provider runtime invoked | Only if provider path runs |
| RESPONSE_VALIDATION_STARTED/COMPLETED | Canonical envelope validation | |
| SSE_STREAM_STARTED/COMPLETED | SSE emit | |
| CONFIRMATION_EVALUATED | Confirm flows (when used) | |
| REQUEST_COMPLETED / FAILED / CANCELLED | Terminal once | |

## Registered / not yet active (future MAI)

CONTEXT_LOAD_*, LANGUAGE_ANALYSIS_*, TURN_RELATION_*, ROUTING_*, PLANNING_*, TOOL_CALL_*, KNOWLEDGE_RETRIEVAL_*, EVIDENCE_ASSEMBLY_COMPLETED, DRAFT_TRANSITION, PREVIEW_GENERATED, ACTION_DISPATCH_*, SYNC_* — emit only when those stages actually execute.

## Allowed safe attributes (typical)

`trace_reference`, `correlation_source`, `message_char_length`, `outcome_code`, `policy_decision_code`, version ids under `component_versions`, counts/durations.

## Terminal behavior

Exactly one of `REQUEST_COMPLETED`, `REQUEST_FAILED`, `REQUEST_CANCELLED` per request recorder. Duplicate terminals suppressed.
