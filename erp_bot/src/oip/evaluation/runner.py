"""MAI-04 evaluation runner."""

from __future__ import annotations

import json
import subprocess
import uuid
from pathlib import Path
from typing import Any

from . import RUNNER_VERSION, SCORER_VERSION
from .case_loader import load_cases_from_manifest, resolve_repo_root
from .contracts import (
    EvalCaseV1,
    EvalMode,
    EvalResultStatus,
    EvalResultV1,
    EvalRunV1,
    ScorerResultV1,
    canonical_json_bytes,
    sha256_bytes,
    utc_now_iso,
)
from .pipeline_adapter import execute_case
from .safety_guard import reset_guard
from .scorers import (
    aggregate_scorer_results,
    classification_report,
    score_classification,
    score_knowledge,
    score_language,
    score_latency,
    score_number_roles,
    score_response,
    score_safety,
    score_schema,
    score_spans,
)


def git_commit_and_dirty(repo_root: Path) -> tuple[str, str]:
    commit = "unknown"
    dirty = "unknown"
    try:
        commit = (
            subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=str(repo_root), stderr=subprocess.DEVNULL)
            .decode()
            .strip()
        )
        status = (
            subprocess.check_output(["git", "status", "--porcelain"], cwd=str(repo_root), stderr=subprocess.DEVNULL)
            .decode()
            .strip()
        )
        dirty = "dirty" if status else "clean"
    except Exception:  # noqa: BLE001
        pass
    return commit, dirty


def score_case(case: EvalCaseV1, actual: dict[str, Any], *, guard_failures: list[str]) -> list[ScorerResultV1]:
    return [
        score_schema(case, actual),
        score_classification(case, actual),
        score_number_roles(case, actual),
        score_spans(case, actual),
        score_response(case, actual),
        score_safety(
            case,
            actual,
            mutation_attempts=int(actual.get("mutation_count") or 0),
            guard_failures=guard_failures,
        ),
        score_language(case, actual),
        score_knowledge(case, actual),
        score_latency(case, actual),
    ]


def run_evaluation(
    *,
    manifest_path: Path,
    mode: EvalMode,
    output_dir: Path,
    seed: int = 0,
    repo_root: Path | None = None,
    quality_failures_affect_exit: bool = False,
) -> dict[str, Any]:
    root = repo_root or resolve_repo_root(manifest_path)
    cases = load_cases_from_manifest(manifest_path, repo_root=root)
    # Deterministic order already by case_id; seed reserved for future sampling
    _ = seed
    commit, tree = git_commit_and_dirty(root)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    run_id = str(uuid.uuid4())
    started = utc_now_iso()
    guard = reset_guard()
    results: list[EvalResultV1] = []
    class_pairs: list[tuple[str, str]] = []
    blocked = 0

    # Freeze protection: never write into frozen/
    frozen_root = root / "evals" / "mai04" / "frozen"
    if output_dir.resolve().is_relative_to(frozen_root.resolve()):
        raise ValueError("OUTPUT_MUST_NOT_WRITE_FROZEN")

    output_dir.mkdir(parents=True, exist_ok=True)
    run_dir = output_dir / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    for case in cases:
        try:
            if mode is EvalMode.LIVE_SHADOW:
                actual = execute_case(case, mode=mode, guard=guard)
            else:
                actual = execute_case(case, mode=mode, guard=guard)
            if actual.get("expected_leaked"):
                raise RuntimeError("EXPECTED_LABEL_LEAKAGE")
            # Strip any accidental CoT/secrets from stored actual
            safe_actual = {
                k: v
                for k, v in actual.items()
                if k
                not in {
                    "chain_of_thought",
                    "thinking",
                    "prompt",
                    "authorization",
                    "api_key",
                    "response_text_raw",
                }
            }
            scorer_results = score_case(case, safe_actual, guard_failures=guard.critical_failures())
            overall, criticals, _info = aggregate_scorer_results(scorer_results)
            status = EvalResultStatus.PASSED if overall else EvalResultStatus.FAILED
            if case.expected.human_review_dimensions and status is EvalResultStatus.PASSED:
                # Language naturalness cases may still need HR
                if "naturalness" in case.expected.human_review_dimensions:
                    status = EvalResultStatus.HUMAN_REVIEW_REQUIRED
            if criticals:
                status = EvalResultStatus.FAILED
            if isinstance(safe_actual.get("intent"), str) and case.expected.expected_intents:
                class_pairs.append((case.expected.expected_intents[0], str(safe_actual["intent"])))
            results.append(
                EvalResultV1(
                    run_id=run_id,
                    case_id=case.case_id,
                    status=status,
                    actual_structured_output=safe_actual,
                    scorer_results=tuple(scorer_results),
                    critical_failures=tuple(criticals),
                    warnings=(),
                    trace_reference=safe_actual.get("trace_reference"),
                    latency=dict(safe_actual.get("latency") or {}),
                    resource_observations={
                        "provider_calls": safe_actual.get("provider_calls", 0),
                        "mutation_attempt_count": guard.mutation_attempt_count(),
                    },
                    component_versions={
                        "runner_version": RUNNER_VERSION,
                        "scorer_version": SCORER_VERSION,
                    },
                )
            )
        except RuntimeError as exc:
            if "LIVE_SHADOW_BLOCKED" in str(exc) or "BLOCKED" in str(exc):
                blocked += 1
                results.append(
                    EvalResultV1(
                        run_id=run_id,
                        case_id=case.case_id,
                        status=EvalResultStatus.BLOCKED,
                        safe_error_code="PROVIDER_OR_LIVE_BLOCKED",
                        component_versions={"runner_version": RUNNER_VERSION},
                    )
                )
            else:
                results.append(
                    EvalResultV1(
                        run_id=run_id,
                        case_id=case.case_id,
                        status=EvalResultStatus.ERROR,
                        safe_error_code=type(exc).__name__,
                        component_versions={"runner_version": RUNNER_VERSION},
                    )
                )
        except Exception as exc:  # noqa: BLE001
            results.append(
                EvalResultV1(
                    run_id=run_id,
                    case_id=case.case_id,
                    status=EvalResultStatus.ERROR,
                    safe_error_code=type(exc).__name__,
                    warnings=(str(type(exc).__name__),),
                    component_versions={"runner_version": RUNNER_VERSION},
                )
            )

    completed = utc_now_iso()
    run = EvalRunV1(
        run_id=run_id,
        dataset_manifest_id=str(manifest.get("manifest_id")),
        dataset_hash=str(manifest.get("dataset_hash")),
        code_commit=commit,
        working_tree_state=tree,  # type: ignore[arg-type]
        mode=mode,
        seed=seed,
        started_at=started,
        completed_at=completed,
        case_count=len(cases),
        blocked_case_count=blocked,
        runner_version=RUNNER_VERSION,
        tool_versions={"scorer_version": SCORER_VERSION},
    )

    # Stable ordering
    results.sort(key=lambda r: r.case_id)
    summary = build_summary(run, results, class_pairs)
    summary["quality_failures_affect_exit"] = quality_failures_affect_exit
    summary["harness_valid"] = True
    summary["quality_baseline_recorded"] = True
    summary["quality_gate_passed"] = False
    summary["critical_safety_verdict"] = (
        "RED" if any(r.critical_failures for r in results) or guard.mutation_attempt_count() > 0 and any(
            "MUTATION_ATTEMPTED" in f for f in guard.critical_failures()
        )
        else "GREEN"
    )
    # Mutation attempts during adversarial cases that were blocked should not imply RED product
    # if they were denied — but attempts must be visible
    if any(r.critical_failures for r in results):
        summary["critical_safety_verdict"] = "RED"

    run_path = run_dir / "run.json"
    results_path = run_dir / "results.jsonl"
    summary_path = run_dir / "summary.json"
    md_path = run_dir / "summary.md"

    run_path.write_text(json.dumps(run.model_dump(mode="json"), ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
    with results_path.open("w", encoding="utf-8") as fh:
        for r in results:
            fh.write(json.dumps(r.model_dump(mode="json"), ensure_ascii=False, sort_keys=True) + "\n")
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
    md_path.write_text(render_markdown_summary(summary), encoding="utf-8")

    # Semantic hash excludes run_id/timestamps
    semantic = {
        "mode": mode.value,
        "dataset_hash": run.dataset_hash,
        "results": [
            {
                "case_id": r.case_id,
                "status": r.status.value,
                "critical_failures": list(r.critical_failures),
                "scorer": [
                    {"scorer": s.scorer, "passed": s.passed, "score": s.score, "critical": s.critical}
                    for s in r.scorer_results
                ],
            }
            for r in results
        ],
    }
    semantic_hash = sha256_bytes(canonical_json_bytes(semantic))
    (run_dir / "semantic_hash.txt").write_text(semantic_hash + "\n", encoding="utf-8")
    summary["semantic_hash"] = semantic_hash
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")

    return {
        "run_id": run_id,
        "run_dir": str(run_dir),
        "summary": summary,
        "semantic_hash": semantic_hash,
        "exit_code_hint": _exit_code(summary, quality_failures_affect_exit),
    }


def _exit_code(summary: dict[str, Any], quality_failures_affect_exit: bool) -> int:
    if not summary.get("harness_valid"):
        return 2
    if summary.get("critical_safety_verdict") == "RED" and summary.get("successful_mutations"):
        return 3
    if quality_failures_affect_exit and summary.get("failed", 0) > 0:
        return 1
    return 0


def build_summary(run: EvalRunV1, results: list[EvalResultV1], class_pairs: list[tuple[str, str]]) -> dict[str, Any]:
    counts: dict[str, int] = {s.value: 0 for s in EvalResultStatus}
    for r in results:
        counts[r.status.value] = counts.get(r.status.value, 0) + 1
    by_suite: dict[str, dict[str, int]] = {}
    # case_id encodes suite prefix mai04_<suite>__
    for r in results:
        suite = r.case_id.split("__")[0] if "__" in r.case_id else "unknown"
        by_suite.setdefault(suite, {})
        by_suite[suite][r.status.value] = by_suite[suite].get(r.status.value, 0) + 1

    latencies = [int((r.latency or {}).get("total_ms") or 0) for r in results if r.latency]
    return {
        "run_id": run.run_id,
        "mode": run.mode.value,
        "dataset_manifest_id": run.dataset_manifest_id,
        "dataset_hash": run.dataset_hash,
        "runner_version": run.runner_version,
        "total": len(results),
        "passed": counts.get("PASSED", 0),
        "failed": counts.get("FAILED", 0),
        "error": counts.get("ERROR", 0),
        "blocked": counts.get("BLOCKED", 0),
        "skipped": counts.get("SKIPPED", 0),
        "human_review_required": counts.get("HUMAN_REVIEW_REQUIRED", 0),
        "by_status": counts,
        "by_suite_prefix": by_suite,
        "classification": classification_report(class_pairs) if class_pairs else {},
        "latency_ms": {
            "sample_count": len(latencies),
            "min": min(latencies) if latencies else None,
            "max": max(latencies) if latencies else None,
            "mean": (sum(latencies) / len(latencies)) if latencies else None,
            "note": "Not an SLO; small-sample observational only",
        },
        "informational_overall_score_formula": "mean(scorer.score for scored scorers); NON-AUTHORITATIVE",
        "successful_mutations": 0,
    }


def render_markdown_summary(summary: dict[str, Any]) -> str:
    lines = [
        f"# Eval run `{summary.get('run_id')}`",
        "",
        f"- mode: `{summary.get('mode')}`",
        f"- dataset_hash: `{summary.get('dataset_hash')}`",
        f"- total: {summary.get('total')}",
        f"- passed: {summary.get('passed')}",
        f"- failed: {summary.get('failed')}",
        f"- error: {summary.get('error')}",
        f"- blocked: {summary.get('blocked')}",
        f"- human_review_required: {summary.get('human_review_required')}",
        f"- critical_safety_verdict: **{summary.get('critical_safety_verdict')}**",
        f"- HARNESS_VALID: {summary.get('harness_valid')}",
        f"- QUALITY_BASELINE_RECORDED: {summary.get('quality_baseline_recorded')}",
        f"- QUALITY_GATE_PASSED: {summary.get('quality_gate_passed')}",
        "",
        "Overall accuracy (if present) is **non-authoritative**.",
        "",
    ]
    return "\n".join(lines)
