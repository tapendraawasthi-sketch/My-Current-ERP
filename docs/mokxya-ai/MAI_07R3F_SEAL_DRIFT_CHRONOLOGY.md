# MAI-07R3F Seal Drift Chronology

| Time / event | Evidence |
| --- | --- |
| R3F seal | RC records `resource_content_hash=e94cc8c…`, `guard_config_sha256=9240a7be…`, holdout report `predictions_sha256=b5cdb56f…` |
| Holdout one-shot | Predictions written as JSONL; report stores **canonical list** hash `b5cdb56f…` |
| Post-seal packaging | Resource JSON files present as CRLF on Windows; LF-normalized guard recovers `9240a7be…`; full pack LF hash ≠ `e94cc8c…` → additional content/packaging drift beyond CRLF |
| Mutation writers (proven) | `seal_manifest_hash()`; CLI `--check-twice`; `test_mai07_transliteration.test_resource_check_twice_ok` rewrote canonical `manifest.content_hash` to match current pack (`16174253…`) |
| R3G preflight | Blocked: (1) pack ≠ `e94cc8c…`; (2) incorrectly treated prediction **file** hash `ce4152a0…` as mismatch vs list hash `b5cdb56f…` |
| SEAL-RESTORE | No trusted copy of `e94cc8c…` pack found; prediction seal reproduced under producer contract; tooling mutation-proofed; RC invalidated for resource seal |

Suspected but not fully proven writers of non-manifest resource CRLF/content drift: Windows editors, JSON re-serializers, prior seal/format tooling. Exact pre-drift pack bytes are not recoverable from the worktree.
