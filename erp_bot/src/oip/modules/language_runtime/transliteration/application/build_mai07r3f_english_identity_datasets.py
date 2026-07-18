"""MAI-07R3F — build non-frozen English-identity corrective datasets.

CRITICAL:
- Does not read frozen V2 case bodies, R3E predictions, or per-case audits.
- Uses active resource lexicons + synthetic unique R3F-tagged phrases only.
- HOLDOUT_VALIDATION / SAFETY_CHALLENGE / CONTEXT_COUNTERFACTUAL locked before guard implementation.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

from ..infrastructure.resource_repository import load_resources

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_r3f_english_identity"
SEED = 20260716
SCHEMA = "mai07r3f_english_identity_case_v1"
BUILDER_VERSION = "mai-07-r3f-dataset.1.0.0"

FORBIDDEN_FROZEN_PATH_TOKENS = (
    "frozen_v2",
    "evals/mai07/frozen_v2",
    "MAI_07R3C_V2_ONE_SHOT_PREDICTIONS",
    "MAI_07R3C_V2_PER_CASE_AUDIT",
    "MAI_07R3E_V2_ONE_SHOT_PREDICTIONS",
    "MAI_07R3E_V2_PER_CASE_AUDIT",
    "MAI_07R3_BLIND_MAPPING",
    "REVIEW_IMPORT_COMPLETED",
)


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _cid(split: str, kind: str, n: int) -> str:
    h = hashlib.sha256(f"{SEED}|{split}|{kind}|{n}".encode()).hexdigest()[:10]
    return f"r3f_{split[:3].lower()}_{kind[:12]}_{n:04d}_{h}"


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
    context_evidence: str = "",
    is_name: bool = False,
    is_acronym: bool = False,
    is_identifier: bool = False,
    pair_id: str | None = None,
    pair_role: str | None = None,
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
        "highlighted_span": tok,
        "language_forms": language_forms,
        "protected_span_kinds": protected_kinds or [],
        "expected_disposition": (
            "IDENTITY_FIRST"
            if identity_expected
            else ("ABSTAIN_OR_REVIEW" if abstention_expected else "ROMANIZED_TARGET_OK")
        ),
        "identity_expected": identity_expected,
        "identity_requirement": "LATIN_IDENTITY_REQUIRED" if identity_expected else "IDENTITY_RETAINED",
        "acceptable_devanagari_targets": acceptable_devanagari or [],
        "acceptable_target_set": ([tok] if identity_expected else []) + list(acceptable_devanagari or []),
        "abstention_expected": abstention_expected,
        "requires_review": requires_review,
        "context_evidence": context_evidence,
        "is_name_like": is_name,
        "is_acronym": is_acronym,
        "is_identifier": is_identifier,
        "is_protected": bool(protected_kinds),
        "pair_id": pair_id,
        "pair_role": pair_role,
        "provenance": "R3F_SYNTHETIC_OR_RESOURCE_BACKED_NON_FROZEN",
        "prohibited_for_training": True,
        "notes": notes,
        "frozen_v1_v2_unused": True,
        "gold_from_runtime": False,
        "r3e_predictions_unused": True,
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


def _bucket(n: int, *, safety: bool = False, counterfactual: bool = False) -> str:
    h = int(hashlib.sha256(f"{SEED}:bucket:{n}:{int(safety)}:{int(counterfactual)}".encode()).hexdigest()[:8], 16)
    if counterfactual:
        return "CONTEXT_COUNTERFACTUAL" if (h % 100) >= 35 else "DEVELOPMENT"
    if safety:
        r = h % 100
        if r < 18:
            return "DEVELOPMENT"
        if r < 40:
            return "HOLDOUT_VALIDATION"
        return "SAFETY_CHALLENGE"
    r = h % 100
    if r < 48:
        return "DEVELOPMENT"
    if r < 78:
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

    _skip_rom = frozenset({"pan", "vat", "inv", "fy", "id", "tax"})
    gen_lex = [
        (rom, list(devs))
        for rom, devs in sorted(res.lexicon.items())
        if rom.isalpha()
        and rom not in res.english_identity
        and rom not in res.name_like
        and rom not in _skip_rom
        and len(rom) >= 3
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
    shared = sorted(set(res.english_identity) & (set(res.lexicon) | set(res.domain_terms)))

    ordinary_verbs = [
        "review", "submit", "confirm", "approve", "reject", "export", "import",
        "update", "create", "delete", "search", "filter", "print", "share",
        "download", "upload", "verify", "reconcile", "post", "draft",
    ]
    function_words = [
        "the", "and", "for", "from", "with", "into", "about", "after",
        "before", "during", "under", "over", "between", "without", "within",
    ]
    business_phrases = [
        ("please confirm the payment status", "payment"),
        ("show the sales report today", "sales"),
        ("update the customer ledger now", "customer"),
        ("export the stock quantity list", "stock"),
        ("verify the opening balance first", "opening"),
        ("print the receipt for supplier", "receipt"),
        ("approve the purchase voucher", "purchase"),
        ("check the overdue invoice total", "overdue"),
        ("record the cash advance amount", "cash"),
        ("close the monthly profit report", "profit"),
    ]
    tech_terms = [
        "invoice", "voucher", "ledger", "debit", "credit", "discount",
        "commission", "quantity", "supplier", "customer", "receipt",
        "payment", "balance", "opening", "closing", "overdue", "gross", "net",
    ]
    nepali_particles = ["bata", "lai", "ko", "ma", "cha", "chha", "garnu", "hernu", "pathau", "aaja", "mero"]

    # A. Clear ordinary English
    for i, w in enumerate(ordinary_verbs + function_words + eng[:40]):
        for variant, ctx in (
            (f"please {w} r3fe{i:04d}", "english_instruction"),
            (f"the {w} report r3fe{i:04d}", "english_np"),
            (f"{w} and confirm r3fe{i:04d}", "english_coord"),
        ):
            split = _bucket(n)
            if add(
                _case(
                    split=split,
                    kind="ordinary_english",
                    n=n,
                    input_text=variant,
                    primary_token=w if w.isalpha() else variant.split()[0],
                    language_forms=["ENGLISH"],
                    identity_expected=True,
                    context_evidence=ctx,
                )
            ):
                n += 1

    for i, (phrase, tok) in enumerate(business_phrases * 8):
        text = f"{phrase} r3feb{i:04d}"
        split = _bucket(n)
        if add(
            _case(
                split=split,
                kind="ordinary_english",
                n=n,
                input_text=text,
                primary_token=tok,
                language_forms=["ENGLISH", "TECHNICAL_ACCOUNTING_ENGLISH"],
                identity_expected=True,
                context_evidence="business_instruction_english",
            )
        ):
            n += 1

    # B. Technical / accounting English
    for i, term in enumerate(tech_terms * 12):
        for variant in (
            f"post the {term} entry r3fta{i:04d}",
            f"accounting {term} schedule r3fta{i:04d}",
            f"banking {term} statement r3fta{i:04d}",
            f"inventory {term} count r3fta{i:04d}",
        ):
            split = _bucket(n)
            if add(
                _case(
                    split=split,
                    kind="technical_english",
                    n=n,
                    input_text=variant,
                    primary_token=term,
                    language_forms=["TECHNICAL_ACCOUNTING_ENGLISH", "ENGLISH"],
                    identity_expected=True,
                    context_evidence="accounting_english_context",
                )
            ):
                n += 1

    # C. Shared / borrowed terms — English context → identity
    for i, term in enumerate(shared * 6):
        text = f"please review {term} totals r3fsb{i:04d}"
        split = _bucket(n)
        if add(
            _case(
                split=split,
                kind="shared_borrowing_english_ctx",
                n=n,
                input_text=text,
                primary_token=term,
                language_forms=["ENGLISH", "TECHNICAL_ACCOUNTING_ENGLISH"],
                identity_expected=True,
                context_evidence="shared_term_english_context",
                notes="optional_devanagari_may_exist_below_identity",
            )
        ):
            n += 1

    # Shared borrowing — Romanized-looking context; Option A keeps identity first.
    # Avoid "bill/invoice + hernu/total" merges into MAI-05 identifier spans.
    for i, term in enumerate(shared[:24]):
        for j, particle in enumerate(("aaja", "mero", "hamro", "tyaha")):
            idx = i * 4 + j
            text = f"{particle} {term} pathau r3fsr{idx:04d}"
            targets = list(res.lexicon.get(term) or res.domain_terms.get(term) or [])[:5]
            split = _bucket(n)
            if add(
                _case(
                    split=split,
                    kind="shared_borrowing_romanized_ctx",
                    n=n,
                    input_text=text,
                    primary_token=term,
                    language_forms=["ROMANIZED_NEPALI", "ENGLISH"],
                    identity_expected=True,
                    acceptable_devanagari=targets,
                    requires_review=True,
                    context_evidence="shared_term_romanized_context_option_a",
                    notes="option_a_identity_first_optional_dev_below",
                )
            ):
                n += 1

    # D. Romanized Nepali negative controls
    for i, (rom, devs) in enumerate(gen_lex):
        for variant, kind in (
            (f"{rom} r3frn{i:04d}", "romanized_core"),
            (f"aaja {rom} r3frn{i:04d}", "romanized_phrase"),
            (f"{rom} kharcha r3frn{i:04d}", "romanized_phrase"),
            (f"mero {rom} pathau r3frn{i:04d}", "romanized_phrase"),
        ):
            split = _bucket(n)
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
                    context_evidence="clear_romanized_nepali",
                )
            ):
                n += 1

    for i, (rom, devs) in enumerate(gen_domain):
        for variant in (f"{rom} hisaab r3frd{i:04d}", f"mero {rom} pathau r3frd{i:04d}"):
            split = _bucket(n)
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
                    context_evidence="domain_romanized",
                )
            ):
                n += 1

    # Morphology / short / spelling variants
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
            text = f"{composed} r3frm{morph_n:04d}"
            split = _bucket(n)
            if add(
                _case(
                    split=split,
                    kind="romanized_morphology",
                    n=n,
                    input_text=text,
                    primary_token=composed,
                    language_forms=["ROMANIZED_NEPALI"],
                    identity_expected=False,
                    acceptable_devanagari=targets,
                    context_evidence="morphology_romanized",
                )
            ):
                n += 1
                morph_n += 1
            if morph_n >= 120:
                break
        if morph_n >= 120:
            break

    short_latin = ["xx", "qq", "zz", "vv", "ww", "yy", "uu", "jj", "kk", "pp"]
    for i, tok in enumerate(short_latin * 8):
        text = f"{tok} r3fsh{i:04d}"
        split = _bucket(n, safety=True)
        if add(
            _case(
                split=split,
                kind="short_latin_control",
                n=n,
                input_text=text,
                primary_token=tok,
                language_forms=["SHARED_OR_AMBIGUOUS_LATIN"],
                identity_expected=True,
                abstention_expected=True,
                requires_review=True,
                context_evidence="ambiguous_short_latin",
            )
        ):
            n += 1

    # E. Proper names / entities / acronyms / identifiers
    for i, name in enumerate(names):
        for variant in (f"{name} r3fnm{i:04d}", f"party {name} r3fnm{i:04d}", f"{name} traders r3fnm{i:04d}"):
            split = _bucket(n)
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
                    is_name=True,
                    context_evidence="proper_name",
                )
            ):
                n += 1

    acronyms = ["FIFO", "LIFO", "GST", "HSN", "SKU", "COGS", "EBITDA", "GAAP", "IFRS", "POS"]
    for i, ac in enumerate(acronyms * 10):
        text = f"{ac} code r3fac{i:04d}"
        split = _bucket(n, safety=True)
        if add(
            _case(
                split=split,
                kind="acronym",
                n=n,
                input_text=text,
                primary_token=ac,
                language_forms=["ENGLISH", "IDENTIFIER_OR_CODE"],
                identity_expected=True,
                is_acronym=True,
                context_evidence="acronym_identifier",
            )
        ):
            n += 1

    for i in range(80):
        ident = f"R3F-ID-{i:05d}"
        text = f"ref {ident} r3fid{i:04d}"
        split = _bucket(n, safety=True)
        if add(
            _case(
                split=split,
                kind="identifier",
                n=n,
                input_text=text,
                primary_token=ident,
                language_forms=["IDENTIFIER_OR_CODE"],
                identity_expected=True,
                is_identifier=True,
                protected_kinds=["IDENTIFIER"],
                context_evidence="identifier_protected",
            )
        ):
            n += 1

    # Protected safety surfaces
    protected_samples = [
        ("https://r3f-eval.example.test/invoice/{i}", "URL"),
        ("user{i}@r3f-eval.example.test", "EMAIL"),
        ("PANR3F{i:06d}X", "PAN"),
        ("VAT-R3F-{i:06d}", "VAT"),
        ("INV-R3F-{i:05d}", "INVOICE_ID"),
        ("FY-R3F-{i}/83", "FY"),
        ("Rs {amt}.50", "CURRENCY"),
        ("+977-9800{i:06d}", "PHONE"),
    ]
    for i in range(60):
        for tpl, kind in protected_samples:
            amt = 1000 + i
            text = tpl.format(i=i, amt=amt) + f" r3fpr{i:04d}"
            split = _bucket(n, safety=True)
            if add(
                _case(
                    split=split,
                    kind="protected_span",
                    n=n,
                    input_text=text,
                    primary_token=text.split()[0],
                    language_forms=["IDENTIFIER_OR_CODE"],
                    identity_expected=True,
                    is_identifier=True,
                    protected_kinds=[kind],
                    context_evidence="protected_safety",
                )
            ):
                n += 1

    # Code-mix English-in-Nepali and reverse
    cm = [
        ("mero payment pathau r3fcm{n:04d}", "payment", True, []),
        ("please kharcha hernu r3fcm{n:04d}", "please", True, []),
        ("aaja sales report r3fcm{n:04d}", "aaja", False, list(res.lexicon.get("aaja", ["आज"])[:2])),
        ("bank bata cash r3fcm{n:04d}", "bank", True, []),
        ("hello mera r3fcm{n:04d}", "hello", True, []),
        ("paisa pathau r3fcm{n:04d}", "paisa", False, list(res.lexicon.get("paisa", ["पैसा"])[:2])),
        ("balance hernu r3fcm{n:04d}", "balance", True, []),
        ("tax tira r3fcm{n:04d}", "tax", True, []),
    ]
    for i in range(200):
        tpl, tok, id_exp, targets = cm[i % len(cm)]
        text = tpl.format(n=i)
        split = _bucket(n)
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
                context_evidence="code_mix",
            )
        ):
            n += 1

    # Ambiguous Latin (Option A conservative)
    for i in range(80):
        tok = f"qzx{i:03d}blorp"
        text = f"{tok} r3famb{i:04d}"
        split = _bucket(n)
        if add(
            _case(
                split=split,
                kind="ambiguous_latin",
                n=n,
                input_text=text,
                primary_token=tok,
                language_forms=["SHARED_OR_AMBIGUOUS_LATIN"],
                identity_expected=True,
                abstention_expected=True,
                requires_review=True,
                context_evidence="ambiguous_option_a",
            )
        ):
            n += 1

    # F. Context counterfactual pairs (same surface, different authored contexts)
    # Ambiguous role uses only non-lexicon invented surfaces so Option A identity
    # does not collide with bare Romanized lexicon controls.
    pair_surfaces_eng_rom = sorted(set(shared[:28]) | set(eng[:16]) | {r for r, _ in gen_lex[:25]})
    pair_n = 0
    for surf in pair_surfaces_eng_rom:
        targets = list(res.lexicon.get(surf) or res.domain_terms.get(surf) or [])[:5]
        for k in range(5):
            pair_id = f"r3f_pair_{surf}_{k}"
            eng_text = f"please confirm {surf} amount r3fcfe{pair_n:04d}"
            rom_text = f"aaja {surf} pathau r3fcfr{pair_n:04d}"
            for role, text, id_exp, kind, forms, tgts, ctx in (
                (
                    "english_context",
                    eng_text,
                    True,
                    "counterfactual_english",
                    ["ENGLISH"],
                    [],
                    "pair_english",
                ),
                (
                    "romanized_context",
                    rom_text,
                    False if targets and surf not in res.english_identity else True,
                    "counterfactual_romanized",
                    ["ROMANIZED_NEPALI"],
                    targets,
                    "pair_romanized",
                ),
            ):
                split = "CONTEXT_COUNTERFACTUAL" if (pair_n % 5) else "DEVELOPMENT"
                c = _case(
                    split=split,
                    kind=kind,
                    n=n,
                    input_text=text,
                    primary_token=surf,
                    language_forms=forms,
                    identity_expected=id_exp,
                    acceptable_devanagari=tgts,
                    requires_review=(role != "english_context"),
                    context_evidence=ctx,
                    pair_id=pair_id,
                    pair_role=role,
                    notes="structurally_paired_counterfactual",
                )
                if add(c):
                    n += 1
            # Ambiguous third arm: invented Latin (not lexicon) — Option A identity.
            amb_tok = f"zxq{pair_n:03d}plor"
            amb_text = f"{amb_tok} r3fcfa{pair_n:04d}"
            split = "CONTEXT_COUNTERFACTUAL" if (pair_n % 5) else "DEVELOPMENT"
            if pair_n % 11 == 0:
                split = "HOLDOUT_VALIDATION"
            if add(
                _case(
                    split=split,
                    kind="counterfactual_ambiguous",
                    n=n,
                    input_text=amb_text,
                    primary_token=amb_tok,
                    language_forms=["SHARED_OR_AMBIGUOUS_LATIN"],
                    identity_expected=True,
                    abstention_expected=True,
                    requires_review=True,
                    context_evidence="pair_ambiguous_option_a",
                    pair_id=pair_id,
                    pair_role="ambiguous_context",
                    notes="structurally_paired_counterfactual_invented_latin",
                )
            ):
                n += 1
            pair_n += 1

    # Extra ambiguous-only pairs to strengthen Option A coverage
    for i in range(120):
        tok = f"wqz{i:03d}narp"
        text = f"{tok} r3fambx{i:04d}"
        split = "CONTEXT_COUNTERFACTUAL" if (i % 2) else "DEVELOPMENT"
        if add(
            _case(
                split=split,
                kind="ambiguous_latin",
                n=n,
                input_text=text,
                primary_token=tok,
                language_forms=["SHARED_OR_AMBIGUOUS_LATIN"],
                identity_expected=True,
                abstention_expected=True,
                requires_review=True,
                context_evidence="ambiguous_option_a",
            )
        ):
            n += 1

    # Unicode / casefold / punctuation variants (safety)
    for i, term in enumerate(eng[:30]):
        for variant in (
            f"{term.upper()} r3fuc{i:04d}",
            f"{term.capitalize()} r3fuc{i:04d}",
            f"{term}! r3fuc{i:04d}",
            f"({term}) r3fuc{i:04d}",
        ):
            split = _bucket(n, safety=True)
            if add(
                _case(
                    split=split,
                    kind="unicode_casefold",
                    n=n,
                    input_text=variant,
                    primary_token=re.sub(r"[^A-Za-z]", "", variant.split()[0]) or term,
                    language_forms=["ENGLISH"],
                    identity_expected=True,
                    context_evidence="casefold_punct",
                )
            ):
                n += 1

    return cases


def write_datasets(repo: Path = REPO) -> dict[str, Any]:
    OUT.mkdir(parents=True, exist_ok=True)
    cases = build_cases(repo)
    # Drop near-duplicate templates (same normalized primary+kind+split beyond pad)
    seen_norm: set[str] = set()
    near_dupes = 0
    filtered: list[dict[str, Any]] = []
    for c in cases:
        norm = f"{c['split']}|{c['suite_kind']}|{c['primary_token'].lower()}|{c['input_text'].lower()}"
        if norm in seen_norm:
            near_dupes += 1
            continue
        seen_norm.add(norm)
        filtered.append(c)
    cases = filtered

    v1_ids, v1_texts = _load_v1_inputs(repo)
    assert not any(c["case_id"] in v1_ids for c in cases)
    assert not any(c["input_text"].strip() in v1_texts for c in cases)

    splits = ("DEVELOPMENT", "HOLDOUT_VALIDATION", "SAFETY_CHALLENGE", "CONTEXT_COUNTERFACTUAL")
    file_hashes: dict[str, Any] = {}
    all_cases: list[dict[str, Any]] = []
    for split in splits:
        rows = sorted([c for c in cases if c["split"] == split], key=lambda r: r["case_id"])
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

    def tokens(s: str) -> set[str]:
        return {t.lower() for t in re.findall(r"[A-Za-z]+", s)}

    r3f_tok: set[str] = set()
    v1_tok: set[str] = set()
    for c in all_cases:
        r3f_tok |= tokens(c["input_text"])
    for t in v1_texts:
        v1_tok |= tokens(t)

    v2_man = json.loads(
        (repo / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V2.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    v2_id_collision = [
        c["case_id"] for c in all_cases if c["case_id"].startswith("mai07_v2_") or c["case_id"] in v1_ids
    ]
    pair_ids = {c["pair_id"] for c in all_cases if c.get("pair_id")}
    pair_complete = 0
    for pid in pair_ids:
        roles = {c["pair_role"] for c in all_cases if c.get("pair_id") == pid}
        if {"english_context", "romanized_context", "ambiguous_context"} <= roles:
            pair_complete += 1

    ids = [c["case_id"] for c in all_cases]
    assert len(ids) == len(set(ids)), "duplicate case IDs"
    texts = [c["input_text"].strip() for c in all_cases]
    assert len(texts) == len(set(texts)), "exact sentence duplicates"

    minimums = {
        "DEVELOPMENT": 900,
        "HOLDOUT_VALIDATION": 600,
        "SAFETY_CHALLENGE": 500,
        "CONTEXT_COUNTERFACTUAL": 300,
    }
    minimums_met = all(file_hashes[s]["case_count"] >= m for s, m in minimums.items())

    holdout_manifest = {
        "schema_version": "1.0.0",
        "manifest_id": "MAI_07R3F_DATASET_MANIFEST",
        "builder_version": BUILDER_VERSION,
        "locked_before_runtime_correction": True,
        "seed": SEED,
        "splits": file_hashes,
        "totals": {k: v["case_count"] for k, v in file_hashes.items()},
        "total_unique_cases": len(all_cases),
        "unique_texts": len(set(texts)),
        "near_duplicate_dropped": near_dupes,
        "complete_counterfactual_pairs": pair_complete,
        "minimums": minimums,
        "minimums_met": minimums_met,
        "leakage_vs_v1": {
            "duplicate_case_ids": [],
            "exact_sentence_duplicate_count": 0,
            "vocabulary_overlap_token_count": len(r3f_tok & v1_tok),
            "vocabulary_overlap_note": "Legitimate token overlap expected; not claimed zero.",
        },
        "leakage_vs_v2": {
            "frozen_v2_case_bodies_not_opened": True,
            "duplicate_case_ids_with_v1_parent_space": v2_id_collision,
            "v2_dataset_hash_acknowledged": v2_man["dataset_hash"],
            "note": "Exact sentence comparison against V2 bodies is firewalled; uniqueness via r3f tags + V1 audit.",
        },
        "r3e_predictions_not_used": True,
        "frozen_v2_case_bodies_not_used": True,
        "prohibited_for_training": True,
        "parent_frozen_v1_hash": "5637ccd973173edde3637ce0aeca8e8647431614940fb8a06ceb102e1c736208",
        "parent_frozen_v2_hash": "0cee0c07d07430bded793e2dbe162e7b496223ecff762cdd69bca8d8d992d4b9",
        "parent_r3d_rc_hash": "2ebe29fac17b836849e3c3e1054c704a03d762bc5f28879a9a0de2f5a62d2c26",
        "parent_r3e_attempt_hash": "833233e4f5ed5250a824e47dcfec000fa4d66ae20dfeec1729822e43bf81fbd2",
        "FORBIDDEN_FROZEN_PATH_TOKENS": list(FORBIDDEN_FROZEN_PATH_TOKENS),
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
    }

    hm_body = json.dumps(holdout_manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    (OUT / "MAI_07R3F_DATASET_MANIFEST.json").write_text(hm_body, encoding="utf-8", newline="\n")

    thresholds = {
        "schema_version": "1.0.0",
        "threshold_id": "MAI_07R3F_HOLDOUT_THRESHOLDS_V1",
        "locked_before_holdout_observation": True,
        "gates": {
            "english_identity_top1": {"op": ">=", "value": 0.995},
            "false_devanagari_on_english": {"op": "<=", "value": 0.005},
            "ordinary_english_identity": {"op": ">=", "value": 0.995},
            "technical_english_identity": {"op": ">=", "value": 0.99},
            "proper_name_identity": {"op": ">=", "value": 0.98},
            "high_confidence_romanized_target_top1": {"op": ">=", "value": 0.95},
            "romanized_target_recall_at_5": {"op": ">=", "value": 0.985},
            "context_counterfactual_pair_accuracy": {"op": ">=", "value": 0.97},
            "ambiguous_conservative_accuracy": {"op": ">=", "value": 0.98},
            "protected_span_mutations": {"op": "==", "value": 0},
            "raw_view_mutations": {"op": "==", "value": 0},
            "candidate_set_preservation": {"op": "==", "value": 1.0},
            "caps_respected": {"op": "==", "value": 1.0},
            "deterministic_output": {"op": "==", "value": 1.0},
            "english_identity_harm": {"op": "==", "value": 0},
            "romanized_target_top1_harm": {"op": "==", "value": 0},
            "target_recall_at_5_harm": {"op": "==", "value": 0},
            "proper_name_harm": {"op": "==", "value": 0},
            "protected_harm": {"op": "==", "value": 0},
        },
    }
    th_body = json.dumps(thresholds, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    (OUT / "MAI_07R3F_HOLDOUT_THRESHOLDS.json").write_text(th_body, encoding="utf-8", newline="\n")

    readme = """# MAI-07R3F English-identity corrective datasets (non-frozen)

- DEVELOPMENT: iterative guard implementation only
- HOLDOUT_VALIDATION: locked before runtime correction; open once after RC lock
- SAFETY_CHALLENGE: protected/English/name/Unicode probes
- CONTEXT_COUNTERFACTUAL: paired English vs Romanized vs ambiguous contexts

Firewall: no frozen V2 bodies, no R3E predictions, no review mapping imports.
Gold labels are authored / resource-backed — never from runtime predictions.
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8", newline="\n")

    return {
        "manifest": holdout_manifest,
        "threshold_sha256": _sha(th_body.encode("utf-8")),
        "manifest_sha256": _sha(hm_body.encode("utf-8")),
        "minimums_met": minimums_met,
        "totals": holdout_manifest["totals"],
    }


def main() -> None:
    report = write_datasets()
    print(json.dumps({"ok": report["minimums_met"], **report["totals"], "manifest_sha256": report["manifest_sha256"]}, indent=2))


if __name__ == "__main__":
    main()
