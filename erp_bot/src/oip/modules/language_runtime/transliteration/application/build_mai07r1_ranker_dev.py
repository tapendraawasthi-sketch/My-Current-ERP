"""Build MAI-07R1 non-frozen corrective ranker development datasets."""

from __future__ import annotations

import hashlib
import json
import random
from pathlib import Path
from typing import Any

from ...application.language_analyzer import analyze_language
from ..infrastructure.resource_repository import load_resources
from .eval_c2_helpers import extract_primary_produced
from .transliteration_service import attach_transliteration_to_frame

REPO = Path(__file__).resolve().parents[7]
DEV_ROOT = REPO / "evals" / "mai07_ranker_dev"
SEED = 20260715


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
        "allowed_use": "deterministic_ranker_development_only",
        "synthetic": True,
    }
    base.update(kwargs)
    return base


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


def dry_run_target_score(input_text: str, acceptable: list[str]) -> tuple[bool, bool]:
    """Return (generable, top1_hit) from pipeline dry-run on first content span."""
    frame = analyze_language(input_text)
    updated = attach_transliteration_to_frame(frame, use_context=True)
    bundle = updated.transliteration_bundle
    if bundle is None:
        return False, False
    produced, source_surface, err = extract_primary_produced(bundle)
    if not produced:
        return False, False
    first_token = input_text.split()[0] if input_text.strip() else input_text
    src = source_surface.strip() if source_surface and source_surface.strip() else first_token
    if " " in input_text.strip() and src != first_token:
        src = first_token
    from .eval_scoring import score_target_case

    scored = score_target_case(
        case_id="__dry_run__",
        produced=produced,
        acceptable_target_candidates=acceptable,
        source_surface=src,
        preferred_target=acceptable[0] if acceptable else None,
        structural_error=err,
    )
    generable = scored.first_target_rank is not None
    return generable, scored.top1_hit


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


def build_cases() -> dict[str, list[dict[str, Any]]]:
    rng = random.Random(SEED)
    res = load_resources(force_reload=True)
    frozen = load_frozen_inputs(REPO)
    lex_items = [(k, v) for k, v in sorted(res.lexicon.items()) if v]
    domain_items = [(k, v) for k, v in sorted(res.domain_terms.items()) if v]
    eng = sorted(res.english_identity)
    names = sorted(res.name_like)
    morph_suf = sorted(res.morphology.keys(), key=len, reverse=True)

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
    ) -> bool:
        text = row["input_text"]
        if text in used_inputs:
            return False
        targets = row.get("acceptable_target_candidates") or []
        if require_generable and targets:
            generable, _top1 = dry_run_target_score(text, list(targets))
            if not generable:
                return False
            # Do NOT require top1 at build time — that would circularly validate the ranker.
        used_inputs.add(text)
        buckets[split].append(row)
        return True

    # Generable romanized lexicon/domain entries excluding English identity and names.
    gen_lex = [
        (rom, devs)
        for rom, devs in lex_items
        if rom not in res.english_identity
        and rom not in res.name_like
        and dry_run_target_score(rom, list(devs))[0]
    ]
    gen_domain = [
        (rom, devs)
        for rom, devs in domain_items
        if rom not in res.english_identity
        and rom not in res.name_like
        and dry_run_target_score(rom, list(devs))[0]
    ]

    # --- DEVELOPMENT + HOLDOUT from lexicon (first-token target design only) ---
    idx = 0
    for rom, devs in gen_lex:
        split = "DEVELOPMENT" if idx % 5 else "HOLDOUT_VALIDATION"
        add(
            split,
            _case(
                case_id=f"r1_{split[:3].lower()}_lex_{idx:04d}_0",
                split=split,
                input_text=rom,
                acceptable_target_candidates=list(devs),
                preferred_target_candidate=devs[0],
                identity_expected_top1=False,
                category="strong_romanized_lexicon",
                notes="resource lexicon TARGET_PREFERRED; target is first token",
            ),
            require_generable=True,
        )
        idx += 1

    for i, (rom, devs) in enumerate(gen_domain):
        split = "DEVELOPMENT" if i % 4 else "HOLDOUT_VALIDATION"
        add(
            split,
            _case(
                case_id=f"r1_{split[:3].lower()}_dom_{i:04d}",
                split=split,
                input_text=rom,
                acceptable_target_candidates=list(devs),
                preferred_target_candidate=devs[0],
                identity_expected_top1=False,
                category="domain_romanized",
                notes="domain lexicon",
            ),
            require_generable=True,
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
            split = "DEVELOPMENT" if morph_n % 3 else "HOLDOUT_VALIDATION"
            if add(
                split,
                _case(
                    case_id=f"r1_{split[:3].lower()}_morph_{morph_n:04d}",
                    split=split,
                    input_text=composed,
                    acceptable_target_candidates=targets,
                    preferred_target_candidate=targets[0],
                    identity_expected_top1=False,
                    category="morphology_compose",
                    notes="synthetic stem+suffix; generable only",
                ),
                require_generable=True,
            ):
                morph_n += 1
            if morph_n >= 150:
                break
        if morph_n >= 150:
            break

    # Pad DEVELOPMENT/HOLDOUT with unique tagged phrases (target token first)
    def pad(split: str, need: int, prefix: str) -> None:
        n = 0
        tries = 0
        pool = gen_lex or [
            (rom, devs)
            for rom, devs in lex_items
            if rom not in res.english_identity and rom not in res.name_like
        ]
        while len(buckets[split]) < need and tries < 50000:
            tries += 1
            rom, devs = pool[n % len(pool)]
            n += 1
            text = f"{rom} {prefix}{n:04d}"
            add(
                split,
                _case(
                    case_id=f"r1_{split[:3].lower()}_pad_{n:04d}",
                    split=split,
                    input_text=text,
                    acceptable_target_candidates=list(devs),
                    preferred_target_candidate=devs[0],
                    identity_expected_top1=False,
                    category="padding_tagged_phrase",
                    notes="unique tagged synthetic phrase; target is first token",
                ),
                require_generable=True,
            )

    pad("DEVELOPMENT", 500, "devtag")
    pad("HOLDOUT_VALIDATION", 200, "holtag")

    # SAFETY (no generable requirement — identity / abstention cases)
    for i, tok in enumerate(eng):
        add(
            "SAFETY_CHALLENGE",
            _case(
                case_id=f"r1_saf_eng_{i:04d}",
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
                case_id=f"r1_saf_name_{i:04d}",
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
                case_id=f"r1_saf_acr_{i:04d}",
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
                case_id=f"r1_saf_prot_{i:04d}",
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
    while len(buckets["SAFETY_CHALLENGE"]) < 100 and i < 500:
        tok = "zx" + "".join(rng.choice("aeioubcdfghjklmnpqrstvwxyz") for _ in range(6 + (i % 4)))
        i += 1
        if tok in res.lexicon or tok in res.english_identity:
            continue
        add(
            "SAFETY_CHALLENGE",
            _case(
                case_id=f"r1_saf_amb_{i:04d}",
                split="SAFETY_CHALLENGE",
                input_text=tok,
                acceptable_target_candidates=[],
                preferred_target_candidate=None,
                identity_expected_top1=True,
                category="ambiguous_or_unknown",
                notes="unknown Latin",
            ),
        )

    return buckets


def main() -> None:
    bundles = build_cases()
    assert len(bundles["DEVELOPMENT"]) >= 500, len(bundles["DEVELOPMENT"])
    assert len(bundles["HOLDOUT_VALIDATION"]) >= 200, len(bundles["HOLDOUT_VALIDATION"])
    assert len(bundles["SAFETY_CHALLENGE"]) >= 100, len(bundles["SAFETY_CHALLENGE"])

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
        "manifest_id": "MAI_07R1_RANKER_DEV_V1",
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
        "leakage_audit": leak,
    }
    man_path = DEV_ROOT / "manifests" / "MAI_07R1_RANKER_DEV_V1.manifest.json"
    man_path.parent.mkdir(parents=True, exist_ok=True)
    man_path.write_text(json.dumps(man, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "ok": True,
                "counts": {k: len(v) for k, v in bundles.items()},
                "manifest": str(man_path.relative_to(REPO)).replace("\\", "/"),
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
