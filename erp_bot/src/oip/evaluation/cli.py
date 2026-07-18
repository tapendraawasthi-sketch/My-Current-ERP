"""CLI for MAI-04 frozen evaluation."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .case_loader import load_manifest, validate_manifest_and_cases
from .contracts import EvalMode, canonical_json_bytes, sha256_bytes
from .runner import run_evaluation


def _repo_root() -> Path:
    # erp_bot/src/oip/evaluation/cli.py -> repo
    return Path(__file__).resolve().parents[4]


def cmd_validate(args: argparse.Namespace) -> int:
    manifest = Path(args.manifest)
    report = validate_manifest_and_cases(manifest, repo_root=_repo_root())
    out = {
        "ok": report.ok,
        "case_count": report.case_count,
        "errors": report.errors,
        "warnings": report.warnings[:50],
        "duplicate_ids": report.duplicate_ids,
        "split_leaks": report.split_leaks,
        "near_duplicates_sample": report.near_duplicates[:20],
    }
    print(json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True))
    if args.write:
        Path(args.write).parent.mkdir(parents=True, exist_ok=True)
        Path(args.write).write_text(json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
    return 0 if report.ok else 2


def cmd_run(args: argparse.Namespace) -> int:
    mode = EvalMode(args.mode)
    result = run_evaluation(
        manifest_path=Path(args.manifest),
        mode=mode,
        output_dir=Path(args.output),
        seed=int(args.seed),
        repo_root=_repo_root(),
        quality_failures_affect_exit=bool(args.fail_on_quality),
    )
    print(json.dumps({k: result[k] for k in ("run_id", "run_dir", "semantic_hash", "exit_code_hint") if k in result}, indent=2))
    print(json.dumps(result["summary"], ensure_ascii=False, indent=2, sort_keys=True))
    return int(result["exit_code_hint"])


def cmd_report(args: argparse.Namespace) -> int:
    run_dir = Path(args.run)
    summary = json.loads((run_dir / "summary.json").read_text(encoding="utf-8"))
    formats = [f.strip() for f in args.format.split(",")]
    if "json" in formats:
        print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))
    if "markdown" in formats:
        md = (run_dir / "summary.md").read_text(encoding="utf-8")
        print(md)
    return 0


def cmd_compare(args: argparse.Namespace) -> int:
    base = json.loads(Path(args.baseline).read_text(encoding="utf-8"))
    cand = json.loads(Path(args.candidate).read_text(encoding="utf-8"))
    # Allow path to summary.json or run dir
    if "semantic_hash" not in base and Path(args.baseline).is_dir():
        base = json.loads((Path(args.baseline) / "summary.json").read_text(encoding="utf-8"))
    if "semantic_hash" not in cand and Path(args.candidate).is_dir():
        cand = json.loads((Path(args.candidate) / "summary.json").read_text(encoding="utf-8"))
    out = {
        "baseline_hash": base.get("semantic_hash") or base.get("dataset_hash"),
        "candidate_hash": cand.get("semantic_hash") or cand.get("dataset_hash"),
        "same_dataset": base.get("dataset_hash") == cand.get("dataset_hash"),
        "delta_failed": int(cand.get("failed", 0)) - int(base.get("failed", 0)),
        "delta_passed": int(cand.get("passed", 0)) - int(base.get("passed", 0)),
        "note": "No-regression reporting only in MAI-04; QUALITY_GATE_PASSED remains false",
    }
    print(json.dumps(out, indent=2, sort_keys=True))
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="python -m src.oip.evaluation.cli", description="MAI-04 frozen evaluation")
    sub = p.add_subparsers(dest="command", required=True)

    v = sub.add_parser("validate", help="Validate frozen manifest + cases")
    v.add_argument("--manifest", required=True)
    v.add_argument("--write", default=None, help="Optional validation report path")
    v.set_defaults(func=cmd_validate)

    r = sub.add_parser("run", help="Run evaluation")
    r.add_argument("--manifest", required=True)
    r.add_argument("--mode", choices=[m.value for m in EvalMode], default=EvalMode.PIPELINE_IN_PROCESS.value)
    r.add_argument("--output", required=True)
    r.add_argument("--seed", type=int, default=0)
    r.add_argument(
        "--fail-on-quality",
        action="store_true",
        help="Nonzero exit when cases fail quality (default: baseline recording allows quality fails)",
    )
    r.set_defaults(func=cmd_run)

    rep = sub.add_parser("report", help="Print run summary")
    rep.add_argument("--run", required=True, help="Run output directory")
    rep.add_argument("--format", default="json,markdown")
    rep.set_defaults(func=cmd_report)

    c = sub.add_parser("compare", help="Compare baseline vs candidate summaries")
    c.add_argument("--baseline", required=True)
    c.add_argument("--candidate", required=True)
    c.set_defaults(func=cmd_compare)

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return int(args.func(args))
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "safe_error_code": type(exc).__name__, "message": str(exc)[:200]}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
