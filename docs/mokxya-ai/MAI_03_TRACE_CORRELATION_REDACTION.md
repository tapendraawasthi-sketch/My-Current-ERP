# MAI-03 — Trace, Correlation, and Redaction Foundation

## 1. Objective

Provide one safe, structured end-to-end correlation/trace foundation for the active MokXya Orbix path so operators can explain stage reach, stage latency, component versions, and failure cause — without storing or exposing private business data, prompts, tool payloads, secrets, or model reasoning.

## 2. Pre-edit observability inventory

| Area | Finding |
|------|---------|
| OIP `correlation.py` | contextvars request/correlation/trace/span; inbound not strictly validated |
| OIP `logging.log_event` | structured JSON; previously accepted arbitrary fields including message text |
| OIP `tracing.py` | “OTEL-compatible” hex IDs; **no OpenTelemetry SDK** |
| Ingress | debug logs could include `message`/`question` |
| Node | no shared correlation middleware on confirm |
| Frontend | no opaque support reference |
| Audit DB | no dedicated queryable production trace store |
| OpenTelemetry | not an active authority |

**Stop conditions:** none triggered. Single authority selected (extend OIP observability). No third tracing system.

## 3. Selected trace authority

**Authority:** `erp_bot/src/oip/infrastructure/observability/mai03*` (extends existing OIP observability).

Not selected: OpenTelemetry SDK, commercial APM, a parallel NIOS/Falcon tracer, local JSON files as production authority.

## 4. Trace / correlation / request / span identity

| Identity | Role | Format |
|----------|------|--------|
| Correlation / Trace ID | Follows the full user operation | UUID or 32-hex; max header length **128** |
| Request ID | One hop/service request | New UUID per hop |
| Span / event ID | Stage event | Opaque UUID / hex |
| Trace reference | Opaque user-facing support key | `tr_{8hex}_{8hex}` |

Conversation, session, and draft IDs are **not** trace IDs. Invalid inbound hints are replaced (never reflected).

## 5. Header policy

- Preferred: `X-Correlation-ID`, `X-Request-ID`, response `X-Trace-Reference`
- Client may send validated correlation hint only
- Server always generates request ID
- Node propagates correlation to Python where proxying; confirm echoes safe reference
- Max accepted correlation header length: **128** characters
- No auth/tenant data in headers

## 6. TraceContextV1

Request-scoped immutable dataclass via `contextvars`. Fields: schema/policy versions, correlation source (`GENERATED` / `VALIDATED_UPSTREAM` / `INTERNAL_CONTINUATION`), optional MAI-01 scope references (opaque ids only). Cleared after completion. Background work uses `derive_background_context`.

## 7. TraceEventV1

Versioned structured event with registry stage/status, monotonic `duration_ms` (≥ 0), `component_versions`, `metrics`, `safe_attributes`, `redaction_version`.

Statuses: `STARTED`, `COMPLETED`, `FAILED`, `CANCELLED`, `BLOCKED`, `DEGRADED`.

## 8. Stage catalogue

See `TRACE_EVENT_CATALOGUE.md`. Emit only stages that execute. Deterministic `skip_llm` emits preprocess stages and **must not** emit model completion.

## 9. Active Python integration

`/orbix/chat/stream` → `start_request_trace` → constitution/auth stages → CanonicalAIRequestV1 → orchestrator → deterministic preprocess and optional model stages → SSE `request_accepted` / complete / error with shared `trace_reference` → context clear.

Dormant NIOS/Falcon/v2 stacks: **deferred**.

## 10. Active Node integration

`packages/backend/src/middleware/correlation.ts` on `/khata/confirm`: validate/generate correlation, new request ID, response headers, no auth/body logging.

## 11. Frontend support-reference behavior

`mai03Trace.ts`: remember opaque ref per conversation in memory; error may show `Support reference: tr_…`; **no** full events in localStorage.

## 12. Redaction authority

Central `mai03_redaction.py` — allowlist-first, fail-closed, `REDACTION_VERSION=mai-03.1.0`. All `log_event` fields pass through `validate_safe_event`.

## 13. Prohibited trace data

Raw messages (EN/NP/Romanized), prompts, model IO, tool args/results, tokens/secrets, PAN/VAT/bank/card, customer names, vouchers, stack traces, localStorage dumps. See `TRACE_DATA_CLASSIFICATION.md`.

## 14. Trace sinks and persistence

| Sink | Role |
|------|------|
| `StructuredLogTraceSink` | Production-safe foundation (sanitized structured logs) |
| `InMemoryTraceSink` | Tests/dev only — **not** durable production observability |

No MAI-03 DB migration. Durable queryable production lookup deferred.

## 15. Trace lookup and permissions

`lookup_trace` policy: auth required, `view_debug_traces`, tenant-scoped. Default production: `TRACE_LOOKUP_UNAVAILABLE` (503). No model/tool invocation. Ask/Accountant mode does not grant permission.

## 16. Error / cancellation behavior

One terminal event (`REQUEST_COMPLETED` / `FAILED` / `CANCELLED`). Sink failure never retries mutations or bypasses MAI-01. Client errors carry opaque `trace_reference` without internal exception details.

## 17. Latency measurement

Monotonic `time.perf_counter` durations on stages. Baseline samples in `baselines/MAI_03_LATENCY_BASELINE.json` — **not** a production SLO.

## 18. Tests and evidence

- `erp_bot/tests/oip/test_mai03_trace_redaction.py`
- `src/__tests__/orbix/mai03Trace.test.ts`
- `packages/backend/src/middleware/correlation.test.ts`
- Plus retained MAI-01/02 / Orbix / khataConfirmAuth suites

## 19. Security / privacy impact

Positive: stops raw message/prompt/token leakage on active path logger; invalid correlation reflection removed; lookup gated.

## 20. Accounting / sync impact

**None.** No accounting, posting, VAT/TDS, Dexie, sync, or OEC authority changes. GAP-P0-001 remains open.

## 21. Known limitations

- No durable queryable production trace store
- Provider path environment-dependent for live timings
- Dormant stacks not instrumented
- Playwright E2E may be environment-blocked

## 22. Rollback

Remove/revert MAI-03 observability modules + ingress/server/Node/FE wiring + tests/docs listed in ADR_0004. Prefer file-level revert; do **not** `git reset --hard` / `git clean`. No migration to roll back.

## 23. Gate verdict

**PASSED** (2026-07-14). `production_approved` remains **false**. MAI-04 not implemented.
