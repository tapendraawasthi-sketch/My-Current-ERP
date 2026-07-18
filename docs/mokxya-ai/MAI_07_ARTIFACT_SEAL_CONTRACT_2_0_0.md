# MAI-07 Artifact Seal Contract 2.0.0

**Contract id:** `mai-07-artifact-seal-contract.2.0.0`  
**Module:** `erp_bot/src/oip/modules/language_runtime/transliteration/infrastructure/seal_contract_v2.py`  
**Phase:** MAI-07R3F-SEAL-NEW

Do not overload one SHA field with different meanings.

## A. Resource pack

| Field | Input / encoding |
| --- | --- |
| `resource_content_sha256` | For each name in `sorted(files)`: `name.encode("utf-8") + NUL + raw file bytes`. Excludes `manifest.json`. No newline normalization. Domain: `mai07.resource_pack.v1_files_nul_raw`. |
| `resource_manifest_raw_sha256` | Raw `manifest.json` file bytes on disk. |
| `resource_manifest_semantic_sha256` | SHA-256 of `json.dumps(manifest, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`. |
| `resource_file_count` | `len(files)`. |
| `resource_file_hashes` | Per-file raw SHA-256 map. |
| `resource_hash_algorithm` | `SHA-256`. |
| `resource_hash_domain` | `mai07.resource_pack.v1_files_nul_raw`. |

Producer: pack builder / `compute_pack_content_hash`. Validator: `validate_resources` (read-only).

## B. Runtime

| Field | Input |
| --- | --- |
| `runtime_source_sha256` | Sorted decision-logic sources: `filename + NUL + raw bytes`. |
| `runtime_config_sha256` | Raw guard config file bytes. |
| `runtime_semantic_sha256` | Same as source semantic hash for this RC. |
| `runtime_version` | String identity, e.g. `mai-07.1.3-r3f-sealnew`. |

## C. Predictions

| Field | Input |
| --- | --- |
| `predictions_jsonl_raw_sha256` | Raw JSONL file bytes. |
| `predictions_canonical_list_sha256` | SHA-256 of canonical JSON **array** of prediction objects sorted by `case_id`. |
| `predictions_semantic_sha256` | Same as canonical list under this contract. |
| `prediction_count` | Number of prediction objects. |
| `prediction_ordering_contract` | `sorted_by_case_id_ascending`. |
| `canonical_serialization_contract` | `json.dumps(..., sort_keys=True, separators=(",", ":"), ensure_ascii=False)`. |

## D. Reports

| Field | Input |
| --- | --- |
| `canonical_report_raw_sha256` | Pretty JSON file raw bytes (`indent=2`, LF). |
| `canonical_report_semantic_sha256` | Canonical JSON of report object. |
| `audit_report_raw_sha256` / `audit_report_semantic_sha256` | Same for audit report. |
| `per_case_audit_raw_sha256` | Raw per-case JSONL bytes. |

## E. Release candidate

| Field | Input |
| --- | --- |
| `rc_manifest_semantic_sha256` / `manifest_sha256` | Pretty JSON of RC **without** the sha256 hash fields. |
| `rc_manifest_raw_sha256` | Pretty JSON including semantic fields but hashed without the raw field itself (symmetric). |
| `parent_rc_id` / `parent_rc_status` | Lineage; historical R3F = `INVALIDATED_BY_SEAL_DRIFT`. |
| `seal_contract_version` | `mai-07-artifact-seal-contract.2.0.0`. |

## Known vectors

- SHA-256(`""`) and SHA-256(`b"abc"`) fixed in module tests.
- Canonical empty list `[]` digest fixed in module tests.
