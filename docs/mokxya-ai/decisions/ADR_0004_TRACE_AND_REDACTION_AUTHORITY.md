# ADR_0004 — Trace and Redaction Authority

## Status

Accepted (MAI-03)

## Context

Active Orbix path lacked a single safe correlation story across browser → Node → Python → SSE → frontend. Existing OIP observability used contextvars and structured logs but reflected invalid IDs, could log raw messages, and had no central redaction. No OpenTelemetry SDK is present.

## Decision

1. **Authority:** Extend `erp_bot/src/oip/infrastructure/observability` as MAI-03 (`mai03_*` modules). Do not add a third tracer.
2. **OpenTelemetry:** Not reused (SDK absent). Do not introduce OTEL alongside another active framework in this phase.
3. **Identity:** UUID/32-hex correlation (header max 128); per-hop request UUID; opaque `tr_*` support reference.
4. **Propagation:** Headers `X-Correlation-ID` / `X-Request-ID`; Python `contextvars` TraceContextV1; Node Express locals; SSE + envelope `trace_reference`.
5. **Sink:** Sanitized structured logging production foundation + bounded in-memory sink for tests/dev only.
6. **Redaction:** Central allowlist-first fail-closed redactor (`REDACTION_VERSION=mai-03.1.0`).
7. **Lookup:** Policy port with auth + `view_debug_traces` + tenant scope; default `TRACE_LOOKUP_UNAVAILABLE` without queryable sink. No production endpoint pretending durability.
8. **Excluded data:** prompts, messages, tool payloads, secrets, financial PII, model reasoning/`<think>`.

## Alternatives rejected

| Alternative | Why rejected |
|-------------|--------------|
| New OpenTelemetry stack | Not already authoritative; dual frameworks forbidden |
| Third parallel tracer | Stop condition |
| Durable DB store in MAI-03 | No essential store; avoid migration |
| Client-supplied free-form IDs | Spoof / PII risk |
| Unhashed free-form local JSON files | Fake production authority |

## Consequences

- Safer active-path logs; support references for errors
- Operators must not treat in-memory sink as production observability
- Durable lookup deferred to later operations phase

## Rollback

Revert MAI-03 Python observability files, ingress/server correlation hooks, Node `correlation.ts` + khata wiring, FE `mai03Trace*`, tests, docs/ADR/catalogue/baseline/ledger entries. No DB migration. Do not destroy unrelated dirty-worktree files.
