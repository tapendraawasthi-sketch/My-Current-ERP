# TRACE_DATA_CLASSIFICATION

`REDACTION_VERSION`: `mai-03.1.0`

## Allowed trace fields (examples)

- `schema_version`, `trace_id`, `request_id`, `event_id`, `parent_event_id`
- `stage`, `status`, `started_at`, `completed_at`, `duration_ms`
- `route`, `component`, `operation`, `outcome_code`, `safe_error_code`
- Opaque scope refs: `tenant_scope_reference`, `company_scope_reference`, `principal_reference`, `conversation_reference`
- `component_versions` (model_provider/name/revision ids, prompt_id/version, tool schema version, contract/constitution versions)
- Metrics counts/durations; `message_char_length`; `response_type`; `correlation_source`; `trace_reference`; `redaction_version`

## Prohibited fields / content

Raw user text (English/Nepali/Romanized), prompts, messages arrays, model input/output, `<think>` / reasoning, tool arguments/results, retrieved document text, Authorization/JWT/API keys/cookies/passwords, connection strings, PAN/VAT, bank/card, emails/phones, customer/supplier/employee names, payroll, voucher narration, ledger dumps, invoice contents, SQL params with business data, full stack traces, frontend localStorage dumps.

## Redaction behavior

Allowlist-first. Forbidden keys → `[REDACTED]`. Unknown string fields → `[REDACTED]` or drop. Bounded depth/size. Fail-closed → minimal `{stage,status,safe_error_code:TRACE_REDACTION_FAILED}` without offending value. Idempotent.

## Retention category

- Structured logs: follow existing host log retention (operations).
- In-memory sink: process lifetime only; not a retention authority.

## Access permissions

- Default users: opaque support reference only.
- Lookup (when queryable configured): authenticated + `view_debug_traces` + matching tenant scope.
- Models/tools: must not invoke lookup.
- Ask/Accountant mode: no implicit trace permission.

## Safe vs unsafe examples

**Safe**

```json
{"stage":"CANONICAL_REQUEST_BUILT","status":"COMPLETED","duration_ms":4,"message_char_length":18,"trace_reference":"tr_aaaaaaaa_bbbbbbbb","redaction_version":"mai-03.1.0"}
```

**Unsafe (must never reach sink)**

```json
{"stage":"CANONICAL_REQUEST_BUILT","message":"मेरो नगद मौज्दात","authorization":"Bearer eyJ...","tool_arguments":{"amount":100}}
```
