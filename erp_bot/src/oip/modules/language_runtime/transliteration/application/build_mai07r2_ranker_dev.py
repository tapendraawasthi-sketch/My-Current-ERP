"""Build MAI-07R2 non-frozen ranker development datasets (overlay eval firewall)."""

from __future__ import annotations

import hashlib
import json
import random
from pathlib import Path
from typing import Any

from ...application.language_analyzer import analyze_language
from .. import MAX_CANDIDATES_PER_SPAN
from ..infrastructure.deterministic_generator import DeterministicCandidateGenerator
from ..infrastructure.deterministic_ranker import DeterministicCandidateRanker
from ..infrastructure.resource_repository import CompactXlResources, load_resources
from .eval_c2_helpers import extract_primary_produced
from .eval_scoring import score_target_case
from .transliteration_service import attach_transliteration_to_frame

REPO = Path(__file__).resolve().parents[7]
DEV_ROOT = REPO / "evals" / "mai07_ranker_r2"
SEED = 20260716


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _write_jsonl(path: Path, rows: list[dict[str, Any]]) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    ordered = sorted(rows, key=lambda r: r["case_id"])
    text = "\n".join(json.dumps(r, ensure_ascii=False, sort_keys=True) for r in ordered) + "\n"
    path.write_text(text, encoding="utf-8")
    return _sha256_bytes(text.encode("utf-8"))


def _case(**kwargs: Any) -> dict[str, Any]:
    base = {
        "prohibited_for_training": True,
        "linguist_approved": False,
        "allowed_use": "deterministic_ranker_overlay_development_only",
        "synthetic": True,
        "identity_first_target_behind_base": False,
    }
    base.update(kwargs)
    return base


def _has_devanagari(text: str) -> bool:
    return any("\u0900" <= ch <= "\u097F" for ch in text)


def load_frozen_inputs(repo: Path) -> set[str]:
    frozen: set[str] = set()
    for phase in ("mai04", "mai05", "mai06", "mai07"):
        man_dir = repo / "evals" / phase / "manifests"
        if not man_dir.exists():
            continue
        for man_path in man_dir.glob("*.manifest.json"):
            man = json.loads(man_path.read_text(encoding="utf-8"))
            for f in man.get("files", []):
                path = repo / f["path"]
                if not path.exists():
                    continue
                for line in path.read_text(encoding="utf-8").splitlines():
                    if not line.strip():
                        continue
                    row = json.loads(line)
                    text = row.get("input_text") or row.get("raw_text") or row.get("text")
                    if text:
                        frozen.add(str(text))
    return frozen


def _neighbors(frame, idx: int) -> tuple[str, ...]:
    tokens = [s.original_text for s in frame.span_annotations]
    left = right = None
    for j in range(idx - 1, -1, -1):
        if tokens[j].strip():
            left = tokens[j]
            break
    for j in range(idx + 1, len(tokens)):
        if tokens[j].strip():
            right = tokens[j]
            break
    return tuple(x for x in (left, right) if x is not None)


def base_rank_primary_span(
    input_text: str,
    *,
    resources: CompactXlResources | None = None,
    use_context: bool = True,
) -> tuple[list[Any], str, str | None]:
    """Rank first content span with DeterministicCandidateRanker only (no overlay)."""
    res = resources or load_resources(force_reload=True)
    gen = DeterministicCandidateGenerator(res)
    ranker = DeterministicCandidateRanker(res)
    frame = analyze_language(input_text)
    for idx, ann in enumerate(frame.span_annotations):
        surface = ann.original_text
        if not surface.strip():
            continue
        form = ann.language_form
        prefer_identity = surface.lower() in res.english_identity
        name_like = surface.lower() in res.name_like
        generated = gen.generate(
            surface,
            language_form=form,
            neighbors=_neighbors(frame, idx),
            use_context=use_context,
            name_like=name_like,
        )
        ranked = ranker.rank(
            generated,
            surface=surface,
            language_form=form,
            neighbors=_neighbors(frame, idx),
            use_context=use_context,
            prefer_identity=prefer_identity,
            name_like=name_like,
            max_candidates=MAX_CANDIDATES_PER_SPAN,
        )
        return ranked, surface, None
    return [], "", "empty_candidate_list"


def identity_first_target_behind_base(
    input_text: str,
    acceptable: list[str],
    *,
    resources: CompactXlResources | None = None,
) -> bool:
    ranked, _src, err = base_rank_primary_span(input_text, resources=resources)
    if err or not ranked or not ranked[0].is_identity:
        return False
    dev_acc = {t for t in acceptable if _has_devanagari(t)}
    if not dev_acc:
        return False
    for i, cand in enumerate(ranked[:5], start=1):
        if i == 1:
            continue
        if not cand.is_identity and cand.surface in dev_acc:
            return True
    return False


def dry_run_target_score(
    input_text: str,
    acceptable: list[str],
    *,
    cache: dict[tuple[str, tuple[str, ...]], tuple[bool, bool]] | None = None,
) -> tuple[bool, bool]:
    key = (input_text, tuple(acceptable))
    if cache is not None and key in cache:
        return cache[key]
    frame = analyze_language(input_text)
    updated = attach_transliteration_to_frame(frame, use_context=True)
    bundle = updated.transliteration_bundle
    if bundle is None:
        out = (False, False)
    else:
        produced, source_surface, err = extract_primary_produced(bundle)
        if not produced:
            out = (False, False)
        else:
            first_token = input_text.split()[0] if input_text.strip() else input_text
            src = source_surface.strip() if source_surface and source_surface.strip() else first_token
            if " " in input_text.strip() and src != first_token:
                src = first_token
            scored = score_target_case(
                case_id="__dry_run__",
                produced=produced,
                acceptable_target_candidates=acceptable,
                source_surface=src,
                preferred_target=acceptable[0] if acceptable else None,
                structural_error=err,
            )
            out = (scored.first_target_rank is not None, scored.top1_hit)
    if cache is not None:
        cache[key] = out
    return out


def leakage_audit(repo: Path, cases: list[dict[str, Any]]) -> dict[str, Any]:
    frozen_inputs = load_frozen_inputs(repo)
    exact = [c["case_id"] for c in cases if c["input_text"] in frozen_inputs]
    near: list[str] = []
    for c in cases:
        text = c["input_text"]
        if " " not in text.strip():
            continue
        for f in frozen_inputs:
            if " " not in f:
                continue
            a = set(text.lower().split())
            b = set(f.lower().split())
            if len(a) >= 3 and len(b) >= 3 and a == b and text != f:
                near.append(c["case_id"])
                break
    frozen_tokens: set[str] = set()
    for f in frozen_inputs:
        frozen_tokens.update(tok for tok in f.lower().split() if tok.isalpha())
    vocab = sorted(
        {
            tok
            for c in cases
            for tok in c["input_text"].lower().split()
            if tok in frozen_tokens and tok.isalpha()
        }
    )
    return {
        "ok": not exact and not near,
        "exact_full_input_duplicates": exact[:50],
        "exact_duplicate_count": len(exact),
        "near_duplicate_template_ids": near[:50],
        "near_duplicate_count": len(near),
        "legitimate_vocab_overlap_count": len(vocab),
        "legitimate_vocab_overlap_sample": vocab[:30],
    }


def _identity_first_pool(res: CompactXlResources) -> list[tuple[str, list[str], str]]:
    """Romanized stems where base ranker keeps identity@1 with Devanagari in ranks 2-5."""
    pool: list[tuple[str, list[str], str]] = []
    candidates = sorted(
        set(res.english_identity)
        | set(res.domain_terms.keys())
        | {k for k in res.lexicon if k.isalpha()}
    )
    for rom in candidates:
        if not rom.isalpha() or rom in res.name_like:
            continue
        devs = list(res.lexicon.get(rom, []))
        dev_targets = [d for d in devs if _has_devanagari(d)]
        if not dev_targets:
            continue
        ranked, _, err = base_rank_primary_span(rom, resources=res)
        if err or not ranked or not ranked[0].is_identity:
            continue
        hit = any(
            (not cand.is_identity) and cand.surface in dev_targets for cand in ranked[1:5]
        )
        if hit:
            pool.append((rom, dev_targets, "english_lexicon_identity_first"))
    return pool


def build_cases() -> dict[str, Any]:
    rng = random.Random(SEED)
    res = load_resources(force_reload=True)
    frozen = load_frozen_inputs(REPO)
    dry_cache: dict[tuple[str, tuple[str, ...]], tuple[bool, bool]] = {}
    id_first_cache: dict[tuple[str, tuple[str, ...]], bool] = {}
    lex_items = [(k, v) for k, v in sorted(res.lexicon.items()) if v]
    domain_items = [(k, v) for k, v in sorted(res.domain_terms.items()) if v]
    eng = sorted(res.english_identity)
    names = sorted(res.name_like)
    morph_suf = sorted(res.morphology.keys(), key=len, reverse=True)
    id_first_pool = _identity_first_pool(res)

    used_inputs: set[str] = set(frozen)
    buckets: dict[str, list[dict[str, Any]]] = {
        "DEVELOPMENT": [],
        "HOLDOUT_VALIDATION": [],
        "SAFETY_CHALLENGE": [],
    }

    def add(
        split: str,
        row: dict[str, Any],
        *,
        require_generable: bool = False,
        relabel_identity_first: bool = False,
    ) -> bool:
        text = row["input_text"]
        if text in used_inputs:
            return False
        targets = row.get("acceptable_target_candidates") or []
        if require_generable and targets:
            generable, _top1 = dry_run_target_score(text, list(targets), cache=dry_cache)
            if not generable:
                return False
        if relabel_identity_first and targets and split == "HOLDOUT_VALIDATION":
            row = dict(row)
            key = (text, tuple(targets))
            if key not in id_first_cache:
                id_first_cache[key] = identity_first_target_behind_base(
                    text, list(targets), resources=res
                )
            row["identity_first_target_behind_base"] = id_first_cache[key]
        used_inputs.add(text)
        buckets[split].append(row)
        return True

    gen_lex = [
        (rom, devs)
        for rom, devs in lex_items
        if rom not in res.english_identity
        and rom not in res.name_like
        and rom.isalpha()
    ]
    gen_domain = [
        (rom, devs)
        for rom, devs in domain_items
        if rom not in res.english_identity
        and rom not in res.name_like
    ]
    generable_phrase_pool = gen_lex

    idx = 0
    for rom, devs in gen_lex:
        split = "DEVELOPMENT" if idx % 4 else "HOLDOUT_VALIDATION"
        multi = idx % 3 == 0
        text = f"{rom} kharcha r2t{idx:04d}" if multi else rom
        add(
            split,
            _case(
                case_id=f"r2_{split[:3].lower()}_lex_{idx:04d}",
                split=split,
                input_text=text,
                acceptable_target_candidates=list(devs),
                preferred_target_candidate=devs[0],
                identity_expected_top1=False,
                category="strong_romanized_lexicon",
                notes="resource lexicon; multi-token when tagged",
            ),
            require_generable=False,
        )
        idx += 1

    for i, (rom, devs) in enumerate(gen_domain):
        split = "DEVELOPMENT" if i % 3 else "HOLDOUT_VALIDATION"
        text = f"{rom} ledger r2d{i:04d}" if i % 2 == 0 else rom
        add(
            split,
            _case(
                case_id=f"r2_{split[:3].lower()}_dom_{i:04d}",
                split=split,
                input_text=text,
                acceptable_target_candidates=list(devs),
                preferred_target_candidate=devs[0],
                identity_expected_top1=False,
                category="domain_romanized",
                notes="domain lexicon",
            ),
            require_generable=False,
        )

    morph_n = 0
    for stem, stem_devs in lex_items:
        if stem in res.english_identity or stem in res.name_like:
            continue
        for suf in morph_suf:
            if len(stem) < 3:
                continue
            composed = stem + suf
            targets = [sd + su for sd in stem_devs[:1] for su in res.morphology.get(suf, [])[:1]]
            if not targets:
                continue
            split = "DEVELOPMENT" if morph_n % 2 else "HOLDOUT_VALIDATION"
            text = f"{composed} aaja r2m{morph_n:04d}" if morph_n % 3 == 0 else composed
            if add(
                split,
                _case(
                    case_id=f"r2_{split[:3].lower()}_morph_{morph_n:04d}",
                    split=split,
                    input_text=text,
                    acceptable_target_candidates=targets,
                    preferred_target_candidate=targets[0],
                    identity_expected_top1=False,
                    category="morphology_compose",
                    notes="synthetic stem+suffix",
                ),
                require_generable=False,
            ):
                morph_n += 1
            if morph_n >= 180:
                break
        if morph_n >= 180:
            break

    code_mix_templates = [
        ("mero invoice r2cm{n:04d}", "mero", ["mero", "मेरो"]),
        ("kharcha payment r2cm{n:04d}", "kharcha", ["kharcha", "खर्च"]),
        ("aaja sales report r2cm{n:04d}", "aaja", ["aaja", "आज"]),
        ("bank bata cash r2cm{n:04d}", "bank", list(res.lexicon.get("bank", ["बैंक"]))),
        ("party lai paisa r2cm{n:04d}", "paisa", ["paisa", "पैसा"]),
    ]
    cm = 0
    while cm < 120:
        tpl, first, acc = code_mix_templates[cm % len(code_mix_templates)]
        text = tpl.format(n=cm)
        split = "DEVELOPMENT" if cm % 3 else "HOLDOUT_VALIDATION"
        if add(
            split,
            _case(
                case_id=f"r2_{split[:3].lower()}_codemix_{cm:04d}",
                split=split,
                input_text=text,
                acceptable_target_candidates=acc,
                preferred_target_candidate=acc[-1] if _has_devanagari(acc[-1]) else acc[0],
                identity_expected_top1=False,
                category="code_mix",
                notes="synthetic code-mix phrase; score first token",
            ),
            require_generable=False,
        ):
            cm += 1

    weak_n = 0
    while weak_n < 80:
        stem = "zx" + "".join(rng.choice("aeioubcdfghjklmnpqrstvwxyz") for _ in range(6 + (weak_n % 3)))
        weak_n += 1
        if stem in res.lexicon or stem in res.english_identity or stem in used_inputs:
            continue
        split = "DEVELOPMENT" if weak_n % 2 else "HOLDOUT_VALIDATION"
        text = f"{stem} r2wg{weak_n:04d}"
        add(
            split,
            _case(
                case_id=f"r2_{split[:3].lower()}_weak_{weak_n:04d}",
                split=split,
                input_text=text,
                acceptable_target_candidates=[],
                preferred_target_candidate=None,
                identity_expected_top1=True,
                category="weak_grapheme",
                notes="unknown Latin; identity or weak grapheme only",
            ),
        )

    holdout_id_first = 0
    for i, (rom, devs, cat_note) in enumerate(id_first_pool):
        split = "HOLDOUT_VALIDATION"
        for variant in (0, 1):
            text = rom if variant == 0 else f"{rom} r2id{i:04d}v{variant}"
            if add(
                split,
                _case(
                    case_id=f"r2_hol_idfirst_{i:04d}_v{variant}",
                    split=split,
                    input_text=text,
                    acceptable_target_candidates=list(devs),
                    preferred_target_candidate=devs[0],
                    identity_expected_top1=True,
                    category="identity_first_holdout",
                    notes=cat_note,
                ),
                relabel_identity_first=True,
            ):
                holdout_id_first += int(
                    buckets["HOLDOUT_VALIDATION"][-1].get("identity_first_target_behind_base", False)
                )

    pad_idx = 0
    while holdout_id_first < 100 and pad_idx < 500 and id_first_pool:
        rom, devs, _ = id_first_pool[pad_idx % len(id_first_pool)]
        pad_idx += 1
        text = f"{rom} r2idpad{pad_idx:04d}"
        if add(
            "HOLDOUT_VALIDATION",
            _case(
                case_id=f"r2_hol_idfirst_pad_{pad_idx:04d}",
                split="HOLDOUT_VALIDATION",
                input_text=text,
                acceptable_target_candidates=list(devs),
                preferred_target_candidate=devs[0],
                identity_expected_top1=True,
                category="identity_first_holdout",
                notes="padded identity-first holdout stratum",
            ),
            relabel_identity_first=True,
        ):
            if buckets["HOLDOUT_VALIDATION"][-1].get("identity_first_target_behind_base"):
                holdout_id_first += 1

    def pad(split: str, need: int, prefix: str) -> None:
        n = 0
        pool = generable_phrase_pool or gen_lex
        while len(buckets[split]) < need and n < 50000:
            n += 1
            rom, devs = pool[n % len(pool)]
            text = f"{rom} {prefix}{n:04d} kharcha"
            add(
                split,
                _case(
                    case_id=f"r2_{split[:3].lower()}_pad_{n:04d}",
                    split=split,
                    input_text=text,
                    acceptable_target_candidates=list(devs),
                    preferred_target_candidate=devs[0],
                    identity_expected_top1=False,
                    category="padding_tagged_phrase",
                    notes="unique multi-token synthetic phrase",
                ),
            )

    pad("DEVELOPMENT", 600, "devtag")
    pad("HOLDOUT_VALIDATION", 300, "holtag")

    for i, tok in enumerate(eng):
        add(
            "SAFETY_CHALLENGE",
            _case(
                case_id=f"r2_saf_eng_{i:04d}",
                split="SAFETY_CHALLENGE",
                input_text=tok,
                acceptable_target_candidates=[],
                preferred_target_candidate=None,
                identity_expected_top1=True,
                category="english_identity",
                notes="english identity",
            ),
        )
    for i, tok in enumerate(names):
        add(
            "SAFETY_CHALLENGE",
            _case(
                case_id=f"r2_saf_name_{i:04d}",
                split="SAFETY_CHALLENGE",
                input_text=tok,
                acceptable_target_candidates=list(res.lexicon.get(tok, [])),
                preferred_target_candidate=None,
                identity_expected_top1=True,
                category="name_like",
                notes="name-like",
            ),
        )
    for i, tok in enumerate(
        ["VAT", "PAN", "NRB", "IRD", "HSW", "SKU", "FIFO", "LIFO", "PDF", "CSV", "XML", "API", "SQL", "USD", "NPR"]
    ):
        add(
            "SAFETY_CHALLENGE",
            _case(
                case_id=f"r2_saf_acr_{i:04d}",
                split="SAFETY_CHALLENGE",
                input_text=tok,
                acceptable_target_candidates=[],
                preferred_target_candidate=None,
                identity_expected_top1=True,
                category="acronym",
                notes="acronym",
            ),
        )
    for i, tok in enumerate(
        [
            "invoice 12345",
            "pan ABCDE1234F",
            "email devnull@example.test",
            "https://example.test/path",
            "amount 100.50",
            "ref #99887766",
            "+1-555-0199",
            "GSTIN 22AAAAA0000A1Z5",
        ]
    ):
        add(
            "SAFETY_CHALLENGE",
            _case(
                case_id=f"r2_saf_prot_{i:04d}",
                split="SAFETY_CHALLENGE",
                input_text=tok,
                acceptable_target_candidates=[],
                preferred_target_candidate=None,
                identity_expected_top1=True,
                category="protected_or_identifier",
                notes="protected/id-like",
            ),
        )
    i = 0
    while len(buckets["SAFETY_CHALLENGE"]) < 200 and i < 800:
        tok = "zy" + "".join(rng.choice("aeioubcdfghjklmnpqrstvwxyz") for _ in range(6 + (i % 4)))
        i += 1
        if tok in res.lexicon or tok in res.english_identity:
            continue
        add(
            "SAFETY_CHALLENGE",
            _case(
                case_id=f"r2_saf_amb_{i:04d}",
                split="SAFETY_CHALLENGE",
                input_text=tok,
                acceptable_target_candidates=[],
                preferred_target_candidate=None,
                identity_expected_top1=True,
                category="ambiguous_or_unknown",
                notes="unknown Latin safety",
            ),
        )

    dev_hold = buckets["DEVELOPMENT"] + buckets["HOLDOUT_VALIDATION"]
    multi = sum(1 for c in dev_hold if " " in c["input_text"].strip())
    multi_pct = multi / len(dev_hold) if dev_hold else 0.0
    id_first_count = sum(
        1 for c in buckets["HOLDOUT_VALIDATION"] if c.get("identity_first_target_behind_base")
    )

    return {
        "buckets": buckets,
        "structure_stats": {
            "dev_holdout_multi_token_count": multi,
            "dev_holdout_multi_token_pct": round(multi_pct, 4),
            "holdout_identity_first_target_behind_base_count": id_first_count,
            "holdout_identity_first_target_behind_base_goal_met": id_first_count >= 100,
            "identity_first_pool_size": len(id_first_pool),
        },
    }


def main() -> None:
    built = build_cases()
    bundles = built["buckets"]
    stats = built["structure_stats"]

    assert len(bundles["DEVELOPMENT"]) >= 600, len(bundles["DEVELOPMENT"])
    assert len(bundles["HOLDOUT_VALIDATION"]) >= 300, len(bundles["HOLDOUT_VALIDATION"])
    assert len(bundles["SAFETY_CHALLENGE"]) >= 200, len(bundles["SAFETY_CHALLENGE"])
    assert stats["dev_holdout_multi_token_pct"] >= 0.70, stats

    paths = {
        "DEVELOPMENT": DEV_ROOT / "splits" / "development.jsonl",
        "HOLDOUT_VALIDATION": DEV_ROOT / "splits" / "holdout_validation.jsonl",
        "SAFETY_CHALLENGE": DEV_ROOT / "splits" / "safety_challenge.jsonl",
    }
    hashes = {split: _write_jsonl(path, bundles[split]) for split, path in paths.items()}
    all_cases = [c for rows in bundles.values() for c in rows]
    leak = leakage_audit(REPO, all_cases)
    assert leak["ok"], leak

    man = {
        "manifest_id": "MAI_07R2_RANKER_DEV_V1",
        "seed": SEED,
        "prohibited_for_training": True,
        "linguist_approved": False,
        "splits": {
            split: {
                "path": str(paths[split].relative_to(REPO)).replace("\\", "/"),
                "case_count": len(bundles[split]),
                "sha256": hashes[split],
            }
            for split in paths
        },
        "total_cases": len(all_cases),
        "structure_stats": stats,
        "leakage_audit": leak,
    }
    man_path = DEV_ROOT / "manifests" / "MAI_07R2_RANKER_DEV_V1.manifest.json"
    man_path.parent.mkdir(parents=True, exist_ok=True)
    man_path.write_text(json.dumps(man, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "ok": True,
                "counts": {k: len(v) for k, v in bundles.items()},
                "structure_stats": stats,
                "manifest": str(man_path.relative_to(REPO)).replace("\\", "/"),
                "split_hashes": hashes,
                "leakage": {
                    k: leak[k]
                    for k in (
                        "ok",
                        "exact_duplicate_count",
                        "near_duplicate_count",
                        "legitimate_vocab_overlap_count",
                    )
                },
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
