# MAI-02 — Canonical AI Contracts

## 1. Objective

Define one versioned, strictly validated contract system for MokXya AI pipeline boundaries (`schema_version` **1.0.0**). Contracts and adapters only — no language, RAG, planner, or accounting redesign.

## 2. Pre-edit contract inventory

| Area | Location | Notes |
|------|----------|-------|
| Active request DTO | `erp_bot/src/oip/application/dto/intelligence_request.py` | `IntelligenceRequestDto` — tenant/user identity fields historically mixed with client |
| Active SSE complete | `erp_bot/src/api/oip_chat_ingress.py` | `schema_version: "1.0"`, `response_type`, `card`, `draft_id`, `report_spec` |
| Frontend Orbix types | `src/lib/ekhata/orbixResponseTypes.ts` | Zod adapter `orbixResponseAdapter.ts` |
| OIP integration contracts | `erp_bot/src/oip/integration/contracts/` | Snapshots — not Orbix chat authority |
| Platform AI runtime | `src/platform/ai-runtime/contracts/` | Separate/dormant |
| NIOS schemas | `erp_bot/src/nios/` | Not active chat path |

Duplicates and untyped dict boundaries existed between ingress metadata, SSE complete objects, and cards.

## 3. Selected canonical authority

**Pydantic v2 models** under `erp_bot/src/oip/contracts/` export deterministic JSON Schema to `erp_bot/src/oip/contracts/schemas/v1/`. Frontend Zod types in `src/lib/ekhata/mai02CanonicalContracts.ts` are mechanically parity-tested against shared fixtures. Legacy Orbix shapes stay behind adapters only.

Rejected: inventing a third OpenAPI-first stack; manually dual-maintaining TS without fixtures;Float-money TypedDicts.

## 4. Versioning strategy

- Registry: `CURRENT_SCHEMA_VERSION = "1.0.0"`
- Unsupported major → `UNSUPPORTED_SCHEMA_VERSION`
- Legacy wire may still emit `"1.0"`; adapters normalize to `1.0.0` internally
- Contract version ≠ model/prompt/knowledge versions

## 5. Client payload versus trusted request

- `ClientTurnPayloadV1` — user-controlled fields only; forbids principal/roles/permissions/execution_allowed
- `TrustedScopeV1` — assembled only via MAI-01 authenticated context (`trusted_scope_from_mai01`)
- `CanonicalAIRequestV1` — server-assembled request used before orchestrator work

## 6. Contract catalogue

See [contracts/README.md](./contracts/README.md).

## 7. Value and Decimal rules

`MoneyV1` / quantities / percentages use **decimal strings**. Binary floats, NaN, Infinity rejected. Spans non-negative; timestamps timezone-aware; empty IDs invalid. Confidence never authorizes.

## 8. EventFrame design

`EventFrameV1` with discriminated field values (`money`, `duration`, `unknown_number`, …), provenance, missing vs ambiguous fields. Cannot hold receipts/execution success. Language classifiers deferred to MAI-05+.

## 9. Tool/evidence/claim design

`PlanV1`, `ToolCallV1` (≠ observation), `ToolObservationV1`, `EvidenceItemV1`, `ClaimV1`. Empty mutation-tool schemas invalid. Evidence class preserved; citation ≠ verification.

## 10. Draft/preview/receipt distinction

`DraftReferenceV1`, `PreviewV1` (not receipt), `ReceiptV1` (`SYNC_PENDING` ≠ `SYNCED`). Confirmation tokens deferred to MAI-34. No accounting recalculation in adapters.

## 11. Response union

`AIResponseEnvelopeV1` discriminates `response_type` ↔ `structured_payload.payload_type`. Rejects `execution_allowed`, chain-of-thought, stack traces on ERROR.

## 12. SSE events

`SSEEventEnvelopeV1` with monotonic sequence, matching payload discriminator. COMPLETE wraps validated envelope. ANSWER_DELTA text-only.

## 13. Legacy adapters

`LegacyOrbixClientRequestAdapter`, `LegacyOrbixSseEventAdapter`, `LegacyDraftCardAdapter`, `LegacyReportSpecAdapter`, `LegacyExecutionFlagAdapter` in `erp_bot/src/oip/contracts/adapters/`.

Deferred stranglers: Falcon, NIOS chat, Orbix-v2 dormant paths.

## 14. Frontend type/parsing strategy

- Legacy wire: `orbixResponseAdapter` + `OrbixResponseRenderer` (exhaustive; unknown → `unsupported_response`)
- Canonical: Zod schemas in `mai02CanonicalContracts.ts`
- Focused typecheck: `npx tsc -p tsconfig.mai02.json --noEmit`

## 15. Schema generation

```text
cd erp_bot && python -m src.oip.contracts.export_schemas
cd erp_bot && python -m src.oip.contracts.export_schemas --check
```

Second run produces no diff.

## 16. Shared fixtures

`erp_bot/src/oip/contracts/fixtures/` (+ `fixtures_data.py` regenerator). Twenty required cases including Unicode Nepali/code-mix and invalid cases.

## 17. Migration boundary

Active path only:

```text
client/legacy body
  -> LegacyOrbixClientRequestAdapter
  -> MAI-01 trusted principal binding
  -> CanonicalAIRequestV1   <-- authoritative
  -> CanonicalOipRequestAdapter
  -> IntelligenceRequestDto  <-- temporary compatibility only
  -> existing orchestrator
  -> LegacyOrbixSseEventAdapter
  -> AIResponseEnvelopeV1 + SSE COMPLETE (validated)
  -> legacy frontend wire
```

Free-form metadata may carry non-authoritative annotations (`annotations`, `egress_scope_ref`). It is **not** an authority boundary and does **not** carry a full `canonical_ai_request` blob as the primary contract.

## 18. Security invariants

Client cannot build TrustedScope; model cannot set execution_allowed; Ask mode still blocks mutation via MAI-01; no stack/think in public contracts.

## 19. Accounting impact

**None.** No calculation, posting, VAT/TDS, inventory, sync, or OEC changes.

## 20. Tests and evidence

- `erp_bot/tests/oip/test_mai02_canonical_contracts.py`
- `erp_bot/tests/oip/test_mai02_ingress_authority.py`
- `src/__tests__/orbix/mai02CanonicalContracts.test.ts`
- `docs/mokxya-ai/baselines/MAI_02_ORBIX_TEST_MANIFEST.txt`
- Pre-fix gaps: float money, mismatched payload, client identity, unknown card types — now covered

## 21. Known limitations

- No OpenAPI→TS codegen yet (fixtures + Zod parity)
- Orchestrator still receives `IntelligenceRequestDto` **only** via `CanonicalOipRequestAdapter` (deprecated transitional)
- Secondary AI stacks not migrated
- GAP-P0-001 (OEC) remains open

## 22. Rollback

Revert/remove:

- `erp_bot/src/oip/contracts/**`
- `erp_bot/tests/oip/test_mai02_*.py`
- Ingress MAI-02 blocks in `oip_chat_ingress.py`
- `src/lib/ekhata/mai02CanonicalContracts.ts`
- FE adapter/renderer unsupported_response handling
- Docs under `docs/mokxya-ai/MAI_02_*`, `ADR_0003_*`, `contracts/`

Do **not** use `git reset --hard` / `git clean`.

## 23. Gate verdict

See phase ledger — MAI-02 PASSED when closure gates below succeed.

---

## 24. Closure section (evidence)

### 24.1 Test-count reconciliation

| Claim | Command | Count |
|-------|---------|-------|
| MAI-01 gate line | vitest **orbix + khataConfirmAuth** (combined) | **141** |
| Pre-MAI-02 orbix-only (inferred) | `npm run test:orbix-contract` | **133** (= 141 − 8) |
| Post-MAI-02 orbix-only | `npm run test:orbix-contract` | **140** (= 133 + 7 `mai02CanonicalContracts`) |
| khataConfirmAuth alone | `npx vitest run packages/backend/src/middleware/khataConfirmAuth.test.ts` | **8** |
| Combined equivalent now | A + B | **148** |

**Same-command check:** The earlier **141** was **not** produced by `npm run test:orbix-contract` alone. That script only runs `src/__tests__/orbix/`. MAI-01 docs labeled the count as **orbix + khataConfirmAuth**. No tests deleted, skipped, or excluded; no `.skip`/`.only`/`.todo`; package.json script unchanged.

### 24.2 Exact test manifest evidence

`docs/mokxya-ai/baselines/MAI_02_ORBIX_TEST_MANIFEST.txt` (+ JSON reports `mai02_orbix_vitest.json`, `mai02_khata_confirm_vitest.json`).

### 24.3 Canonical request authority flow

`build_canonical_ai_request` → validate → `CanonicalOipRequestAdapter.to_intelligence_dto` → `kernel.submit`. Spied in `test_mai02_ingress_authority.py`.

### 24.4 Legacy DTO adapter boundary

`CanonicalOipRequestAdapter` is the **only** active ingress constructor of `IntelligenceRequestDto`. Identity comes solely from `canonical.trusted_scope`. Marked `DEPRECATED=True`.

### 24.5 Canonical response validation matrix

| Terminal path | Validation |
|---------------|------------|
| Answer / skip_llm-like Answer action | Legacy complete → `AIResponseEnvelopeV1` ANSWER → COMPLETE |
| Clarification | CLARIFICATION envelope |
| Draft / preview / report via card/report_spec | DRAFT/PREVIEW/REPORT via adapters |
| Policy restriction | SAFE_REFUSAL |
| Degraded/provider offline | DEGRADED |
| Validation failure | safe ERROR SSE + validated `general_error` complete (never unvalidated COMPLETE) |

### 24.6 Active versus deferred

Active: Orbix `/orbix/chat/stream` + OIP ingress. Deferred: Falcon, NIOS, orbix-v2.

### 24.7 Commands and results

Recorded in phase ledger gate_evidence after closure run.

### 24.8 Final gate decision

PASSED after closure (authoritative canonical request + reconciled test counts).
