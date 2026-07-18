# ADR_0003 — Canonical AI Contract Authority

## Status

Accepted (MAI-02)

## Context

Multiple overlapping AI payload shapes existed (IntelligenceRequestDto, Orbix SSE complete dicts, frontend OrbixResponse Zod types, OIP integration snapshots, dormant platform contracts). Drift and untyped dictionaries crossed trust boundaries.

## Decision

1. **Canonical authority**: Pydantic v2 models in `erp_bot/src/oip/contracts/` at `schema_version` **1.0.0**.
2. **JSON Schema**: Deterministically exported to `erp_bot/src/oip/contracts/schemas/v1/`.
3. **Frontend**: Explicit TypeScript + Zod in `src/lib/ekhata/mai02CanonicalContracts.ts`, parity-tested against shared fixtures (no fragile custom schema→TS generator).
4. **Legacy**: Named adapters only at ingress/egress. Internal modules prefer canonical types.
5. **Trust**: `TrustedScopeV1` never from client body; only MAI-01 authenticated context.
6. **Active request authority (closure)**: `CanonicalAIRequestV1` is constructed and validated **before** the orchestrator call. `IntelligenceRequestDto` is a **temporary compatibility projection** produced only by `CanonicalOipRequestAdapter`. Free-form metadata is **not** an authority boundary and must not be the only carrier of trusted identity or the canonical request.
7. **Active response authority**: `AIResponseEnvelopeV1` is validated before terminal SSE COMPLETE; failures become safe ERROR / validated `general_error` complete — never an unvalidated COMPLETE.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Make frontend Zod the authority | Server must enforce; FE can be bypassed |
| OpenAPI-first from FastAPI as sole source | Active Orbix path is SSE-heavy; incomplete OpenAPI coverage |
| Hand-written duplicate dicts without drift tests | Drift already observed |
| Float-based money TypedDicts | Accounting-unsafe |
| Store CanonicalAIRequestV1 only in free-form metadata while body→DTO remains authoritative | Fails MAI-02 authority gate (closure) |

## Versioning

SemVer on `schema_version`. Unsupported major → stable `UNSUPPORTED_SCHEMA_VERSION`. Contract version separate from model/prompt/knowledge versions.

## Generation / parity

```text
python -m src.oip.contracts.export_schemas
python -m src.oip.contracts.export_schemas --check
```

Shared fixtures validated in Python and Vitest.

## Legacy compatibility

Wire still emits Orbix `schema_version: "1.0"` complete events. Adapters normalize and validate. Deprecation when all consumers migrate (not in MAI-02).

## Dependency direction

`adapters` → `contracts` → (does not import accounting engines)
Frontend Zod ↔ fixtures ↔ Python models
MAI-01 constitution supplies TrustedScope inputs

## Security consequences

- Client cannot construct TrustedScope
- `execution_allowed` not a canonical model-controlled field
- ERROR payloads cannot carry stack traces
- Unknown response types cannot render as accounting cards

## Migration consequences

Active Orbix ingress/SSE only. Falcon/NIOS/v2 deferred. `IntelligenceRequestDto` retained as orchestrator compatibility target via `CanonicalOipRequestAdapter` only — not constructed from untrusted body fields, and not authorized by a metadata sidecar.

## Rollback

Remove `erp_bot/src/oip/contracts/`, MAI-02 tests/docs, revert ingress adapter hooks and FE unsupported_response handling. No DB migration. Do not `git reset --hard`.
