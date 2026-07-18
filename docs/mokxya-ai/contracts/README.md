# MokXya AI Contracts Catalogue

## Current version

**1.0.0** (MAI-02)

## Supported versions

- `1.0.0` (and wire-compatible legacy marker `1.0` via adapters)

## Canonical source

`erp_bot/src/oip/contracts/`

## Generated artifacts

`erp_bot/src/oip/contracts/schemas/v1/*.json`

## Shared fixtures

`erp_bot/src/oip/contracts/fixtures/`

Regenerate:

```text
cd erp_bot
python -m src.oip.contracts.fixtures_data
```

## Regeneration command

```text
cd erp_bot
python -m src.oip.contracts.export_schemas
```

Drift check:

```text
cd erp_bot
python -m src.oip.contracts.export_schemas --check
```

## Active request authority

```text
CanonicalAIRequestV1  --(CanonicalOipRequestAdapter)-->  IntelligenceRequestDto
```

`IntelligenceRequestDto` is temporary compatibility only. Do not construct it from untrusted body identity fields.
## Validation commands

```text
cd erp_bot
python -m pytest tests/oip/test_mai02_canonical_contracts.py -q

# from repo root
npm run test:orbix-contract
npx tsc -p tsconfig.mai02.json --noEmit
```

## Top-level contracts

| Contract | Module |
|----------|--------|
| ClientTurnPayloadV1 | `request.py` |
| TrustedScopeV1 / CanonicalAIRequestV1 | `request.py` |
| LanguageFrameV1 | `language.py` |
| TurnRelationV1 / IntentCandidateV1 | `dialogue.py` |
| EventFrameV1 | `event_frame.py` |
| PlanV1 / ToolCallV1 / ToolObservationV1 | `plan_tools.py` |
| EvidenceItemV1 / ClaimV1 | `evidence.py` |
| DraftReferenceV1 / PreviewV1 / ReceiptV1 | `draft_preview.py` |
| AIResponseEnvelopeV1 | `response.py` |
| SSEEventEnvelopeV1 | `sse.py` |

## Legacy adapters

`erp_bot/src/oip/contracts/adapters/legacy_orbix.py`

- LegacyOrbixClientRequestAdapter
- LegacyOrbixSseEventAdapter
- LegacyDraftCardAdapter
- LegacyReportSpecAdapter
- LegacyExecutionFlagAdapter

## Frontend

- Canonical Zod: `src/lib/ekhata/mai02CanonicalContracts.ts`
- Legacy wire: `src/lib/ekhata/orbixResponseTypes.ts` + `orbixResponseAdapter.ts`

## Deprecation policy

Legacy Orbix complete shape supported until all active consumers migrate. Do not delete adapters in later phases without a dedicated migration gate. Falcon/NIOS stacks remain deferred stranglers.
