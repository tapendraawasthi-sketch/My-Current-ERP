# MAI-07R3F Sealing Hash Contract Specification

**Phase:** MAI-07R3F-SEAL-RESTORE  
**Status:** Documented after forensic audit (2026-07-16)

## 1. Resource content hash (`resource_content_hash` / `manifest.content_hash`)

| Item | Definition |
| --- | --- |
| Producer | `compute_pack_content_hash()` in `resource_repository.py` |
| Validator | `validate_resources()` (read-only) |
| Bytes | For each name in `sorted(manifest["files"])`: `name.encode("utf-8") + NUL + raw_file_bytes` |
| Exclusions | `manifest.json` itself is **not** hashed |
| Normalization | **None** (raw bytes; CRLF ≠ LF) |
| Encoding | UTF-8 file bytes as stored on disk |
| Domain separator | NUL (`\0`) between name and bytes |

Sealed R3F claim: `e94cc8c7775d9ce77ab854ab478387d950a018ba1b76d96e9749d4aad425e50a`.

## 2. Guard config hash (`guard_config_sha256`)

| Item | Definition |
| --- | --- |
| Producer | `hashlib.sha256(path.read_bytes())` of `r3f_english_identity_guard.json` |
| Bytes | Raw file bytes |
| Note | LF-normalized current file recovers sealed `9240a7be…`; raw CRLF differs |

## 3. Runtime / code semantic hash (`code_semantic_hash`)

| Item | Definition |
| --- | --- |
| Producer | `build_mai07r3f_release_candidate.code_semantic_hash()` |
| Files | transliteration_service, ranker, generator, r3d_safety_gate, english_identity_guard, `__init__.py`, guard JSON |
| Bytes | sorted by filename: `name + NUL + raw bytes` |
| Note | Does **not** include `resource_repository.py` |

## 4. Holdout `predictions_sha256` (CRITICAL)

| Item | Definition |
| --- | --- |
| Producer | `eval_mai07_r3f.py`: `_sha(_canonical(preds))` where `_canonical` = `json.dumps(preds, sort_keys=True, separators=(",", ":"))` |
| Meaning | SHA-256 of the **canonical JSON array** of prediction objects |
| Not | Raw JSONL file SHA-256 |

On-disk JSONL uses `json.dumps(p, sort_keys=True)` per line (default separators with spaces). Therefore:

- file raw SHA-256 = `ce4152a0…`
- producer `predictions_sha256` = `b5cdb56f…`

R3G initially compared raw file hash to this field → **false drift alarm**. Under the producer contract, current predictions reproduce `b5cdb56f…` exactly.

## 5. Holdout report / audit / RC hashes

| Field | Algorithm |
| --- | --- |
| Score report file | Raw SHA-256 of JSON file bytes |
| Audit metrics hash (R3G preflight) | SHA-256 of `_canonical(audit["metrics"])` |
| RC `manifest_sha256` | SHA-256 of sorted pretty-printed JSON body including `manifest_sha256` field as written by builder |

## 6. Versioned contract note

Future seals must use explicit field names:

- `predictions_file_sha256` — raw JSONL
- `predictions_canonical_list_sha256` — producer list digest

Do not overload a bare `predictions_sha256` without a documented algorithm id.
