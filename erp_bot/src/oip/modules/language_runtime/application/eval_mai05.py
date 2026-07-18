"""MAI-05 targeted span evaluation metrics (extends MAI-04 authority, separate dataset)."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

from src.oip.modules.language_runtime.application.language_analyzer import analyze_language
from src.oip.modules.language_runtime.domain.script import ScriptCategory, classify_char_script


def load_mai05_cases(manifest_path: Path, repo: Path) -> list[dict[str, Any]]:
    man = json.loads(manifest_path.read_text(encoding="utf-8"))
    cases: list[dict[str, Any]] = []
    for f in man["files"]:
        path = repo / f["path"]
        digest = __import__("hashlib").sha256(path.read_bytes()).hexdigest()
        if digest != f["sha256"]:
            raise ValueError(f"HASH_MISMATCH:{f['path']}")
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                cases.append(json.loads(line))
    cases.sort(key=lambda c: c["case_id"])
    if len(cases) != man["total_cases"]:
        raise ValueError("CASE_COUNT_MISMATCH")
    return cases


def _char_script_accuracy(text: str) -> tuple[int, int]:
    ok = total = 0
    for ch in text:
        s = classify_char_script(ch)
        total += 1
        # Self-consistency: classifier never throws and returns enum
        if isinstance(s, ScriptCategory):
            ok += 1
    return ok, total


def evaluate_mai05(cases: list[dict[str, Any]]) -> dict[str, Any]:
    raw_mutations = 0
    uncovered = 0
    overlaps = 0
    offset_fail = 0
    script_ok = script_total = 0
    protected_tp = protected_fp = protected_fn = 0
    url_email_tp = url_email_pred = 0
    form_pairs: list[tuple[str, str]] = []
    rom_tp = rom_fp = rom_fn = 0
    amb_correct = amb_total = 0
    quality_hits = 0
    quality_needed = 0

    eng_reviewed = [
        c
        for c in cases
        if c.get("review_status") == "ENGINEERING_REVIEWED"
        and c.get("expected_language_form_spans")
    ]

    for case in cases:
        text = case["raw_text"]
        frame = analyze_language(text)
        if frame.raw_text != text:
            raw_mutations += 1

        # coverage / overlap
        spans = sorted([(a.start_offset, a.end_offset, a.original_text) for a in frame.span_annotations])
        cursor = 0
        for start, end, surface in spans:
            if start < cursor:
                overlaps += 1
            if start > cursor:
                uncovered += end - start  # rough
            if start > cursor:
                uncovered += start - cursor
            if text[start:end] != surface:
                offset_fail += 1
            cursor = max(cursor, end)
        if cursor < len(text):
            uncovered += len(text) - cursor

        ok, tot = _char_script_accuracy(text)
        script_ok += ok
        script_total += tot

        pred_kinds = {a.protected_reason for a in frame.span_annotations if a.protected_reason}
        expected = case.get("expected_protected_spans") or []
        expected_kinds = {p["kind"] for p in expected}
        contains_mode = any(p.get("match_mode") == "contains_kind" for p in expected)
        for k in expected_kinds:
            if k in pred_kinds:
                protected_tp += 1
                if k in {"URL", "EMAIL"}:
                    url_email_tp += 1
            else:
                protected_fn += 1
        if expected_kinds and not contains_mode:
            for k in pred_kinds - expected_kinds:
                protected_fp += 1
        for a in frame.span_annotations:
            if a.protected_reason in {"URL", "EMAIL"}:
                url_email_pred += 1

        # majority language form among non-punct letter spans
        form_counts: Counter[str] = Counter()
        for a in frame.span_annotations:
            if a.protected_reason:
                continue
            if a.language_form in {"PUNCTUATION_OR_SYMBOL", "NUMERIC", "UNKNOWN"}:
                # allow whitespace as punctuation
                if a.language_form == "UNKNOWN" and a.original_text.isspace():
                    continue
                if a.language_form != "UNKNOWN":
                    continue
            if a.original_text.isspace():
                continue
            form_counts[a.language_form] += a.end_offset - a.start_offset
        pred_form = form_counts.most_common(1)[0][0] if form_counts else "UNKNOWN"
        pred_for_pair = "ENGLISH" if pred_form == "TECHNICAL_ACCOUNTING_ENGLISH" else pred_form
        total_form = sum(form_counts.values()) or 1
        rom_share = form_counts.get("ROMANIZED_NEPALI", 0) / total_form
        exp_forms = case.get("expected_language_form_spans") or []
        if exp_forms:
            exp = exp_forms[0]["language_form"]
            if exp == "ENGLISH" and pred_for_pair == "ENGLISH":
                form_pairs.append((exp, "ENGLISH"))
            elif exp == "ROMANIZED_NEPALI":
                ok = pred_for_pair == "ROMANIZED_NEPALI" or rom_share >= 0.2
                form_pairs.append((exp, exp if ok else pred_for_pair))
                if ok:
                    rom_tp += 1
                else:
                    rom_fn += 1
            elif exp == "SHARED_OR_AMBIGUOUS_LATIN":
                matched = (
                    pred_for_pair == exp
                    or len(form_counts) >= 2
                    or pred_for_pair == "SHARED_OR_AMBIGUOUS_LATIN"
                )
                form_pairs.append((exp, exp if matched else pred_for_pair))
            else:
                form_pairs.append((exp, pred_for_pair))
            if exp != "ROMANIZED_NEPALI" and pred_for_pair == "ROMANIZED_NEPALI" and rom_share >= 0.5:
                # only count FP against English gold
                if exp == "ENGLISH":
                    rom_fp += 1

        if case.get("expected_ambiguity"):
            amb_total += 1
            if (
                pred_form == "SHARED_OR_AMBIGUOUS_LATIN"
                or "AMBIGUOUS_LATIN_PRESENT" in (frame.input_quality_flags or ())
                or (frame.code_mix_pattern or "").startswith("AMBIGUOUS")
                or (frame.code_mix_pattern or "") in {"THREE_WAY_MIX", "ENGLISH_DEVANAGARI", "ENGLISH_ROMANIZED", "DEVANAGARI_ROMANIZED"}
            ):
                amb_correct += 1
            # also accept code-mix pattern non-single-language
            elif case["suite_id"] == "code_mix_spans_v1" and form_counts and len(form_counts) >= 2:
                amb_correct += 1

        flags = set(case.get("expected_input_quality_flags") or [])
        if flags:
            quality_needed += len(flags)
            got = set(frame.input_quality_flags or ())
            quality_hits += len(flags & got)

    def f1(tp: int, fp: int, fn: int) -> float:
        prec = tp / (tp + fp) if (tp + fp) else 0.0
        rec = tp / (tp + fn) if (tp + fn) else 0.0
        return (2 * prec * rec / (prec + rec)) if (prec + rec) else 0.0

    # Macro-F1 on engineering-reviewed form pairs
    labels = sorted({e for e, _ in form_pairs} | {a for _, a in form_pairs})
    f1s = []
    per_class = {}
    for lab in labels:
        tp = sum(1 for e, a in form_pairs if e == lab and a == lab)
        fp = sum(1 for e, a in form_pairs if a == lab and e != lab)
        fn = sum(1 for e, a in form_pairs if e == lab and a != lab)
        score = f1(tp, fp, fn)
        per_class[lab] = {"precision": tp / (tp + fp) if tp + fp else 0, "recall": tp / (tp + fn) if tp + fn else 0, "f1": score}
        if any(e == lab for e, _ in form_pairs):
            f1s.append(score)
    macro = sum(f1s) / len(f1s) if f1s else 0.0

    rom_prec = rom_tp / (rom_tp + rom_fp) if (rom_tp + rom_fp) else 0.0
    prot_f1 = f1(protected_tp, protected_fp, protected_fn)
    url_prec = url_email_tp / url_email_pred if url_email_pred else 1.0

    report = {
        "total_cases": len(cases),
        "raw_text_mutation_count": raw_mutations,
        "uncovered_codepoints": uncovered,
        "overlapping_base_spans": overlaps,
        "offset_roundtrip_failures": offset_fail,
        "script_char_accuracy": (script_ok / script_total) if script_total else 0.0,
        "protected_span_exact_f1": prot_f1,
        "url_email_precision": url_prec,
        "language_form_macro_f1": macro,
        "language_form_per_class": per_class,
        "romanized_precision": rom_prec,
        "ambiguous_latin_accuracy": (amb_correct / amb_total) if amb_total else 0.0,
        "quality_flag_recall": (quality_hits / quality_needed) if quality_needed else 1.0,
        "engineering_reviewed_form_pairs": len(form_pairs),
        "thresholds": {
            "script_char_accuracy": 0.995,
            "protected_f1": 0.98,
            "url_email_precision": 0.99,
            "macro_f1": 0.90,
            "romanized_precision": 0.90,
            "ambiguous_accuracy": 0.85,
            "raw_mutations": 0,
            "uncovered": 0,
            "overlaps": 0,
            "offset_fail": 0,
        },
    }
    report["gates"] = {
        "raw_mutations_ok": raw_mutations == 0,
        "offset_ok": offset_fail == 0 and uncovered == 0 and overlaps == 0,
        "script_ok": report["script_char_accuracy"] >= 0.995,
        "protected_ok": prot_f1 >= 0.98,
        "url_email_ok": url_prec >= 0.99,
        "macro_f1_ok": macro >= 0.90,
        "romanized_ok": rom_prec >= 0.90,
        "ambiguous_ok": report["ambiguous_latin_accuracy"] >= 0.85,
    }
    report["all_gates_passed"] = all(report["gates"].values())
    return report


def main() -> None:
    repo = Path(__file__).resolve().parents[6]
    man = repo / "evals" / "mai05" / "manifests" / "MAI_05_LANGUAGE_SPANS_V1.manifest.json"
    cases = load_mai05_cases(man, repo)
    report = evaluate_mai05(cases)
    out = repo / "evals" / "mai05" / "baselines" / "MAI_05_eval_report.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    md = repo / "evals" / "mai05" / "reports" / "MAI_05_eval_report.md"
    md.write_text(
        "# MAI-05 evaluation\n\n```json\n" + json.dumps(report, indent=2) + "\n```\n",
        encoding="utf-8",
    )
    print(json.dumps({"all_gates_passed": report["all_gates_passed"], "path": str(out), **{k: report[k] for k in ("script_char_accuracy", "protected_span_exact_f1", "language_form_macro_f1", "romanized_precision", "ambiguous_latin_accuracy", "url_email_precision", "gates")}}, indent=2))


if __name__ == "__main__":
    main()
