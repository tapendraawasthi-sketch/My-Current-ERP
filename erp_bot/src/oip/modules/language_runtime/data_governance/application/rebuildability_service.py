"""MAI-12 slice 2 — KB source→index rebuildability assessment (GAP-P2-005).

Does not rebuild indexes. Reports whether a rebuild is possible from present
artifacts and emits a versioned recipe.
"""

from __future__ import annotations

import json
from pathlib import Path

from .....contracts.language_data_governance import (
    KbRebuildabilityReportV1,
    KbRebuildStatus,
    KbRebuildStepV1,
    LanguageDataGovernanceStatus,
)
from .governance_service import find_repo_root
from .. import RUNTIME_VERSION

_PIPELINE_SCRIPTS = (
    "knowledgebase/scripts/phase0_discover.py",
    "knowledgebase/scripts/validate_kb_package.py",
    "knowledgebase/scripts/parse_kb_to_jsonl.py",
    "knowledgebase/scripts/analyze_kb_quality.py",
    "knowledgebase/scripts/build_human_review_sample.py",
    "knowledgebase/scripts/build_retrieval_indexes.py",
    "knowledgebase/scripts/run_kb_pipeline.py",
)

_SOURCE_ZIPS = (
    "Knowledge source/ORBIX_NP_LANGUAGE_KB_FILES_0001_TO_0016.zip",
    "Knowledge source/ORBIX_NP_LANG_KB_FILES_0017_TO_0088.zip",
)

_RECIPE: tuple[KbRebuildStepV1, ...] = (
    KbRebuildStepV1(
        step_id="0_discover",
        command="python knowledgebase/scripts/phase0_discover.py",
        required_inputs=("Knowledge source/*.zip",),
        produces=("knowledgebase/review/source_archive_inventory.json",),
    ),
    KbRebuildStepV1(
        step_id="1_validate_extract",
        command="python knowledgebase/scripts/validate_kb_package.py",
        required_inputs=("Knowledge source/*.zip",),
        produces=("knowledgebase/raw/nepali_language/",),
    ),
    KbRebuildStepV1(
        step_id="2_parse_jsonl",
        command="python knowledgebase/scripts/parse_kb_to_jsonl.py",
        required_inputs=("knowledgebase/raw/nepali_language/",),
        produces=("knowledgebase/processed/jsonl/",),
    ),
    KbRebuildStepV1(
        step_id="3_quality",
        command="python knowledgebase/scripts/analyze_kb_quality.py",
        required_inputs=("knowledgebase/processed/jsonl/",),
        produces=("knowledgebase/review/quality_score_summary.json",),
    ),
    KbRebuildStepV1(
        step_id="4_review_sample",
        command="python knowledgebase/scripts/build_human_review_sample.py",
        required_inputs=("knowledgebase/processed/jsonl/",),
        produces=("knowledgebase/processed/review_ready/",),
    ),
    KbRebuildStepV1(
        step_id="5_lexical_index",
        command="python knowledgebase/scripts/build_retrieval_indexes.py",
        required_inputs=("knowledgebase/processed/jsonl/",),
        produces=(
            "knowledgebase/indexes/lexical/kb_lexical.sqlite",
            "knowledgebase/indexes/metadata/kb_metadata.sqlite",
        ),
    ),
    KbRebuildStepV1(
        step_id="5b_semantic_optional",
        command="python knowledgebase/scripts/build_semantic_index.py",
        required_inputs=("knowledgebase/processed/jsonl/",),
        produces=("knowledgebase/indexes/semantic/",),
        optional=True,
    ),
    KbRebuildStepV1(
        step_id="orch_full",
        command="python knowledgebase/scripts/run_kb_pipeline.py --from-phase 0 --to-phase 5",
        required_inputs=("Knowledge source/*.zip", "knowledgebase/config.json"),
        produces=("knowledgebase/indexes/lexical/kb_lexical.sqlite",),
    ),
)


def _has_jsonl_files(dir_path: Path) -> bool:
    if not dir_path.is_dir():
        return False
    return any(dir_path.glob("*.jsonl"))


def assess_kb_rebuildability(*, repo_root: Path | None = None) -> KbRebuildabilityReportV1:
    root = repo_root or find_repo_root()
    reasons: list[str] = ["KB_REBUILDABILITY_ASSESSMENT"]
    warnings: list[str] = []
    errors: list[str] = []

    config_path = root / "knowledgebase" / "config.json"
    config_present = config_path.is_file()
    if config_present:
        reasons.append("CONFIG_PRESENT")
        try:
            json.loads(config_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            errors.append("CONFIG_JSON_INVALID")
            config_present = False
    else:
        errors.append("CONFIG_MISSING")

    source_present = sum(1 for rel in _SOURCE_ZIPS if (root / rel).is_file())
    if source_present:
        reasons.append(f"SOURCE_ARCHIVES_{source_present}")
    else:
        warnings.append("SOURCE_ARCHIVES_MISSING")

    processed = _has_jsonl_files(root / "knowledgebase" / "processed" / "jsonl")
    if processed:
        reasons.append("PROCESSED_JSONL_PRESENT")
    else:
        warnings.append("PROCESSED_JSONL_MISSING")

    lexical = (root / "knowledgebase" / "indexes" / "lexical" / "kb_lexical.sqlite").is_file()
    if lexical:
        reasons.append("LEXICAL_INDEX_PRESENT")
    else:
        warnings.append("LEXICAL_INDEX_MISSING")

    scripts_ok = all((root / rel).is_file() for rel in _PIPELINE_SCRIPTS)
    if scripts_ok:
        reasons.append("PIPELINE_SCRIPTS_PRESENT")
    else:
        errors.append("PIPELINE_SCRIPTS_MISSING")
        missing = [rel for rel in _PIPELINE_SCRIPTS if not (root / rel).is_file()]
        for rel in missing[:5]:
            errors.append(f"SCRIPT_MISSING:{rel}")

    # Decide rebuild status (fail-closed toward BLOCKED only when nothing usable).
    if not scripts_ok or not config_present:
        status = KbRebuildStatus.BLOCKED
        reasons.append("BLOCKED_MISSING_TOOLING")
    elif source_present > 0 and scripts_ok and config_present:
        status = KbRebuildStatus.FULL_REBUILD_READY
        reasons.append("FULL_REBUILD_READY")
    elif processed and scripts_ok and config_present:
        status = KbRebuildStatus.INCREMENTAL_FROM_PROCESSED
        reasons.append("INCREMENTAL_FROM_PROCESSED")
    elif lexical:
        status = KbRebuildStatus.INDEX_PRESENT_SOURCES_MISSING
        reasons.append("INDEX_PRESENT_SOURCES_MISSING")
    else:
        status = KbRebuildStatus.BLOCKED
        reasons.append("BLOCKED_NO_INDEX_NO_SOURCES")

    analysis = LanguageDataGovernanceStatus.COMPLETE
    if errors:
        analysis = LanguageDataGovernanceStatus.FAILED
    elif warnings and status in {
        KbRebuildStatus.INDEX_PRESENT_SOURCES_MISSING,
        KbRebuildStatus.BLOCKED,
    }:
        analysis = LanguageDataGovernanceStatus.PARTIAL

    return KbRebuildabilityReportV1(
        analysis_status=analysis,
        runtime_version=RUNTIME_VERSION,
        rebuild_status=status,
        config_present=config_present,
        source_archives_present=source_present,
        processed_jsonl_present=processed,
        lexical_index_present=lexical,
        pipeline_scripts_present=scripts_ok,
        recipe_steps=_RECIPE,
        reason_codes=tuple(reasons),
        warnings=tuple(warnings),
        error_codes=tuple(dict.fromkeys(errors)),
    )


def recipe_as_markdown(report: KbRebuildabilityReportV1) -> str:
    lines = [
        "# KB Rebuild Recipe (MAI-12)",
        "",
        f"- Runtime: `{report.runtime_version}`",
        f"- Rebuild status: **{report.rebuild_status.value}**",
        f"- Config present: {report.config_present}",
        f"- Source archives present: {report.source_archives_present}",
        f"- Processed JSONL present: {report.processed_jsonl_present}",
        f"- Lexical index present: {report.lexical_index_present}",
        f"- Pipeline scripts present: {report.pipeline_scripts_present}",
        "",
        "## Steps",
        "",
    ]
    for step in report.recipe_steps:
        opt = " (optional)" if step.optional else ""
        lines.append(f"### {step.step_id}{opt}")
        lines.append(f"- Command: `{step.command}`")
        if step.required_inputs:
            lines.append(f"- Inputs: {', '.join(f'`{x}`' for x in step.required_inputs)}")
        if step.produces:
            lines.append(f"- Produces: {', '.join(f'`{x}`' for x in step.produces)}")
        lines.append("")
    lines.append("Do not train from frozen evals. See ADR_0029 / ADR_0010.")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    report = assess_kb_rebuildability()
    print(json.dumps(report.model_dump(mode="json"), indent=2, ensure_ascii=False))
    return 0 if report.rebuild_status != KbRebuildStatus.BLOCKED else 2


if __name__ == "__main__":
    raise SystemExit(main())
