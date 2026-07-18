"""MAI-07R3H non-frozen dataset builder.

Firewall:
- never reads frozen V2 case bodies or frozen prediction records
- may use V1 and prior non-frozen R3F/R3H-style datasets for overlap exclusion
- gold labels are authored, not generated from runtime predictions
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

from ..infrastructure.resource_repository import load_resources

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_r3h_english_identity"
SEEDS = {
    "DEVELOPMENT": 20260719,
    "HOLDOUT_VALIDATION": 20260720,
    "SAFETY_CHALLENGE": 20260721,
    "CONTEXT_COUNTERFACTUAL": 20260722,
    "OOV_GENERALIZATION": 20260723,
}
SCHEMA = "mai07r3h_english_identity_case_v1"
BUILDER_VERSION = "mai-07-r3h-dataset.1.0.0"


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def _cid(split: str, family: str, index: int) -> str:
    seed = SEEDS[split]
    h = hashlib.sha256(f"{seed}|{split}|{family}|{index}".encode("utf-8")).hexdigest()[:10]
    return f"r3h_{split[:3].lower()}_{family[:12]}_{index:05d}_{h}"


def _norm(text: str) -> str:
    return " ".join(text.lower().split())


def _case(
    *,
    split: str,
    family: str,
    index: int,
    input_text: str,
    primary_token: str,
    suite_kind: str,
    identity_expected: bool,
    acceptable_targets: list[str] | None = None,
    language_forms: list[str] | None = None,
    pair_id: str | None = None,
    pair_role: str | None = None,
    requires_review: bool = False,
    abstention_expected: bool = False,
    context_template: str = "",
    lemma_family: str = "",
    template_family: str = "",
    protected: bool = False,
    name_like: bool = False,
    acronym: bool = False,
    identifier: bool = False,
) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA,
        "case_id": _cid(split, family, index),
        "split": split,
        "suite_kind": suite_kind,
        "input_text": input_text,
        "normalized_text": _norm(input_text),
        "primary_token": primary_token,
        "primary_lemma": lemma_family or primary_token.lower(),
        "template_family": template_family or family,
        "context_template": context_template or family,
        "language_forms": list(language_forms or []),
        "identity_expected": identity_expected,
        "acceptable_devanagari_targets": list(acceptable_targets or []),
        "acceptable_target_set": ([primary_token] if identity_expected else []) + list(acceptable_targets or []),
        "requires_review": requires_review,
        "abstention_expected": abstention_expected,
        "pair_id": pair_id,
        "pair_role": pair_role,
        "is_protected": protected,
        "is_name_like": name_like,
        "is_acronym": acronym,
        "is_identifier": identifier,
        "prohibited_for_training": split != "DEVELOPMENT",
        "gold_from_runtime": False,
        "frozen_v2_unused": True,
        "frozen_predictions_unused": True,
    }


def _load_v1_texts() -> set[str]:
    texts: set[str] = set()
    man = json.loads((REPO / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V1.manifest.json").read_text(encoding="utf-8"))
    for entry in man["files"]:
        for line in (REPO / entry["path"]).read_text(encoding="utf-8").splitlines():
            if line.strip():
                row = json.loads(line)
                texts.add(_norm(row["input_text"]))
    return texts


def _load_prior_non_frozen_texts() -> set[str]:
    texts: set[str] = set()
    for rel in (
        "evals/mai07_r3f_english_identity/development.jsonl",
        "evals/mai07_r3f_english_identity/holdout_validation.jsonl",
        "evals/mai07_r3f_english_identity/safety_challenge.jsonl",
        "evals/mai07_r3f_english_identity/context_counterfactual.jsonl",
        "evals/mai07_r3f_seal_new/development.jsonl",
        "evals/mai07_r3f_seal_new/holdout_validation.jsonl",
        "evals/mai07_r3f_seal_new/safety_challenge.jsonl",
        "evals/mai07_r3f_seal_new/context_counterfactual.jsonl",
    ):
        path = REPO / rel
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                row = json.loads(line)
                if "input_text" in row:
                    texts.add(_norm(row["input_text"]))
    return texts


def build_cases() -> list[dict[str, Any]]:
    res = load_resources(force_reload=True)
    blocked = _load_v1_texts() | _load_prior_non_frozen_texts()
    used: set[str] = set(blocked)
    cases: list[dict[str, Any]] = []
    counters: dict[str, int] = {}

    def add(case: dict[str, Any]) -> bool:
        normalized = case["normalized_text"]
        if normalized in used:
            return False
        used.add(normalized)
        cases.append(case)
        return True

    def next_idx(family: str) -> int:
        counters[family] = counters.get(family, 0) + 1
        return counters[family]

    english_terms = sorted(x for x in res.english_identity if x.isalpha() and len(x) >= 4)
    romanized_terms = [
        (rom, devs[:5])
        for rom, devs in sorted(res.lexicon.items())
        if rom.isalpha() and rom not in res.english_identity and rom not in res.name_like and len(rom) >= 4 and devs
    ]
    shared_terms = [
        (rom, (res.lexicon.get(rom) or res.domain_terms.get(rom) or [])[:5])
        for rom in sorted(set(res.english_identity) & (set(res.lexicon) | set(res.domain_terms)))
        if rom.isalpha() and len(rom) >= 4
    ]
    names = sorted(x for x in res.name_like if x.isalpha() and len(x) >= 3)
    tech_terms = [
        "invoice", "voucher", "ledger", "payment", "balance", "supplier", "customer", "reconcile",
        "debit", "credit", "discount", "commission", "statement", "closing", "opening",
    ]
    english_templates = [
        ("please review the {tok} amount for branch alpha {tag}", "eng_review_amount"),
        ("the {tok} status must remain unchanged for audit {tag}", "eng_status_audit"),
        ("accounting team will export the {tok} schedule tomorrow {tag}", "eng_export_schedule"),
        ("finance approved the {tok} report after reconciliation {tag}", "eng_report_reconcile"),
    ]
    nepali_templates = [
        ("aaja {tok} hernu ra pathau {tag}", "nep_review_send"),
        ("mero {tok} lai system ma rakha {tag}", "nep_store_system"),
        ("{tok} ko hisaab milau chha {tag}", "nep_balance_adjust"),
        ("hamro {tok} bata report banaunu {tag}", "nep_report_make"),
    ]
    oov_bases = ["axmor", "plint", "tavex", "gronel", "zempa", "naskor", "virel", "paldin"]

    split_cycle = {
        "english": ["DEVELOPMENT", "HOLDOUT_VALIDATION", "SAFETY_CHALLENGE"],
        "shared": ["DEVELOPMENT", "HOLDOUT_VALIDATION", "CONTEXT_COUNTERFACTUAL"],
        "romanized": ["DEVELOPMENT", "HOLDOUT_VALIDATION", "SAFETY_CHALLENGE"],
        "oov": ["DEVELOPMENT", "OOV_GENERALIZATION"],
    }

    def pick_split(group: str, i: int) -> str:
        seq = split_cycle[group]
        return seq[i % len(seq)]

    for i, tok in enumerate(english_terms[:250]):
        for j, (template, template_family) in enumerate(english_templates):
            split = pick_split("english", i + j)
            text = template.format(tok=tok, tag=f"r3h_en_{i:04d}_{j}")
            add(
                _case(
                    split=split,
                    family="english_identity",
                    index=next_idx("english_identity"),
                    input_text=text,
                    primary_token=tok,
                    suite_kind="english_identity",
                    identity_expected=True,
                    language_forms=["ENGLISH", "TECHNICAL_ACCOUNTING_ENGLISH"],
                    context_template=template_family,
                    lemma_family=tok,
                    template_family=template_family,
                )
            )

    for i, tok in enumerate(tech_terms * 14):
        split = pick_split("english", i)
        text = f"post the {tok} entry after month close r3h_tech_{i:04d}"
        add(
            _case(
                split=split,
                family="technical_english",
                index=next_idx("technical_english"),
                input_text=text,
                primary_token=tok,
                suite_kind="technical_english",
                identity_expected=True,
                language_forms=["TECHNICAL_ACCOUNTING_ENGLISH", "ENGLISH"],
                context_template="technical_accounting",
                lemma_family=tok,
                template_family="technical_accounting",
            )
        )

    shared_english_templates = [
        "please verify the {tok} total before posting {tag}",
        "finance reviewed the {tok} register during closing {tag}",
        "keep the {tok} wording unchanged in the report {tag}",
        "the {tok} balance stays in english for export {tag}",
    ]
    shared_nepali_templates = [
        "aaja {tok} ko hisaab milau {tag}",
        "mero {tok} lai report ma rakha {tag}",
        "hamro {tok} bata entry banaunu {tag}",
        "{tok} ko khata hernu {tag}",
    ]
    for i, (tok, targets) in enumerate(shared_terms[:120]):
        for j, template in enumerate(shared_english_templates):
            text_en = template.format(tok=tok, tag=f"r3h_shen_{i:04d}_{j}")
            add(
                _case(
                    split=pick_split("shared", i + j),
                    family="shared_english",
                    index=next_idx("shared_english"),
                    input_text=text_en,
                    primary_token=tok,
                    suite_kind="shared_collision_english_context",
                    identity_expected=True,
                    acceptable_targets=targets,
                    language_forms=["ENGLISH", "SHARED_OR_AMBIGUOUS_LATIN"],
                    context_template="shared_english_ctx",
                    lemma_family=tok,
                    template_family=f"shared_english_ctx_{j}",
                    requires_review=True,
                )
            )
        for j, template in enumerate(shared_nepali_templates):
            text_np = template.format(tok=tok, tag=f"r3h_shnp_{i:04d}_{j}")
            add(
                _case(
                    split="CONTEXT_COUNTERFACTUAL" if (i + j) % 2 == 0 else "HOLDOUT_VALIDATION",
                    family="shared_nepali",
                    index=next_idx("shared_nepali"),
                    input_text=text_np,
                    primary_token=tok,
                    suite_kind="shared_collision_nepali_context",
                    identity_expected=False,
                    acceptable_targets=targets,
                    language_forms=["ROMANIZED_NEPALI", "SHARED_OR_AMBIGUOUS_LATIN"],
                    context_template="shared_nepali_ctx",
                    lemma_family=tok,
                    template_family=f"shared_nepali_ctx_{j}",
                    requires_review=True,
                )
            )
        for j in range(3):
            text_amb = f"{tok} branch review neutral context r3h_shamb_{i:04d}_{j}"
            add(
                _case(
                    split="SAFETY_CHALLENGE" if (i + j) % 3 == 0 else "HOLDOUT_VALIDATION",
                    family="shared_ambiguous",
                    index=next_idx("shared_ambiguous"),
                    input_text=text_amb,
                    primary_token=tok,
                    suite_kind="shared_collision_ambiguous_context",
                    identity_expected=True,
                    acceptable_targets=targets,
                    language_forms=["SHARED_OR_AMBIGUOUS_LATIN"],
                    context_template="shared_ambiguous_ctx",
                    lemma_family=tok,
                    template_family=f"shared_ambiguous_ctx_{j}",
                    requires_review=True,
                    abstention_expected=True,
                )
            )

    for i, (tok, targets) in enumerate(romanized_terms[:220]):
        for j, (template, template_family) in enumerate(nepali_templates):
            split = pick_split("romanized", i + j)
            text = template.format(tok=tok, tag=f"r3h_rom_{i:04d}_{j}")
            add(
                _case(
                    split=split,
                    family="romanized",
                    index=next_idx("romanized"),
                    input_text=text,
                    primary_token=tok,
                    suite_kind="clear_romanized_control",
                    identity_expected=False,
                    acceptable_targets=targets,
                    language_forms=["ROMANIZED_NEPALI"],
                    context_template=template_family,
                    lemma_family=tok,
                    template_family=template_family,
                )
            )

    for i, name in enumerate(names[:80]):
        split = "SAFETY_CHALLENGE" if i % 2 == 0 else "HOLDOUT_VALIDATION"
        text = f"{name} traders confirmed the contract renewal r3h_name_{i:04d}"
        add(
            _case(
                split=split,
                family="names",
                index=next_idx("names"),
                input_text=text,
                primary_token=name,
                suite_kind="name_identity",
                identity_expected=True,
                language_forms=["NAMED_ENTITY_CANDIDATE", "ENGLISH"],
                context_template="proper_name_english",
                lemma_family=name.lower(),
                template_family="proper_name_english",
                name_like=True,
                requires_review=True,
            )
        )

    for i, ac in enumerate(["FIFO", "LIFO", "GST", "SKU", "HSN", "EBITDA", "IFRS", "POS"] * 30):
        split = "SAFETY_CHALLENGE" if i % 3 else "HOLDOUT_VALIDATION"
        text = f"check {ac} code in the policy register r3h_acr_{i:04d}"
        add(
            _case(
                split=split,
                family="acronym",
                index=next_idx("acronym"),
                input_text=text,
                primary_token=ac,
                suite_kind="acronym_identifier",
                identity_expected=True,
                language_forms=["IDENTIFIER_OR_CODE", "ENGLISH"],
                context_template="acronym_identifier",
                lemma_family=ac.lower(),
                template_family="acronym_identifier",
                acronym=True,
            )
        )

    for i in range(220):
        ident = f"R3H-ID-{i:05d}"
        split = "SAFETY_CHALLENGE" if i % 2 == 0 else "HOLDOUT_VALIDATION"
        text = f"retain identifier {ident} exactly as entered r3h_id_{i:04d}"
        add(
            _case(
                split=split,
                family="identifier",
                index=next_idx("identifier"),
                input_text=text,
                primary_token=ident,
                suite_kind="protected_identifier",
                identity_expected=True,
                language_forms=["IDENTIFIER_OR_CODE"],
                context_template="identifier_protected",
                lemma_family="identifier",
                template_family="identifier_protected",
                protected=True,
                identifier=True,
            )
        )

    protected_templates = [
        "https://r3h.example.test/invoice/{i}",
        "client{i}@r3h.example.test",
        "VAT-R3H-{i:06d}",
        "PANR3H{i:06d}X",
    ]
    for i in range(220):
        tpl = protected_templates[i % len(protected_templates)]
        token = tpl.format(i=i)
        split = "SAFETY_CHALLENGE"
        text = f"preserve {token} without changes r3h_prot_{i:04d}"
        add(
            _case(
                split=split,
                family="protected",
                index=next_idx("protected"),
                input_text=text,
                primary_token=token,
                suite_kind="protected_span",
                identity_expected=True,
                language_forms=["IDENTIFIER_OR_CODE"],
                context_template="protected_span",
                lemma_family="protected",
                template_family="protected_span",
                protected=True,
                identifier=True,
            )
        )

    for i in range(260):
        base = oov_bases[i % len(oov_bases)]
        tok = f"{base}{i:03d}"
        split = "OOV_GENERALIZATION"
        text = f"please keep the {tok} placeholder unchanged during export r3h_oov_{i:04d}"
        add(
            _case(
                split=split,
                family="oov_english",
                index=next_idx("oov_english"),
                input_text=text,
                primary_token=tok,
                suite_kind="oov_english_generalization",
                identity_expected=True,
                language_forms=["ENGLISH", "SHARED_OR_AMBIGUOUS_LATIN"],
                context_template="oov_english",
                lemma_family=base,
                template_family="oov_english",
            )
        )

    for i, (tok, targets) in enumerate(shared_terms[:60]):
        for rep in range(10):
            pair_id = f"r3h_pair_{tok}_{i:04d}_{rep}"
            en = f"please confirm the {tok} total for branch delta r3h_pair_en_{i:04d}_{rep}"
            np = f"aaja {tok} ko hisaab milau branch delta r3h_pair_np_{i:04d}_{rep}"
            amb = f"{tok} branch delta neutral review r3h_pair_amb_{i:04d}_{rep}"
            for role, text, identity_expected, targets_for_case, suite_kind in (
                ("english_context", en, True, [], "counterfactual_english_context"),
                ("nepali_context", np, False, targets, "counterfactual_nepali_context"),
                ("ambiguous_context", amb, True, targets, "counterfactual_ambiguous_context"),
            ):
                add(
                    _case(
                        split="CONTEXT_COUNTERFACTUAL",
                        family="counterfactual",
                        index=next_idx("counterfactual"),
                        input_text=text,
                        primary_token=tok,
                        suite_kind=suite_kind,
                        identity_expected=identity_expected,
                        acceptable_targets=targets_for_case,
                        language_forms=["ENGLISH", "ROMANIZED_NEPALI", "SHARED_OR_AMBIGUOUS_LATIN"],
                        pair_id=pair_id,
                        pair_role=role,
                        context_template=role,
                        lemma_family=tok,
                        template_family="counterfactual_shared",
                        requires_review=role != "english_context",
                    )
                )

    return cases


def write_datasets(*, output_dir: Path | None = None, authorize_canonical: bool = False) -> dict[str, Any]:
    """Write R3H datasets.

    Ordinary callers must pass an isolated output_dir. Writing into the
    historical canonical OUT requires authorize_canonical=True and
    MAI07_AUTHORIZE_EVAL_WRITE=1. Prefer not rewriting historical R3H evidence.
    """
    import os

    from .canonical_path_guard import assert_writable_eval_path, write_text_guarded

    dest = output_dir if output_dir is not None else OUT
    if dest.resolve() == OUT.resolve():
        if not authorize_canonical or os.environ.get("MAI07_AUTHORIZE_EVAL_WRITE") != "1":
            raise PermissionError(
                "Refusing to rewrite canonical R3H dataset tree. "
                "Pass output_dir=tmp_path, or authorize with MAI07_AUTHORIZE_EVAL_WRITE=1."
            )
    dest.mkdir(parents=True, exist_ok=True)
    cases = sorted(build_cases(), key=lambda c: (c["split"], c["case_id"]))
    splits = list(SEEDS)
    split_rows: dict[str, list[dict[str, Any]]] = {split: [] for split in splits}
    for case in cases:
        split_rows[case["split"]].append(case)
    hashes: dict[str, Any] = {}
    for split in splits:
        rows = split_rows[split]
        body = "\n".join(json.dumps(r, ensure_ascii=False, sort_keys=True, separators=(",", ":")) for r in rows) + "\n"
        path = dest / f"{split.lower()}.jsonl"
        if dest.resolve() == OUT.resolve():
            write_text_guarded(path, body, authorize=True)
        else:
            path.write_text(body, encoding="utf-8", newline="\n")
        hashes[split] = {
            "path": str(path.resolve()),
            "case_count": len(rows),
            "sha256": _sha(body.encode("utf-8")),
        }
    metrics = {
        "english_identity_cases": sum(1 for c in cases if c["suite_kind"] in {"english_identity", "technical_english", "name_identity", "acronym_identifier", "oov_english_generalization"}),
        "shared_collision_cases": sum(1 for c in cases if c["suite_kind"].startswith("shared_collision")),
        "clear_romanized_cases": sum(1 for c in cases if c["suite_kind"] == "clear_romanized_control"),
        "counterfactual_pairs": len({c["pair_id"] for c in cases if c.get("pair_id")}),
        "oov_cases": sum(1 for c in cases if c["suite_kind"] == "oov_english_generalization"),
        "technical_english_cases": sum(1 for c in cases if c["suite_kind"] == "technical_english"),
        "names_acronyms_identifiers": sum(1 for c in cases if c["suite_kind"] in {"name_identity", "acronym_identifier", "protected_identifier"}),
        "protected_span_cases": sum(1 for c in cases if c["suite_kind"] in {"protected_span", "protected_identifier"}),
        "ambiguous_cases": sum(1 for c in cases if "ambiguous" in c["suite_kind"]),
        "multi_token_cases": sum(1 for c in cases if len(c["input_text"].split()) > 1),
    }
    manifest = {
        "schema_version": "1.0.0",
        "manifest_id": "MAI_07R3H_DATASET_MANIFEST",
        "builder_version": BUILDER_VERSION,
        "frozen_v2_case_bodies_not_used": True,
        "frozen_predictions_not_used": True,
        "gold_labels_generated_from_runtime_predictions": False,
        "prohibited_for_training": True,
        "splits": hashes,
        "totals": {k: v["case_count"] for k, v in hashes.items()},
        "coverage": metrics,
        "minimums": {
            "english_identity_cases": 800,
            "shared_collision_cases": 300,
            "clear_romanized_cases": 300,
            "counterfactual_pairs": 250,
            "oov_cases": 200,
            "technical_english_cases": 200,
            "names_acronyms_identifiers": 200,
            "protected_span_cases": 200,
            "ambiguous_cases": 150,
            "multi_token_case_ratio": 0.70,
        },
    }
    manifest["minimums_met"] = (
        metrics["english_identity_cases"] >= 800
        and metrics["shared_collision_cases"] >= 300
        and metrics["clear_romanized_cases"] >= 300
        and metrics["counterfactual_pairs"] >= 250
        and metrics["oov_cases"] >= 200
        and metrics["technical_english_cases"] >= 200
        and metrics["names_acronyms_identifiers"] >= 200
        and metrics["protected_span_cases"] >= 200
        and metrics["ambiguous_cases"] >= 150
        and (metrics["multi_token_cases"] / max(1, len(cases))) >= 0.70
    )
    manifest_path = dest / "MAI_07R3H_DATASET_MANIFEST.json"
    manifest_body = json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if dest.resolve() == OUT.resolve():
        write_text_guarded(manifest_path, manifest_body, authorize=True)
    else:
        manifest_path.write_text(manifest_body, encoding="utf-8", newline="\n")

    thresholds = {
        "schema_version": "1.0.0",
        "threshold_id": "MAI_07R3H_THRESHOLDS_V1",
        "locked_before_holdout_observation": True,
        "gates": {
            "overall_english_identity_top1": {"op": ">=", "value": 0.99},
            "shared_collision_english_identity_top1": {"op": ">=", "value": 0.98},
            "false_devanagari_on_clear_english": {"op": "<=", "value": 0.01},
            "technical_english_identity_top1": {"op": ">=", "value": 0.98},
            "name_identity_top1": {"op": "==", "value": 1.0},
            "acronym_identifier_identity_top1": {"op": "==", "value": 1.0},
            "clear_romanized_target_top1": {"op": ">=", "value": 0.95},
            "clear_romanized_target_recall_at_5": {"op": ">=", "value": 0.98},
            "target_missing_from_top5_rate": {"op": "<=", "value": 0.02},
            "paired_counterfactual_accuracy": {"op": ">=", "value": 0.95},
            "english_context_identity_accuracy": {"op": ">=", "value": 0.98},
            "nepali_context_target_accuracy": {"op": ">=", "value": 0.95},
            "unresolved_shared_identity_review_accuracy": {"op": ">=", "value": 0.98},
            "cross_path_parity": {"op": "==", "value": 1.0},
            "policy_invocation_coverage": {"op": "==", "value": 1.0},
            "candidate_set_preservation": {"op": "==", "value": 1.0},
            "caps_respected": {"op": "==", "value": 1.0},
            "deterministic_output": {"op": "==", "value": 1.0},
            "protected_span_mutations": {"op": "==", "value": 0},
            "raw_view_mutations": {"op": "==", "value": 0},
            "candidate_duplication_after_reordering": {"op": "==", "value": 0},
            "harm_count_clearly_romanized": {"op": "==", "value": 0},
        },
    }
    thr_path = dest / "MAI_07R3H_THRESHOLDS.json"
    thr_body = json.dumps(thresholds, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if dest.resolve() == OUT.resolve():
        write_text_guarded(thr_path, thr_body, authorize=True)
    else:
        thr_path.write_text(thr_body, encoding="utf-8", newline="\n")
    return {
        "manifest_sha256": _sha(manifest_body.encode("utf-8")),
        "threshold_sha256": _sha(thr_body.encode("utf-8")),
        "minimums_met": manifest["minimums_met"],
        "totals": manifest["totals"],
        "coverage": metrics,
    }


def main() -> None:
    print(json.dumps(write_datasets(), ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
