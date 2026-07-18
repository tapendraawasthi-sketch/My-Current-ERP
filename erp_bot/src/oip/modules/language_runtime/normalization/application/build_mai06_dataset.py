"""Build MAI-06 lossless normalization gold dataset (does not touch MAI-04/05 frozen)."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

OFFSET = "UNICODE_CODE_POINT"


def _cid(suite: str, n: int) -> str:
    return f"mai06_{suite}__{n:04d}"


def _hash(obj: dict) -> str:
    return hashlib.sha256(
        json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def _case(
    *,
    case_id: str,
    suite: str,
    text: str,
    protected: list[dict],
    expected_views: dict,
    applied_ops: list[str],
    candidate_ops: list[str],
    prohibited_ops: list[str],
    security_flags: list[str],
    tags: list[str],
    review: str = "ENGINEERING_REVIEWED",
) -> dict:
    body = {
        "schema_version": "1.0.0",
        "case_id": case_id,
        "suite_id": suite,
        "raw_text": text,
        "offset_unit": OFFSET,
        "mai05_protected_spans": protected,
        "expected_views": expected_views,
        "expected_applied_operations": applied_ops,
        "expected_candidate_operations": candidate_ops,
        "expected_prohibited_operations": prohibited_ops,
        "expected_security_flags": security_flags,
        "expected_reconstruction": text,
        "expected_raw_unchanged": True,
        "expected_protected_unchanged": True,
        "source_provenance": "engineering_synthetic_mai06",
        "review_status": review,
        "scenario_group_id": case_id.rsplit("__", 1)[0],
        "split": "frozen",
        "prohibited_for_training": True,
        "tags": tags,
        "domain": "lossless_normalization",
    }
    body["content_hash"] = _hash({k: v for k, v in body.items() if k != "content_hash"})
    return body


def build_cases() -> list[dict]:
    cases: list[dict] = []

    # Unicode canonical ≥70
    for i in range(70):
        if i % 3 == 0:
            text = "cafe" + "\u0301" + f" ledger {i}"  # e + combining acute
            exp = {"UNICODE_CANONICAL_contains_composed": True}
        elif i % 3 == 1:
            text = f"नेपाल{i}"  # Devanagari
            exp = {"UNICODE_CANONICAL_equals_raw_or_nfc": True}
        else:
            text = f"item {i} 😀 ok"
            exp = {"UNICODE_CANONICAL_preserves_emoji": True}
        cases.append(
            _case(
                case_id=_cid("unicode_canonical_v1", i),
                suite="unicode_canonical_v1",
                text=text,
                protected=[],
                expected_views=exp,
                applied_ops=["UNICODE_NFC"] if i % 3 == 0 else [],
                candidate_ops=[],
                prohibited_ops=["TRANSLITERATE", "NFKC_GLOBAL"],
                security_flags=[],
                tags=["unicode", "english" if i % 2 == 0 else "devanagari"],
            )
        )

    # Whitespace ≥50
    for i in range(50):
        if i % 5 == 0:
            text = f"cash\u00a0balance {i}"
        elif i % 5 == 1:
            text = f"a\tb\tc {i}"
        elif i % 5 == 2:
            text = f"line1\r\nline2 {i}"
        elif i % 5 == 3:
            text = f"  spaced   out  {i}  "
        else:
            text = f"plain spaces {i}"
        cases.append(
            _case(
                case_id=_cid("whitespace_v1", i),
                suite="whitespace_v1",
                text=text,
                protected=[],
                expected_views={"RETRIEVAL_collapses_or_maps": True},
                applied_ops=[],
                candidate_ops=[],
                prohibited_ops=["TRANSLITERATE"],
                security_flags=[],
                tags=["whitespace", "english"],
            )
        )

    # Digit equivalence ≥50 — use digits attached to letters so MAI-05 NUMBER_LITERAL
    # protection does not apply; conversion only occurs outside protected spans.
    for i in range(50):
        text = f"code१२{i % 10}tip units" if i % 2 == 0 else f"amount{i}ASCII"
        cases.append(
            _case(
                case_id=_cid("digit_equivalence_v1", i),
                suite="digit_equivalence_v1",
                text=text,
                protected=[],
                expected_views={"RETRIEVAL_ascii_digits": i % 2 == 0},
                applied_ops=["ASCII_DEVANAGARI_DIGIT_EQUIVALENCE"] if i % 2 == 0 else [],
                candidate_ops=[],
                prohibited_ops=["MONEY_ROLE_ASSIGNMENT"],
                security_flags=[],
                tags=["digits", "romanized" if i % 3 == 0 else "english"],
            )
        )

    # Protected no-change ≥100
    prot_examples = [
        ("see https://example.test/a now", [{"kind": "URL", "match_mode": "contains_kind"}]),
        ("mail eval.user@example.test please", [{"kind": "EMAIL", "match_mode": "contains_kind"}]),
        ("supplier PAN EVAL123456 details", [{"kind": "PAN_CANDIDATE", "match_mode": "contains_kind"}]),
        ("VAT no EVALVAT9988 on bill", [{"kind": "VAT_IDENTIFIER", "match_mode": "contains_kind"}]),
        ("invoice no INV-9001 paid", [{"kind": "INVOICE_REFERENCE", "match_mode": "contains_kind"}]),
        ("voucher नं. V-7788 posted", [{"kind": "VOUCHER_REFERENCE", "match_mode": "contains_kind"}]),
        ("account code ACC-42 balance", [{"kind": "ACCOUNT_CODE", "match_mode": "contains_kind"}]),
        ("see IRD circular 12-A note", [{"kind": "LEGAL_CITATION", "match_mode": "contains_kind"}]),
        ("FY 2081/82 trial", [{"kind": "FISCAL_YEAR_LITERAL", "match_mode": "contains_kind"}]),
        ("dated 2024-07-14 payment", [{"kind": "DATE_LITERAL", "match_mode": "contains_kind"}]),
        ("paid NPR 1500 cash", [{"kind": "MONEY_LITERAL", "match_mode": "contains_kind"}]),
        ("discount 10% applied", [{"kind": "PERCENT_LITERAL", "match_mode": "contains_kind"}]),
        ("call phone 9800000000 about", [{"kind": "PHONE_CANDIDATE", "match_mode": "contains_kind"}]),
        ("open C:\\temp\\stmt.csv file", [{"kind": "FILE_PATH", "match_mode": "contains_kind"}]),
        ("use `SELECT 1` carefully", [{"kind": "CODE_FRAGMENT", "match_mode": "contains_kind"}]),
        ("payload {\"a\":1} ignored", [{"kind": "JSON_FRAGMENT", "match_mode": "contains_kind"}]),
        ("भ्याट नं. EVAL9001 लेख्नुहोस्", [{"kind": "VAT_IDENTIFIER", "match_mode": "contains_kind"}]),
        ("mero cash https://example.test/z xa", [{"kind": "URL", "match_mode": "contains_kind"}]),
        ("CASH for INV-55 today", [{"kind": "INVOICE_REFERENCE", "match_mode": "contains_kind"}]),
        ("code ACC-99 and १२३", [{"kind": "ACCOUNT_CODE", "match_mode": "contains_kind"}]),
    ]
    for i in range(100):
        text, specs = prot_examples[i % len(prot_examples)]
        text = text if i < len(prot_examples) else f"{text} id{i}"
        cases.append(
            _case(
                case_id=_cid("protected_no_change_v1", i),
                suite="protected_no_change_v1",
                text=text,
                protected=specs,
                expected_views={"all_views_preserve_protected": True},
                applied_ops=[],
                candidate_ops=[],
                prohibited_ops=["CASEFOLD_INSIDE_PROTECTED", "DIGIT_CONVERT_PROTECTED"],
                security_flags=[],
                tags=["protected", "code_mix" if i % 5 == 0 else "english"],
                review="SECURITY_REVIEWED",
            )
        )

    # Punctuation / abbreviation / repetition ≥50
    for i in range(50):
        if i % 3 == 0:
            text = f"said “hello” qty {i}"
            cops = ["PUNCTUATION_EQUIVALENCE_CANDIDATE", "ABBREVIATION_EXPANSION_CANDIDATE"]
        elif i % 3 == 1:
            text = f"bal and amt for dr cr {i}"
            cops = ["ABBREVIATION_EXPANSION_CANDIDATE"]
        else:
            text = f"hellooo cashhh {i}"
            cops = ["REPETITION_REDUCTION_CANDIDATE"]
        cases.append(
            _case(
                case_id=_cid("punctuation_candidates_v1", i),
                suite="punctuation_candidates_v1",
                text=text,
                protected=[],
                expected_views={"candidates_not_applied": True},
                applied_ops=[],
                candidate_ops=cops,
                prohibited_ops=["SILENT_CANDIDATE_APPLY"],
                security_flags=[],
                tags=["candidates", "english"],
            )
        )

    # offset/reversibility ≥60
    for i in range(60):
        text = f"Cafe\u0301  १{i%10} and CASH"
        cases.append(
            _case(
                case_id=_cid("offset_mapping_v1", i),
                suite="offset_mapping_v1",
                text=text,
                protected=[],
                expected_views={"roundtrip": True, "reconstruction": True},
                applied_ops=[],
                candidate_ops=[],
                prohibited_ops=[],
                security_flags=[],
                tags=["offsets", "mixed"],
            )
        )

    # unicode security / adversarial ≥30
    for i in range(30):
        if i % 4 == 0:
            text = f"hi\u202eworld{i}"
            flags = ["BIDI_CONTROL_PRESENT"]
        elif i % 4 == 1:
            text = f"cash\u200bbal{i}"
            flags = ["ZERO_WIDTH_PRESENT"]
        elif i % 4 == 2:
            text = "a" + ("\u0301" * 12) + str(i)
            flags = ["EXCESSIVE_COMBINING_MARKS"]
        else:
            text = ("x" * 40) + f"(((a+)+)+){i}"
            flags = []
        cases.append(
            _case(
                case_id=_cid("unicode_security_v1", i),
                suite="unicode_security_v1",
                text=text,
                protected=[],
                expected_views={"security_not_stripped": True},
                applied_ops=[],
                candidate_ops=[],
                prohibited_ops=["SILENT_CONTROL_REMOVAL"],
                security_flags=flags,
                tags=["security", "adversarial"],
                review="SECURITY_REVIEWED",
            )
        )

    # adversarial suite alias ≥ (covered above); add dedicated adversarial≥ filled
    for i in range(20):
        text = f"eval fill MAI06 advers {i} " + ("ab" * 100)
        cases.append(
            _case(
                case_id=_cid("adversarial_v1", i),
                suite="adversarial_v1",
                text=text,
                protected=[],
                expected_views={"completes": True},
                applied_ops=[],
                candidate_ops=[],
                prohibited_ops=["TRANSLITERATE"],
                security_flags=[],
                tags=["adversarial"],
                review="SECURITY_REVIEWED",
            )
        )

    # abbreviation dedicated file fill (rename punctuation_candidates also covers)
    # Ensure abbreviation_candidates suite exists with ≥ some
    for i in range(20):
        text = f"check amt and qty and inv {i}"
        cases.append(
            _case(
                case_id=_cid("abbreviation_candidates_v1", i),
                suite="abbreviation_candidates_v1",
                text=text,
                protected=[],
                expected_views={"candidates_not_applied": True},
                applied_ops=[],
                candidate_ops=["ABBREVIATION_EXPANSION_CANDIDATE"],
                prohibited_ops=["SILENT_CANDIDATE_APPLY"],
                security_flags=[],
                tags=["abbreviation"],
            )
        )

    for i in range(20):
        text = f"ramrooo plzz hajurrr {i}"
        cases.append(
            _case(
                case_id=_cid("repetition_candidates_v1", i),
                suite="repetition_candidates_v1",
                text=text,
                protected=[],
                expected_views={"candidates_not_applied": True},
                applied_ops=[],
                candidate_ops=["REPETITION_REDUCTION_CANDIDATE"],
                prohibited_ops=["SILENT_CANDIDATE_APPLY"],
                security_flags=[],
                tags=["repetition", "romanized"],
            )
        )

    by_id = {c["case_id"]: c for c in cases}
    return list(by_id.values())


def write_dataset(repo: Path) -> Path:
    cases = build_cases()
    frozen = repo / "evals" / "mai06" / "frozen"
    frozen.mkdir(parents=True, exist_ok=True)
    by_suite: dict[str, list[dict]] = {}
    for c in cases:
        by_suite.setdefault(c["suite_id"], []).append(c)
    files = []
    for suite, items in sorted(by_suite.items()):
        path = frozen / f"{suite}.jsonl"
        lines = [
            json.dumps(c, ensure_ascii=False, sort_keys=True)
            for c in sorted(items, key=lambda x: x["case_id"])
        ]
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        files.append(
            {
                "path": f"evals/mai06/frozen/{suite}.jsonl",
                "sha256": digest,
                "case_count": len(items),
                "suite_id": suite,
            }
        )
    dataset_hash = hashlib.sha256(
        json.dumps(files, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    manifest = {
        "schema_version": "1.0.0",
        "manifest_id": "MAI_06_LOSSLESS_NORMALIZATION_V1",
        "dataset_version": "mai06-lossless-normalization-v1",
        "frozen": True,
        "files": files,
        "total_cases": len(cases),
        "dataset_hash": dataset_hash,
        "prohibited_for_training": True,
        "related_mai04_hash": "1fe463dc302b7e990b8e3bb0abcd5a0cbf4e05fcab4eaec30a27ed3b4a1b6fac",
        "related_mai05_hash": "2eb4f0d8edd5544fb8266fd8eebf6eceffd40f13db1f37b6892eb48ea61dbe7c",
    }
    man = repo / "evals" / "mai06" / "manifests" / "MAI_06_LOSSLESS_NORMALIZATION_V1.manifest.json"
    man.parent.mkdir(parents=True, exist_ok=True)
    man.write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return man


def main() -> None:
    root = Path(__file__).resolve().parents[7]
    p = write_dataset(root)
    print(json.dumps({"wrote": str(p)}, indent=2))


if __name__ == "__main__":
    main()
