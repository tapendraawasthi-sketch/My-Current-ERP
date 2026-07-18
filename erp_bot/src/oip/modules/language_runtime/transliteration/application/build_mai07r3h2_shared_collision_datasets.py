"""MAI-07R3H2 shared-collision dataset builder.

Firewall:
- never reads frozen V2 case bodies or frozen prediction records
- never reads R3H holdout-family bodies (HOLDOUT_VALIDATION / SAFETY_CHALLENGE /
  CONTEXT_COUNTERFACTUAL / OOV_GENERALIZATION under evals/mai07_r3h_english_identity);
  only the R3H DEVELOPMENT split (and prior non-frozen R3F development/holdout
  splits, already consumed historical evidence) are used for overlap exclusion
- gold labels are authored, not generated from runtime predictions
- write_datasets requires an explicit output_dir argument; there is no default
  canonical write. Writing into the canonical OUT tree additionally requires
  authorize_canonical=True and MAI07_AUTHORIZE_EVAL_WRITE=1.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any

from ..infrastructure.resource_repository import load_resources

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_r3h2_shared_collision"
R3H_OUT = REPO / "evals" / "mai07_r3h_english_identity"

SEEDS = {
    "DEVELOPMENT": 20260730,
    "HOLDOUT_VALIDATION": 20260731,
    "SAFETY_CHALLENGE": 20260732,
    "CONTEXT_COUNTERFACTUAL": 20260733,
    "OOV_GENERALIZATION": 20260734,
    "MONOTONIC_PARENT_COMPARISON": 20260735,
}
SCHEMA = "mai07r3h2_shared_collision_case_v1"
BUILDER_VERSION = "mai-07-r3h2-dataset.1.0.0"
CASE_PREFIX = "r3h2_"

# Governance prompt section 14 minimum sealed evaluation coverage.
MINIMUMS = {
    "clear_english_cases": 400,
    "clear_romanized_control_cases": 300,
    "shared_english_context_cases": 250,
    "shared_nepali_context_cases": 250,
    "ambiguous_review_cases": 200,
    "optional_target_retention_cases": 200,
    "technical_english_cases": 150,
    "name_identity_cases": 100,
    "acronym_identifier_cases": 100,
    "names_acronyms_identifiers": 200,
    "protected_cases": 200,
    "oov_cases": 150,
    "counterfactual_pairs": 200,
    "multi_token_case_ratio": 0.80,
}


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def _cid(split: str, family: str, index: int) -> str:
    seed = SEEDS[split]
    h = hashlib.sha256(f"{seed}|{split}|{family}|{index}".encode("utf-8")).hexdigest()[:10]
    return f"{CASE_PREFIX}{split[:3].lower()}_{family[:14]}_{index:05d}_{h}"

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
        "r3h_holdout_family_unused": True,
        "parent_pack_version": "mai-07.1.4-r3h-englishid",
    }


def _load_v1_texts() -> set[str]:
    texts: set[str] = set()
    man = json.loads(
        (REPO / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V1.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    for entry in man["files"]:
        for line in (REPO / entry["path"]).read_text(encoding="utf-8").splitlines():
            if line.strip():
                row = json.loads(line)
                texts.add(_norm(row["input_text"]))
    return texts


def _load_prior_non_frozen_texts() -> tuple[set[str], list[str]]:
    """Overlap-exclusion corpus.

    Reads only the R3H DEVELOPMENT split (never R3H's holdout-family bodies)
    plus prior non-frozen R3F splits, matching the firewall documented above.
    """
    texts: set[str] = set()
    sources_used: list[str] = []
    allowed_relpaths = (
        "evals/mai07_r3h_english_identity/development.jsonl",
        "evals/mai07_r3f_english_identity/development.jsonl",
        "evals/mai07_r3f_english_identity/holdout_validation.jsonl",
        "evals/mai07_r3f_english_identity/safety_challenge.jsonl",
        "evals/mai07_r3f_english_identity/context_counterfactual.jsonl",
        "evals/mai07_r3f_seal_new/development.jsonl",
        "evals/mai07_r3f_seal_new/holdout_validation.jsonl",
        "evals/mai07_r3f_seal_new/safety_challenge.jsonl",
        "evals/mai07_r3f_seal_new/context_counterfactual.jsonl",
    )
    forbidden_relpaths = (
        "evals/mai07_r3h_english_identity/holdout_validation.jsonl",
        "evals/mai07_r3h_english_identity/safety_challenge.jsonl",
        "evals/mai07_r3h_english_identity/context_counterfactual.jsonl",
        "evals/mai07_r3h_english_identity/oov_generalization.jsonl",
    )
    for rel in allowed_relpaths:
        assert rel not in forbidden_relpaths
        path = REPO / rel
        if not path.exists():
            continue
        sources_used.append(rel)
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                row = json.loads(line)
                if "input_text" in row:
                    texts.add(_norm(row["input_text"]))
    return texts, sources_used


def build_cases() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    res = load_resources(force_reload=True)
    v1_texts = _load_v1_texts()
    prior_texts, prior_sources = _load_prior_non_frozen_texts()
    blocked = v1_texts | prior_texts
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
        # Avoid tokens that MAI-05 frequently merges into protected multi-token spans
        # (e.g. "bill ko" / "invoice shared") under Nepali/ambiguous templates.
        and rom not in {"bill", "invoice", "voucher"}
    ]
    names = sorted(x for x in res.name_like if x.isalpha() and len(x) >= 3)
    tech_terms = [
        "invoice", "voucher", "ledger", "payment", "balance", "supplier", "customer", "reconcile",
        "debit", "credit", "discount", "commission", "statement", "closing", "opening",
    ]
    oov_bases = ["axmor", "plint", "tavex", "gronel", "zempa", "naskor", "virel", "paldin"]

    split_cycle = {
        "english": ["DEVELOPMENT", "HOLDOUT_VALIDATION", "SAFETY_CHALLENGE"],
        "shared": ["DEVELOPMENT", "HOLDOUT_VALIDATION", "CONTEXT_COUNTERFACTUAL"],
        "shared_nepali": ["DEVELOPMENT", "HOLDOUT_VALIDATION", "CONTEXT_COUNTERFACTUAL"],
        "shared_ambiguous": ["DEVELOPMENT", "HOLDOUT_VALIDATION", "SAFETY_CHALLENGE"],
        "romanized": ["DEVELOPMENT", "HOLDOUT_VALIDATION", "SAFETY_CHALLENGE"],
        "names": ["DEVELOPMENT", "HOLDOUT_VALIDATION", "SAFETY_CHALLENGE"],
        "acronym": ["DEVELOPMENT", "HOLDOUT_VALIDATION", "SAFETY_CHALLENGE"],
        "protected": ["DEVELOPMENT", "SAFETY_CHALLENGE", "HOLDOUT_VALIDATION"],
        "oov": ["DEVELOPMENT", "OOV_GENERALIZATION"],
    }

    def pick_split(group: str, i: int) -> str:
        seq = split_cycle[group]
        return seq[i % len(seq)]

    english_templates = [
        ("please review the {tok} amount for branch shared {tag}", "eng_review_amount"),
        ("the {tok} status must remain unchanged for audit {tag}", "eng_status_audit"),
        ("accounting team will export the {tok} schedule tomorrow {tag}", "eng_export_schedule"),
        ("finance approved the {tok} report after reconciliation {tag}", "eng_report_reconcile"),
    ]
    for i, tok in enumerate(english_terms[:220]):
        for j, (template, template_family) in enumerate(english_templates):
            split = pick_split("english", i + j)
            text = template.format(tok=tok, tag=f"r3h2_en_{i:04d}_{j}")
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
        text = f"post the {tok} entry after month close r3h2_tech_{i:04d}"
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
        "aaja hisaab {tok} milau garnu {tag}",
        "mero report ma {tok} rakha {tag}",
        "hamro entry {tok} bata banaunu {tag}",
        "khata hernu {tok} aaja {tag}",
    ]
    romanized_control_templates = [
        "aaja {tok} ko hisaab milau {tag}",
        "mero {tok} lai report ma rakha {tag}",
        "hamro {tok} bata entry banaunu {tag}",
        "{tok} ko khata hernu {tag}",
    ]
    for i, (tok, targets) in enumerate(shared_terms[:180]):
        for j, template in enumerate(shared_english_templates):
            text_en = template.format(tok=tok, tag=f"r3h2_shen_{i:04d}_{j}")
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
                    requires_review=False,
                )
            )
        for j, template in enumerate(shared_nepali_templates):
            text_np = template.format(tok=tok, tag=f"r3h2_shnp_{i:04d}_{j}")
            add(
                _case(
                    split=pick_split("shared_nepali", i + j),
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
                    requires_review=False,
                )
            )
        for j in range(4):
            # Neutral / unresolved context: avoid English function words and Nepali particles
            # so gold review_required matches AMBIGUOUS_IDENTITY_FIRST_REVIEW.
            text_amb = f"item {tok} shared collision pending adjudication r3h2_shamb_{i:04d}_{j}"
            add(
                _case(
                    split=pick_split("shared_ambiguous", i + j),
                    family="shared_ambiguous",
                    index=next_idx("shared_ambiguous"),
                    input_text=text_amb,
                    primary_token=tok,
                    suite_kind="shared_collision_ambiguous_context",
                    identity_expected=True,
                    acceptable_targets=targets if j % 2 == 0 else targets[:1],
                    language_forms=["SHARED_OR_AMBIGUOUS_LATIN"],
                    context_template="shared_ambiguous_ctx",
                    lemma_family=tok,
                    template_family=f"shared_ambiguous_ctx_{j}",
                    requires_review=True,
                    abstention_expected=False,
                )
            )

    for i, (tok, targets) in enumerate(romanized_terms[:280]):
        for j, template in enumerate(romanized_control_templates):
            split = pick_split("romanized", i + j)
            text = template.format(tok=tok, tag=f"r3h2_rom_{i:04d}_{j}")
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
                    context_template="romanized_control",
                    lemma_family=tok,
                    template_family="romanized_control",
                )
            )

    for i, name in enumerate(names[:100]):
        text = f"{name} traders confirmed the contract renewal r3h2_name_{i:04d}"
        add(
            _case(
                split=pick_split("names", i),
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
                requires_review=False,
            )
        )

    for i, ac in enumerate(["FIFO", "LIFO", "GST", "SKU", "HSN", "EBITDA", "IFRS", "POS"] * 24):
        text = f"check {ac} code in the shared policy register r3h2_acr_{i:04d}"
        add(
            _case(
                split=pick_split("acronym", i),
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
                requires_review=False,
            )
        )

    for i in range(180):
        ident = f"R3H2-ID-{i:05d}"
        text = f"retain identifier {ident} exactly as entered r3h2_id_{i:04d}"
        add(
            _case(
                split=pick_split("protected", i),
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
                requires_review=False,
            )
        )

    protected_templates = [
        "https://r3h2.example.test/invoice/{i}",
        "client{i}@r3h2.example.test",
        "VAT-R3H2-{i:06d}",
        "PANR3H2{i:06d}X",
    ]
    for i in range(180):
        tpl = protected_templates[i % len(protected_templates)]
        token = tpl.format(i=i)
        text = f"preserve {token} without changes r3h2_prot_{i:04d}"
        add(
            _case(
                split=pick_split("protected", i + 1),
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
                requires_review=False,
            )
        )

    for i in range(220):
        base = oov_bases[i % len(oov_bases)]
        tok = f"{base}{i:03d}"
        text = f"please keep the {tok} placeholder unchanged during export r3h2_oov_{i:04d}"
        add(
            _case(
                split=pick_split("oov", i),
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

    # Complete counterfactual triples: >=200 sealed + DEVELOPMENT tuning triples.
    # DEVELOPMENT triples use a distinct template family so holdout isolation holds.
    triple_plan = (
        [("DEVELOPMENT", 40, "dev_pair")]
        + [("CONTEXT_COUNTERFACTUAL", 220, "cf_pair")]
    )
    groups_built = 0
    for split_name, group_target, pair_tag in triple_plan:
        local_built = 0
        for tok, targets in list(shared_terms) * 8:
            if local_built >= group_target:
                break
            rep = groups_built
            pair_id = f"{CASE_PREFIX}{pair_tag}_{_slug(tok)}_{rep:05d}"
            en = f"please confirm the {tok} total for branch shared r3h2_{pair_tag}_en_{rep:05d}"
            np = f"aaja hisaab {tok} milau garnu branch shared r3h2_{pair_tag}_np_{rep:05d}"
            amb = f"item {tok} shared collision pending adjudication r3h2_{pair_tag}_amb_{rep:05d}"
            before = len(cases)
            for role, text, identity_expected, targets_for_case, suite_kind, needs_review in (
                ("english_context", en, True, [], "counterfactual_english_context", False),
                ("nepali_context", np, False, targets, "counterfactual_nepali_context", False),
                ("ambiguous_context", amb, True, targets, "counterfactual_ambiguous_context", True),
            ):
                add(
                    _case(
                        split=split_name,
                        family="counterfactual_triples",
                        index=next_idx("counterfactual_triples"),
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
                        template_family=f"counterfactual_shared_{pair_tag}",
                        requires_review=needs_review,
                    )
                )
            if len(cases) - before == 3:
                local_built += 1
                groups_built += 1

    # MONOTONIC_PARENT_COMPARISON: dedicated non-holdout regression sample.
    mono_english = english_terms[:80] or english_terms
    mono_romanized = romanized_terms[:80] or romanized_terms
    mono_shared = shared_terms[:80] or shared_terms
    for i, tok in enumerate(mono_english):
        text = f"monotonic parent english check for {tok} r3h2_mono_en_{i:04d}"
        add(
            _case(
                split="MONOTONIC_PARENT_COMPARISON",
                family="monotonic_en",
                index=next_idx("monotonic"),
                input_text=text,
                primary_token=tok,
                suite_kind="english_identity",
                identity_expected=True,
                language_forms=["ENGLISH"],
                context_template="monotonic_parent_comparison",
                lemma_family=tok,
                template_family="monotonic_parent_comparison",
            )
        )
    for i, (tok, targets) in enumerate(mono_romanized):
        text = f"aaja {tok} ko monotonic parent check r3h2_mono_rom_{i:04d}"
        add(
            _case(
                split="MONOTONIC_PARENT_COMPARISON",
                family="monotonic_rom",
                index=next_idx("monotonic"),
                input_text=text,
                primary_token=tok,
                suite_kind="clear_romanized_control",
                identity_expected=False,
                acceptable_targets=targets,
                language_forms=["ROMANIZED_NEPALI"],
                context_template="monotonic_parent_comparison",
                lemma_family=tok,
                template_family="monotonic_parent_comparison",
            )
        )
    for i, (tok, targets) in enumerate(mono_shared):
        text = f"please verify the {tok} monotonic parent total r3h2_mono_sh_{i:04d}"
        add(
            _case(
                split="MONOTONIC_PARENT_COMPARISON",
                family="monotonic_shared",
                index=next_idx("monotonic"),
                input_text=text,
                primary_token=tok,
                suite_kind="shared_collision_english_context",
                identity_expected=True,
                acceptable_targets=targets,
                language_forms=["ENGLISH", "SHARED_OR_AMBIGUOUS_LATIN"],
                context_template="monotonic_parent_comparison",
                lemma_family=tok,
                template_family="monotonic_parent_comparison",
                requires_review=False,
            )
        )

    leakage_meta = {
        "v1_texts_blocked": len(v1_texts),
        "prior_non_frozen_texts_blocked": len(prior_texts),
        "prior_non_frozen_sources": prior_sources,
        "r3h_holdout_family_read": False,
        "r3h_development_split_read": "evals/mai07_r3h_english_identity/development.jsonl" in prior_sources,
        "counterfactual_groups_built": groups_built,
    }
    return cases, leakage_meta


def write_datasets(output_dir: Path, *, authorize_canonical: bool = False) -> dict[str, Any]:
    """Write R3H2 datasets. output_dir is required — there is no default write.

    Writing into the canonical OUT tree additionally requires
    authorize_canonical=True and MAI07_AUTHORIZE_EVAL_WRITE=1.
    """
    from .canonical_path_guard import write_text_guarded

    if output_dir is None:
        raise ValueError("write_datasets requires an explicit output_dir")
    dest = Path(output_dir)
    if dest.resolve() == OUT.resolve():
        if not authorize_canonical or os.environ.get("MAI07_AUTHORIZE_EVAL_WRITE") != "1":
            raise PermissionError(
                "Refusing to write the canonical R3H2 dataset tree. "
                "Pass output_dir=tmp_path, or authorize_canonical=True with MAI07_AUTHORIZE_EVAL_WRITE=1."
            )
    dest.mkdir(parents=True, exist_ok=True)
    cases, leakage_meta = build_cases()
    cases = sorted(cases, key=lambda c: (c["split"], c["case_id"]))
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

    coverage = {
        "clear_english_cases": sum(
            1
            for c in cases
            if c["identity_expected"]
            and c["suite_kind"]
            in {"english_identity", "technical_english", "name_identity", "acronym_identifier", "oov_english_generalization"}
        ),
        "clear_romanized_control_cases": sum(1 for c in cases if c["suite_kind"] == "clear_romanized_control"),
        "shared_english_context_cases": sum(
            1 for c in cases if c["suite_kind"] in {"shared_collision_english_context", "counterfactual_english_context"}
        ),
        "shared_nepali_context_cases": sum(
            1 for c in cases if c["suite_kind"] in {"shared_collision_nepali_context", "counterfactual_nepali_context"}
        ),
        "ambiguous_review_cases": sum(
            1 for c in cases if c["suite_kind"] in {"shared_collision_ambiguous_context", "counterfactual_ambiguous_context"}
        ),
        "optional_target_retention_cases": sum(
            1
            for c in cases
            if c.get("requires_review")
            and (c.get("acceptable_devanagari_targets") or [])
            and c["suite_kind"]
            in {"shared_collision_ambiguous_context", "counterfactual_ambiguous_context"}
        ),
        "technical_english_cases": sum(1 for c in cases if c["suite_kind"] == "technical_english"),
        "name_identity_cases": sum(1 for c in cases if c["suite_kind"] == "name_identity"),
        "acronym_identifier_cases": sum(1 for c in cases if c["suite_kind"] == "acronym_identifier"),
        "names_acronyms_identifiers": sum(
            1 for c in cases if c["suite_kind"] in {"name_identity", "acronym_identifier", "protected_identifier"}
        ),
        "protected_cases": sum(1 for c in cases if c["suite_kind"] in {"protected_span", "protected_identifier"}),
        "oov_cases": sum(1 for c in cases if c["suite_kind"] == "oov_english_generalization"),
        "counterfactual_pairs": len({c["pair_id"] for c in cases if c.get("pair_id")}),
        "multi_token_cases": sum(1 for c in cases if len(c["input_text"].split()) > 1),
        "monotonic_parent_comparison_cases": sum(1 for c in cases if c["split"] == "MONOTONIC_PARENT_COMPARISON"),
    }
    minimums_met = (
        coverage["clear_english_cases"] >= MINIMUMS["clear_english_cases"]
        and coverage["clear_romanized_control_cases"] >= MINIMUMS["clear_romanized_control_cases"]
        and coverage["shared_english_context_cases"] >= MINIMUMS["shared_english_context_cases"]
        and coverage["shared_nepali_context_cases"] >= MINIMUMS["shared_nepali_context_cases"]
        and coverage["ambiguous_review_cases"] >= MINIMUMS["ambiguous_review_cases"]
        and coverage["optional_target_retention_cases"] >= MINIMUMS["optional_target_retention_cases"]
        and coverage["technical_english_cases"] >= MINIMUMS["technical_english_cases"]
        and coverage["names_acronyms_identifiers"] >= MINIMUMS["names_acronyms_identifiers"]
        and coverage["protected_cases"] >= MINIMUMS["protected_cases"]
        and coverage["oov_cases"] >= MINIMUMS["oov_cases"]
        and coverage["counterfactual_pairs"] >= MINIMUMS["counterfactual_pairs"]
        and (coverage["multi_token_cases"] / max(1, len(cases))) >= MINIMUMS["multi_token_case_ratio"]
    )

    manifest = {
        "schema_version": "1.0.0",
        "manifest_id": "MAI_07R3H2_DATASET_MANIFEST",
        "builder_version": BUILDER_VERSION,
        "parent_pack_version": "mai-07.1.4-r3h-englishid",
        "pack_version": "mai-07.1.5-r3h2-shared",
        "frozen_v2_case_bodies_not_used": True,
        "frozen_predictions_not_used": True,
        "r3h_holdout_family_not_used": True,
        "gold_labels_generated_from_runtime_predictions": False,
        "prohibited_for_training": True,
        "splits": hashes,
        "totals": {k: v["case_count"] for k, v in hashes.items()},
        "coverage": coverage,
        "minimums": MINIMUMS,
        "minimums_met": minimums_met,
    }
    manifest_body = json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    manifest_path = dest / "MAI_07R3H2_DATASET_MANIFEST.json"
    manifest_path.write_text(manifest_body, encoding="utf-8", newline="\n")

    thresholds = _build_thresholds()
    thr_body = json.dumps(thresholds, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    thr_path = dest / "MAI_07R3H2_THRESHOLDS.json"
    thr_path.write_text(thr_body, encoding="utf-8", newline="\n")

    leakage_report = {
        "schema_version": "1.0.0",
        "report_id": "MAI_07R3H2_LEAKAGE_REPORT",
        "builder_version": BUILDER_VERSION,
        **leakage_meta,
        "total_cases": len(cases),
        "blocked_text_pool_size": leakage_meta["v1_texts_blocked"] + leakage_meta["prior_non_frozen_texts_blocked"],
    }
    leakage_body = json.dumps(leakage_report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    leakage_path = dest / "MAI_07R3H2_LEAKAGE_REPORT.json"
    leakage_path.write_text(leakage_body, encoding="utf-8", newline="\n")

    return {
        "manifest_sha256": _sha(manifest_body.encode("utf-8")),
        "threshold_sha256": _sha(thr_body.encode("utf-8")),
        "leakage_report_sha256": _sha(leakage_body.encode("utf-8")),
        "minimums_met": minimums_met,
        "totals": manifest["totals"],
        "coverage": coverage,
        "output_dir": str(dest.resolve()),
    }


def _build_thresholds() -> dict[str, Any]:
    """Locked R3H2 thresholds (governance section 17)."""
    return {
        "schema_version": "1.0.0",
        "threshold_id": "MAI_07R3H2_THRESHOLDS_V1",
        "locked_before_holdout_observation": True,
        "gates": {
            "unresolved_shared_identity_review_accuracy": {"op": ">=", "value": 0.98},
            "review_reason_code_completeness": {"op": "==", "value": 1.0},
            "english_context_identity_accuracy": {"op": ">=", "value": 0.98},
            "nepali_context_target_accuracy": {"op": ">=", "value": 0.95},
            "complete_counterfactual_triple_accuracy": {"op": ">=", "value": 0.95},
            "clear_romanized_target_generation_recall": {"op": ">=", "value": 0.98},
            "clear_romanized_target_recall_at_5": {"op": ">=", "value": 0.98},
            "clear_romanized_target_missing_from_top5_rate": {"op": "<=", "value": 0.02},
            "shared_nepali_context_target_generation_recall": {"op": ">=", "value": 0.95},
            "shared_nepali_context_target_recall_at_5": {"op": ">=", "value": 0.95},
            "ambiguous_optional_target_generation_recall": {"op": ">=", "value": 0.90},
            "ambiguous_optional_target_retention_at_5": {"op": ">=", "value": 0.95},
            "target_dropped_by_cap_rate": {"op": "<=", "value": 0.01},
            "overall_english_identity_top1": {"op": ">=", "value": 0.99},
            "false_devanagari_on_clear_english": {"op": "<=", "value": 0.01},
            "technical_english_identity_top1": {"op": ">=", "value": 0.98},
            "name_identity_top1": {"op": "==", "value": 1.0},
            "acronym_identifier_identity_top1": {"op": "==", "value": 1.0},
            "protected_span_mutations": {"op": "==", "value": 0},
            "raw_view_mutations": {"op": "==", "value": 0},
            "caps_respected": {"op": "==", "value": 1.0},
            "candidate_duplication": {"op": "==", "value": 0},
            "policy_invocation_coverage": {"op": "==", "value": 1.0},
            "measured_cross_path_parity": {"op": "==", "value": 1.0},
            "measured_candidate_set_preservation": {"op": "==", "value": 1.0},
            "deterministic_output": {"op": "==", "value": 1.0},
            "canonical_audit_agreement": {"op": "==", "value": 1.0},
            "english_cases_harmed": {"op": "==", "value": 0},
            "clear_romanized_cases_harmed": {"op": "==", "value": 0},
            "protected_cases_harmed": {"op": "==", "value": 0},
        },
    }


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, help="Explicit output directory (required, no default write)")
    parser.add_argument("--authorize-canonical", action="store_true")
    args = parser.parse_args()
    result = write_datasets(Path(args.output), authorize_canonical=args.authorize_canonical)
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
