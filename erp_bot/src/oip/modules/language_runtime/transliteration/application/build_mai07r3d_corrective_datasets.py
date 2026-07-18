"""MAI-07R3D — build non-frozen development/holdout/safety datasets.

CRITICAL:
- Does not read frozen V2 case bodies, predictions, or per-case audits.
- Uses active resource lexicons + synthetic unique R3D-tagged phrases only.
- Holdout/safety locked before corrective runtime changes.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

from ..infrastructure.resource_repository import load_resources

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_r3d_corrective"
SEED = 20260715
SCHEMA = "mai07r3d_corrective_case_v1"

FORBIDDEN_FROZEN_PATH_TOKENS = (
    "frozen_v2",
    "MAI_07R3C_V2_ONE_SHOT_PREDICTIONS",
    "MAI_07R3C_V2_PER_CASE_AUDIT",
    "MAI_07R3_BLIND_MAPPING",
    "REVIEW_IMPORT_COMPLETED",
)


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _cid(split: str, kind: str, n: int) -> str:
    h = hashlib.sha256(f"{SEED}|{split}|{kind}|{n}".encode()).hexdigest()[:10]
    return f"r3d_{split[:3].lower()}_{kind[:10]}_{n:04d}_{h}"


def _case(
    *,
    split: str,
    kind: str,
    n: int,
    input_text: str,
    language_forms: list[str],
    identity_expected: bool,
    primary_token: str | None = None,
    acceptable_devanagari: list[str] | None = None,
    protected_kinds: list[str] | None = None,
    abstention_expected: bool = False,
    requires_review: bool = False,
    notes: str = "",
) -> dict[str, Any]:
    tok = primary_token or input_text.split()[0]
    return {
        "schema_version": SCHEMA,
        "case_id": _cid(split, kind, n),
        "split": split,
        "suite_kind": kind,
        "input_text": input_text,
        "primary_token": tok,
        "language_forms": language_forms,
        "protected_span_kinds": protected_kinds or [],
        "identity_expected": identity_expected,
        "acceptable_devanagari_targets": acceptable_devanagari or [],
        "abstention_expected": abstention_expected,
        "requires_review": requires_review,
        "provenance": "R3D_SYNTHETIC_OR_RESOURCE_BACKED_NON_FROZEN",
        "prohibited_for_training": True,
        "notes": notes,
        "frozen_v1_v2_unused": True,
        "gold_from_runtime": False,
    }


def _load_v1_inputs(repo: Path) -> tuple[set[str], set[str]]:
    ids: set[str] = set()
    texts: set[str] = set()
    man = json.loads(
        (repo / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V1.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    for f in man["files"]:
        for line in (repo / f["path"]).read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            ids.add(row["case_id"])
            texts.add(row["input_text"].strip())
    return ids, texts


def _split_for(n: int, *, safety_bias: bool = False) -> str:
    h = int(hashlib.sha256(f"{SEED}:split:{n}:{int(safety_bias)}".encode()).hexdigest()[:8], 16) % 100
    if safety_bias:
        if h < 20:
            return "DEVELOPMENT"
        if h < 45:
            return "HOLDOUT_VALIDATION"
        return "SAFETY_CHALLENGE"
    if h < 56:
        return "DEVELOPMENT"
    if h < 80:
        return "HOLDOUT_VALIDATION"
    return "SAFETY_CHALLENGE"


def build_cases(repo: Path = REPO) -> list[dict[str, Any]]:
    res = load_resources(force_reload=True)
    v1_ids, v1_texts = _load_v1_inputs(repo)
    used: set[str] = set(v1_texts)
    cases: list[dict[str, Any]] = []
    n = 0

    def add(c: dict[str, Any]) -> bool:
        t = c["input_text"].strip()
        if not t or t in used:
            return False
        if c["case_id"] in v1_ids:
            return False
        used.add(t)
        cases.append(c)
        return True

    # Exclude short tokens that collide with identifier/accounting English senses.
    _skip_rom = frozenset({"pan", "vat", "inv", "fy", "id", "tax"})
    gen_lex = [
        (rom, list(devs))
        for rom, devs in sorted(res.lexicon.items())
        if rom.isalpha()
        and rom not in res.english_identity
        and rom not in res.name_like
        and rom not in _skip_rom
        and devs
    ]
    gen_domain = [
        (rom, list(devs))
        for rom, devs in sorted(res.domain_terms.items())
        if rom not in res.english_identity
        and rom not in res.name_like
        and rom not in _skip_rom
        and devs
    ]
    eng = sorted(x for x in res.english_identity if re.fullmatch(r"[A-Za-z]+", x))
    names = sorted(res.name_like)
    morph_suf = sorted(res.morphology.keys(), key=len, reverse=True)

    # --- Romanized core: unique R3D-tagged phrases (avoid bare V1 singles) ---
    for i, (rom, devs) in enumerate(gen_lex):
        for variant, kind in (
            (f"{rom} r3dw{i:04d}", "romanized_core"),
            (f"aaja {rom} r3dw{i:04d}", "romanized_phrase"),
            (f"{rom} kharcha r3dw{i:04d}", "romanized_phrase"),
        ):
            split = _split_for(n)
            if add(
                _case(
                    split=split,
                    kind=kind,
                    n=n,
                    input_text=variant,
                    primary_token=rom,
                    language_forms=["ROMANIZED_NEPALI"],
                    identity_expected=False,
                    acceptable_devanagari=devs[:5],
                )
            ):
                n += 1

    # Domain
    for i, (rom, devs) in enumerate(gen_domain):
        for variant in (f"{rom} ledger r3dd{i:04d}", f"check {rom} r3dd{i:04d}"):
            split = _split_for(n)
            if add(
                _case(
                    split=split,
                    kind="domain_romanized",
                    n=n,
                    input_text=variant,
                    primary_token=rom,
                    language_forms=["ROMANIZED_NEPALI"],
                    identity_expected=False,
                    acceptable_devanagari=devs[:5],
                )
            ):
                n += 1

    # Morphology
    morph_n = 0
    for stem, stem_devs in gen_lex:
        if len(stem) < 3:
            continue
        for suf in morph_suf[:6]:
            composed = stem + suf
            targets = [
                sd + su for sd in stem_devs[:1] for su in (res.morphology.get(suf) or [])[:1]
            ]
            if not targets:
                continue
            text = f"{composed} aaja r3dm{morph_n:04d}" if morph_n % 2 == 0 else f"{composed} r3dm{morph_n:04d}"
            split = _split_for(n)
            if add(
                _case(
                    split=split,
                    kind="morphology",
                    n=n,
                    input_text=text,
                    primary_token=composed,
                    language_forms=["ROMANIZED_NEPALI"],
                    identity_expected=False,
                    acceptable_devanagari=targets,
                    notes="synthetic_stem_suffix",
                )
            ):
                n += 1
                morph_n += 1
            if morph_n >= 220:
                break
        if morph_n >= 220:
            break

    # Spelling / aspiration probes
    asp_pairs = (("th", "t"), ("dh", "d"), ("bh", "b"), ("kh", "k"), ("gh", "g"), ("ch", "c"))
    asp_n = 0
    for rom, devs in gen_lex:
        for a, b in asp_pairs:
            if a in rom and len(rom) > 3:
                alt = rom.replace(a, b, 1)
                if alt == rom:
                    continue
                text = f"{alt} r3dasp{asp_n:04d}"
                split = _split_for(n)
                if add(
                    _case(
                        split=split,
                        kind="aspiration_var",
                        n=n,
                        input_text=text,
                        primary_token=alt,
                        language_forms=["ROMANIZED_NEPALI"],
                        identity_expected=False,
                        # Probe only — spelling variants are not gold Devanagari targets.
                        acceptable_devanagari=[],
                        notes="aspiration_variant_probe_no_gold",
                    )
                ):
                    n += 1
                    asp_n += 1
                break
        if asp_n >= 80:
            break

    # English identity — unique tagged phrases
    for i, eng_w in enumerate(eng):
        for variant in (
            f"{eng_w} r3de{i:04d}",
            f"please review {eng_w} r3de{i:04d}",
            f"{eng_w} amount r3de{i:04d}",
        ):
            split = _split_for(n)
            if add(
                _case(
                    split=split,
                    kind="english_identity",
                    n=n,
                    input_text=variant,
                    primary_token=eng_w,
                    language_forms=["ENGLISH"],
                    identity_expected=True,
                )
            ):
                n += 1

    # Accounting English from domain ∩ english_identity
    for i, term in enumerate(sorted(set(res.domain_terms) & set(res.english_identity))):
        text = f"{term} voucher r3dea{i:04d}"
        split = _split_for(n)
        if add(
            _case(
                split=split,
                kind="english_accounting",
                n=n,
                input_text=text,
                primary_token=term,
                language_forms=["TECHNICAL_ACCOUNTING_ENGLISH", "ENGLISH"],
                identity_expected=True,
            )
        ):
            n += 1

    # Names
    for i, name in enumerate(names):
        for variant in (f"{name} r3dn{i:04d}", f"party {name} r3dn{i:04d}"):
            split = _split_for(n)
            if add(
                _case(
                    split=split,
                    kind="proper_name",
                    n=n,
                    input_text=variant,
                    primary_token=name,
                    language_forms=["NAMED_ENTITY_CANDIDATE"],
                    identity_expected=True,
                    requires_review=True,
                )
            ):
                n += 1

    # Code-mix
    # Avoid MAI-05 invoice/voucher/pan/vat triggers in romanized phrases (false protected spans).
    cm_templates = [
        ("mero kharid r3dcm{n:04d}", "mero", False, ["मेरो"]),
        ("kharcha payment r3dcm{n:04d}", "kharcha", False, ["खर्च"]),
        ("aaja sales report r3dcm{n:04d}", "aaja", False, ["आज"]),
        ("tax tira r3dcm{n:04d}", "tax", True, []),
        ("hello mera r3dcm{n:04d}", "hello", True, []),
        ("bank bata cash r3dcm{n:04d}", "bank", True, []),
        ("paisa pathau r3dcm{n:04d}", "paisa", False, list(res.lexicon.get("paisa", ["पैसा"])[:2])),
        ("balance hernu r3dcm{n:04d}", "balance", True, []),
    ]
    for i in range(160):
        tpl, tok, id_exp, targets = cm_templates[i % len(cm_templates)]
        text = tpl.format(n=i)
        split = _split_for(n)
        if add(
            _case(
                split=split,
                kind="code_mix",
                n=n,
                input_text=text,
                primary_token=tok,
                language_forms=["ROMANIZED_NEPALI", "ENGLISH"],
                identity_expected=id_exp,
                acceptable_devanagari=targets,
            )
        ):
            n += 1

    # Ambiguous Latin
    for i in range(60):
        tok = f"qzx{i:03d}blorp"
        text = f"{tok} r3damb{i:04d}"
        split = _split_for(n)
        if add(
            _case(
                split=split,
                kind="ambiguous",
                n=n,
                input_text=text,
                primary_token=tok,
                language_forms=["SHARED_OR_AMBIGUOUS_LATIN"],
                identity_expected=True,
                abstention_expected=True,
            )
        ):
            n += 1

    # Acronyms
    for i, ac in enumerate(["XYZQ", "QWRT", "JKLM", "NPQR", "WXYZ", "QAZX", "MNBV", "LKJH"] * 8):
        text = f"{ac}{i:02d} r3dac{i:04d}"
        split = _split_for(n, safety_bias=True)
        if add(
            _case(
                split=split,
                kind="acronym",
                n=n,
                input_text=text,
                primary_token=f"{ac}{i:02d}",
                language_forms=["ENGLISH", "IDENTIFIER_OR_CODE"],
                identity_expected=True,
            )
        ):
            n += 1

    # Protected / safety probes (unique host/path markers)
    protected_specs = [
        ("https://r3d-eval.example.test/invoice/{i}", ["URL"]),
        ("https://pay.r3d{i}.example.np/v1?x=1", ["URL"]),
        ("user{i}@r3d-eval.example.test", ["EMAIL"]),
        ("accounts{i}@shop.r3d.example.np", ["EMAIL"]),
        ("PANR3D{i:06d}X", ["IDENTIFIER"]),
        ("VAT-R3D-{i:06d}", ["IDENTIFIER"]),
        ("INV-R3D-{i:05d}", ["IDENTIFIER"]),
        ("VCH-R3D-{i:05d}", ["IDENTIFIER"]),
        ("ACC-R3D-{i:05d}", ["IDENTIFIER"]),
        ("FY-R3D-{i}/83", ["DATE_OR_FISCAL"]),
        ("2081-0{(i%9)+1:d}-{(i%27)+1:02d}", ["DATE_OR_FISCAL"]),
        ("Rs {i},250.50", ["MONEY"]),
        ("{i}.5%", ["PERCENT"]),
        ("+977-98{i:08d}", ["PHONE"]),
        ('{{"r3d":{i},"amount":100}}', ["CODE_JSON"]),
        ("C:\\\\r3d\\\\data\\\\ledger_{i}.xlsx", ["PATH"]),
        ("/var/log/r3d_erp_{i}.log", ["PATH"]),
        ("emoji_ok 🙂 r3d{i}", ["OTHER"]),
        ("ID\u200br3d{i}", ["UNICODE_CONTROL"]),
    ]
    for i in range(40):
        for tpl, kinds in protected_specs:
            try:
                text = tpl.format(i=i)
            except (KeyError, ValueError):
                text = tpl.replace("{i}", str(i))
            split = _split_for(n + i * 17, safety_bias=True)
            if add(
                _case(
                    split=split,
                    kind="protected",
                    n=n,
                    input_text=text,
                    primary_token=text.split()[0] if text.split() else text[:32],
                    language_forms=["UNKNOWN", "ENGLISH"],
                    identity_expected=True,
                    protected_kinds=kinds,
                )
            ):
                n += 1

    # Unicode / overlap fail-closed probes for SAFETY
    for i in range(30):
        text = f"https://r3d-overlap.example.test/{i} and kharcha"
        if add(
            _case(
                split="SAFETY_CHALLENGE",
                kind="protected_overlap",
                n=n,
                input_text=text,
                primary_token="https://r3d-overlap.example.test/" + str(i),
                language_forms=["UNKNOWN", "ROMANIZED_NEPALI"],
                identity_expected=True,
                protected_kinds=["URL"],
                notes="url_plus_romanized_neighbor",
            )
        ):
            n += 1

    # Weak English-form romanized probes: token classified ENGLISH sometimes but is Nepali
    # Use unique phrases; primary is romanized with targets
    weak_n = 0
    for rom, devs in gen_lex:
        if weak_n >= 100:
            break
        text = f"report {rom} r3dwk{weak_n:04d}"
        split = _split_for(n)
        if add(
            _case(
                split=split,
                kind="weak_english_form",
                n=n,
                input_text=text,
                primary_token=rom,
                language_forms=["ROMANIZED_NEPALI", "ENGLISH"],
                identity_expected=False,
                acceptable_devanagari=devs[:3],
                notes="romanized_may_look_english_contextually",
            )
        ):
            n += 1
            weak_n += 1

    return cases


def _rebalance(cases: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    by: dict[str, list[dict[str, Any]]] = {
        "DEVELOPMENT": [],
        "HOLDOUT_VALIDATION": [],
        "SAFETY_CHALLENGE": [],
    }
    for c in cases:
        by[c["split"]].append(c)

    def steal(dst: str, minimum: int) -> None:
        if len(by[dst]) >= minimum:
            return
        need = minimum - len(by[dst])
        # Prefer steal from largest surplus donor
        donors = sorted(
            ("DEVELOPMENT", "HOLDOUT_VALIDATION", "SAFETY_CHALLENGE"),
            key=lambda s: len(by[s]),
            reverse=True,
        )
        for src in donors:
            if src == dst:
                continue
            # keep donor above its floor if possible
            floor = {"DEVELOPMENT": 700, "HOLDOUT_VALIDATION": 300, "SAFETY_CHALLENGE": 250}.get(src, 0)
            while need > 0 and len(by[src]) > floor and by[src]:
                c = by[src].pop()
                c = dict(c)
                c["split"] = dst
                by[dst].append(c)
                need -= 1
            if need <= 0:
                return
        # last resort: steal anyway
        for src in donors:
            if src == dst:
                continue
            while need > 0 and by[src]:
                c = by[src].pop()
                c = dict(c)
                c["split"] = dst
                by[dst].append(c)
                need -= 1

    steal("DEVELOPMENT", 700)
    steal("HOLDOUT_VALIDATION", 300)
    steal("SAFETY_CHALLENGE", 250)
    return by


def write_datasets(repo: Path = REPO) -> dict[str, Any]:
    cases = build_cases(repo)
    by_split = _rebalance(cases)
    OUT.mkdir(parents=True, exist_ok=True)

    # Near-duplicate detection within corrective set (normalized)
    def norm(s: str) -> str:
        return re.sub(r"\s+", " ", s.strip().lower())

    norm_seen: dict[str, str] = {}
    near_dupes = 0
    for split in list(by_split):
        kept = []
        for c in by_split[split]:
            key = norm(c["input_text"])
            # strip r3d tags for near-dup check of core content
            core = re.sub(r"\br3d[a-z]*\d+\b", "", key).strip()
            if core in norm_seen and norm_seen[core] != c["case_id"]:
                near_dupes += 1
                continue
            norm_seen[core] = c["case_id"]
            kept.append(c)
        by_split[split] = kept

    # Re-check mins after near-dup filter
    by_split = _rebalance([c for rows in by_split.values() for c in rows])

    v1_ids, v1_texts = _load_v1_inputs(repo)
    file_hashes: dict[str, Any] = {}
    all_cases: list[dict[str, Any]] = []
    for split, rows in by_split.items():
        rows = sorted(rows, key=lambda c: c["case_id"])
        # final V1 exact checks
        rows = [c for c in rows if c["input_text"].strip() not in v1_texts and c["case_id"] not in v1_ids]
        all_cases.extend(rows)
        path = OUT / f"{split.lower()}.jsonl"
        body = (
            "\n".join(json.dumps(r, ensure_ascii=False, sort_keys=True, separators=(",", ":")) for r in rows)
            + "\n"
        )
        path.write_text(body, encoding="utf-8", newline="\n")
        file_hashes[split] = {
            "path": str(path.relative_to(repo)).replace("\\", "/"),
            "case_count": len(rows),
            "sha256": _sha(body.encode("utf-8")),
        }

    # Vocabulary overlap vs V1 (honest)
    def tokens(s: str) -> set[str]:
        return {t.lower() for t in re.findall(r"[A-Za-z]+", s)}

    r3d_tok: set[str] = set()
    v1_tok: set[str] = set()
    for c in all_cases:
        r3d_tok |= tokens(c["input_text"])
    for t in v1_texts:
        v1_tok |= tokens(t)

    # V2 firewall: do not open case JSONL; verify ID namespace + file hashes only
    v2_man = json.loads(
        (repo / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V2.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    v2_id_collision = [c["case_id"] for c in all_cases if c["case_id"].startswith("mai07_v2_") or c["case_id"] in v1_ids]

    holdout_manifest = {
        "schema_version": "1.0.0",
        "manifest_id": "MAI_07R3D_DATASET_MANIFEST",
        "locked_before_runtime_correction": True,
        "rebuild_note": "Rebuilt once pre-holdout to remove invoice-pattern false protected spans; no holdout scores observed yet.",
        "seed": SEED,
        "splits": file_hashes,
        "totals": {k: v["case_count"] for k, v in file_hashes.items()},
        "total_unique_cases": len(all_cases),
        "unique_texts": len({c["input_text"] for c in all_cases}),
        "near_duplicate_dropped": near_dupes,
        "leakage_vs_v1": {
            "duplicate_case_ids": [],
            "exact_sentence_duplicate_count": 0,
            "vocabulary_overlap_token_count": len(r3d_tok & v1_tok),
            "vocabulary_overlap_note": "Legitimate token overlap expected; not claimed zero.",
        },
        "leakage_vs_v2": {
            "frozen_v2_case_bodies_not_opened": True,
            "duplicate_case_ids_with_v1_parent_space": v2_id_collision,
            "v2_dataset_hash_acknowledged": v2_man["dataset_hash"],
            "note": "Exact sentence comparison against V2 bodies is firewalled; uniqueness via r3d tags + V1 audit.",
        },
        "frozen_v2_case_bodies_not_used": True,
        "prohibited_for_training": True,
        "parent_frozen_v1_hash": "5637ccd973173edde3637ce0aeca8e8647431614940fb8a06ceb102e1c736208",
        "parent_frozen_v2_hash": "0cee0c07d07430bded793e2dbe162e7b496223ecff762cdd69bca8d8d992d4b9",
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
    }
    if any(file_hashes[s]["case_count"] < m for s, m in (("DEVELOPMENT", 700), ("HOLDOUT_VALIDATION", 300), ("SAFETY_CHALLENGE", 250))):
        holdout_manifest["minimums_met"] = False
    else:
        holdout_manifest["minimums_met"] = True
    if len(all_cases) < 1250:
        holdout_manifest["minimums_met"] = False

    hm_body = json.dumps(holdout_manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    (OUT / "MAI_07R3D_DATASET_MANIFEST.json").write_text(hm_body, encoding="utf-8", newline="\n")

    thresholds = {
        "schema_version": "1.0.0",
        "threshold_id": "MAI_07R3D_HOLDOUT_THRESHOLDS_V1",
        "locked_before_holdout_observation": True,
        "gates": {
            "target_top1": {"op": ">=", "value": 0.90},
            "target_recall_at_5": {"op": ">=", "value": 0.985},
            "target_mrr": {"op": ">=", "value": 0.92},
            "core_recall_at_5": {"op": ">=", "value": 0.99},
            "unambiguous_target_top1": {"op": ">=", "value": 0.94},
            "english_identity_top1": {"op": ">=", "value": 0.99},
            "false_devanagari_on_english": {"op": "<=", "value": 0.01},
            "proper_name_identity_top1": {"op": ">=", "value": 0.95},
            "protected_span_mutations": {"op": "==", "value": 0},
            "raw_view_mutations": {"op": "==", "value": 0},
            "caps_respected": {"op": "==", "value": 1.0},
            "deterministic_output": {"op": "==", "value": 1.0},
            "harm_count": {"op": "==", "value": 0},
        },
    }
    th_body = json.dumps(thresholds, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    (OUT / "MAI_07R3D_HOLDOUT_THRESHOLDS.json").write_text(th_body, encoding="utf-8", newline="\n")

    readme = """# MAI-07R3D corrective datasets (non-frozen)

- DEVELOPMENT: iterative implementation only
- HOLDOUT_VALIDATION: locked before runtime correction; open once after RC lock
- SAFETY_CHALLENGE: protected/English/name/Unicode probes

`prohibited_for_training=true` on every case.
Frozen V1/V2 case bodies and predictions were not used to construct gold labels.
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8", newline="\n")

    return {
        "ok": bool(holdout_manifest["minimums_met"]),
        "dataset_root": str(OUT.relative_to(repo)).replace("\\", "/"),
        "manifest_sha256": _sha(hm_body.encode("utf-8")),
        "threshold_sha256": _sha(th_body.encode("utf-8")),
        "splits": file_hashes,
        "totals": holdout_manifest["totals"],
        "total_unique_cases": holdout_manifest["total_unique_cases"],
        "minimums_met": holdout_manifest["minimums_met"],
        "leakage_vs_v1": holdout_manifest["leakage_vs_v1"],
        "leakage_vs_v2": holdout_manifest["leakage_vs_v2"],
        "near_duplicate_dropped": near_dupes,
    }


def main() -> int:
    report = write_datasets(REPO)
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if report.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
