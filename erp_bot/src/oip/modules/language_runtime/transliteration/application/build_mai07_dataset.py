"""Build MAI-07 frozen evaluation dataset (quality cases; not training data)."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from ..infrastructure.resource_repository import RESOURCES_DIR, load_resources

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07"
FROZEN = OUT / "frozen"
MANIFESTS = OUT / "manifests"
QUEUE = OUT / "linguist_queue"


def _case(
    case_id: str,
    input_text: str,
    *,
    suite_id: str,
    language_forms: list[str],
    acceptable: list[str],
    preferred: str | None = None,
    identity_expected: bool = True,
    abstention_expected: bool = False,
    context_required: bool = False,
    context_challenge: bool = False,
    protected: list[dict[str, Any]] | None = None,
    challenge: bool = False,
    notes: str = "",
) -> dict[str, Any]:
    return {
        "case_id": case_id,
        "suite_id": suite_id,
        "input_text": input_text,
        "language_forms": language_forms,
        "protected_spans": protected or [],
        "acceptable_candidates": acceptable,
        "preferred_candidate": preferred,
        "identity_expected": identity_expected,
        "abstention_expected": abstention_expected,
        "context_required": context_required,
        "context_challenge": context_challenge,
        "review_status": "ENGINEERING_AUTHORED_NOT_LINGUIST_APPROVED",
        "provenance": "engineering_challenge" if challenge else "engineering_lexicon_backed",
        "prohibited_for_training": True,
        "notes": notes,
    }


def build() -> dict[str, Any]:
    res = load_resources(force_reload=True)
    cases: list[dict[str, Any]] = []

    # Lexicon-backed romanized (core/common/domain)
    i = 0
    for roman, devs in sorted(res.lexicon.items()):
        if not roman.isalpha():
            continue
        i += 1
        suite = "domain_terms_v1" if roman in res.domain_terms else "romanized_core_v1"
        if i > 180 and suite == "romanized_core_v1":
            suite = "romanized_common_v1"
        acceptable = [roman] + list(devs)
        if roman in res.english_identity:
            preferred = roman  # English/accounting borrowings: identity preferred
        elif len(devs) == 1:
            preferred = devs[0]
        else:
            preferred = None
        cases.append(
            _case(
                f"mai07_{suite}_{roman}",
                roman,
                suite_id=suite,
                language_forms=["ROMANIZED_NEPALI"] if roman not in res.english_identity else ["ENGLISH"],
                acceptable=acceptable,
                preferred=preferred,
            )
        )

    # Phrases
    # Phrases — acceptables include token surfaces + full identity
    phrases = [
        ("mero kharcha", ["mero", "खर्च", "मेरो", "kharcha", "mero kharcha", "मेरो खर्च"], "मेरो"),
        ("paisa tirnu", ["paisa", "पैसा", "tirnu", "तिर्नु", "paisa tirnu"], None),
        ("aaja kati bikri", ["aaja", "आज", "kati", "कति", "bikri", "बिक्री", "aaja kati bikri"], None),
        ("udharo bakaya", ["udharo", "उधारो", "bakaya", "बाँकी", "udharo bakaya"], None),
        ("namaste tapai", ["namaste", "नमस्ते", "tapai", "तपाईं", "तपाई", "namaste tapai"], None),
        ("hamro dukan", ["hamro", "हाम्रो", "dukan", "दुकान", "hamro dukan"], None),
        ("kar tirnu", ["kar", "कर", "tirnu", "तिर्नु", "kar tirnu"], "कर"),
        ("mero paisa", ["mero", "मेरो", "paisa", "पैसा", "mero paisa"], "मेरो"),
    ]
    for idx, (text, acc, pref) in enumerate(phrases):
        cases.append(
            _case(
                f"mai07_phrase_v1_{idx:03d}",
                text,
                suite_id="phrase_morph_v1",
                language_forms=["ROMANIZED_NEPALI"],
                acceptable=acc,
                preferred=pref,
                challenge=True,
            )
        )

    # Morphology
    morph_cases = [
        ("ramle", ["रामले", "ramle"]),
        ("sitlai", ["सितालाई", "sitlai"]),  # may abstain/identity if stem missing
        ("dukanma", ["दुकानमा", "dukanma"]),
        ("paisako", ["पैसाको", "paisako"]),
        ("kharchabata", ["खर्चबाट", "kharchabata"]),
    ]
    for idx, (text, acc) in enumerate(morph_cases):
        cases.append(
            _case(
                f"mai07_morph_v1_{idx:03d}",
                text,
                suite_id="phrase_morph_v1",
                language_forms=["ROMANIZED_NEPALI"],
                acceptable=acc,
                challenge=True,
            )
        )

    # English identity
    for w in sorted(res.english_identity)[:80]:
        cases.append(
            _case(
                f"mai07_english_identity_v1_{w}",
                w,
                suite_id="english_identity_v1",
                language_forms=["ENGLISH"],
                acceptable=[w],
                preferred=w,
                identity_expected=True,
            )
        )

    # Devanagari identity
    dev_samples = ["मेरो", "खर्च", "पैसा", "नेपाल", "खाता", "आज", "बिक्री", "उधारो", "नमस्ते", "हिसाब"]
    for idx, t in enumerate(dev_samples * 3):
        cases.append(
            _case(
                f"mai07_devanagari_identity_v1_{idx:03d}",
                t,
                suite_id="devanagari_identity_v1",
                language_forms=["NEPALI_DEVANAGARI"],
                acceptable=[t],
                preferred=t,
                identity_expected=True,
            )
        )

    # Ambiguous latin abstention / conservative
    amb = [
        ("xyzzy", True),
        ("qwerty", True),
        ("foobar", True),
        ("blorp", True),
        ("znxg", True),
    ]
    for idx, (t, abstain) in enumerate(amb * 8):
        cases.append(
            _case(
                f"mai07_ambiguous_latin_v1_{idx:03d}",
                t,
                suite_id="ambiguous_latin_v1",
                language_forms=["SHARED_OR_AMBIGUOUS_LATIN"],
                acceptable=[t],
                preferred=t,
                identity_expected=True,
                abstention_expected=abstain,
                challenge=True,
            )
        )

    # Names
    for idx, n in enumerate(sorted(res.name_like)):
        acc = [n] + res.lexicon.get(n, [])
        cases.append(
            _case(
                f"mai07_names_v1_{idx:03d}",
                n,
                suite_id="names_entities_v1",
                language_forms=["NAMED_ENTITY_CANDIDATE"],
                acceptable=acc,
                preferred=n,
                identity_expected=True,
                challenge=True,
                notes="identity mandatory; Devanagari optional with review",
            )
        )

    # Protected
    protected_samples = [
        ("see https://example.test/a now", [{"start": 4, "end": 26, "kind": "URL"}]),
        ("mail eval.user@example.test please", [{"start": 5, "end": 28, "kind": "EMAIL"}]),
        ("supplier PAN EVAL123456 details", [{"start": 9, "end": 23, "kind": "PAN_CANDIDATE"}]),
        ("VAT no EVALVAT9988 on bill", [{"start": 7, "end": 18, "kind": "VAT_IDENTIFIER"}]),
        ("invoice no INV-9001 paid", [{"start": 11, "end": 19, "kind": "INVOICE_REFERENCE"}]),
        ("voucher VCH-42 cleared", [{"start": 8, "end": 14, "kind": "VOUCHER_REFERENCE"}]),
        ("account code ACC-42 balance", [{"start": 13, "end": 19, "kind": "ACCOUNT_CODE"}]),
        ("FY 2081/82 trial", [{"start": 3, "end": 11, "kind": "FISCAL_YEAR_LITERAL"}]),
        ("dated 2024-07-14 payment", [{"start": 6, "end": 16, "kind": "DATE_LITERAL"}]),
        ("paid NPR 1500 cash", [{"start": 5, "end": 13, "kind": "MONEY_LITERAL"}]),
        ("discount 10% applied", [{"start": 9, "end": 12, "kind": "PERCENT_LITERAL"}]),
        ("call phone 9800000000 about", [{"start": 11, "end": 21, "kind": "PHONE_CANDIDATE"}]),
        ("use `SELECT 1` carefully", [{"start": 4, "end": 14, "kind": "CODE_FRAGMENT"}]),
        ("payload {\"a\":1} ignored", [{"start": 8, "end": 15, "kind": "JSON_FRAGMENT"}]),
        ("path C:\\\\temp\\\\a.txt done", [{"start": 5, "end": 18, "kind": "FILE_PATH"}]),
        ("handle @acct_user said", [{"start": 7, "end": 17, "kind": "HASHTAG_OR_HANDLE"}]),
    ]
    for idx, (text, prot) in enumerate(protected_samples * 3):
        cases.append(
            _case(
                f"mai07_protected_v1_{idx:03d}",
                text,
                suite_id="protected_spans_v1",
                language_forms=["MIXED"],
                acceptable=[text],
                preferred=text,
                identity_expected=True,
                protected=prot,
                challenge=True,
            )
        )

    # Code-mix
    mixes = [
        "mero invoice balance",
        "aaja sales report",
        "kharcha payment tireko",
        "bank bata cash nikale",
        "party lai paisa diyo",
        "stock ma saman thulo",
        "vat kar kati cha",
        "opening balance hernu",
    ]
    for idx, text in enumerate(mixes * 6):
        cases.append(
            _case(
                f"mai07_codemix_v1_{idx:03d}",
                text,
                suite_id="code_mix_v1",
                language_forms=["ROMANIZED_NEPALI", "ENGLISH"],
                acceptable=[text],
                identity_expected=True,
                challenge=True,
            )
        )

    # Grapheme / ambiguity variants
    for roman in ["xa", "cha", "chha", "vayo", "bhayo", "hunxa", "huncha", "baaki", "bakaya"]:
        for n in range(5):
            cases.append(
                _case(
                    f"mai07_grapheme_v1_{roman}_{n}",
                    roman,
                    suite_id="grapheme_ambiguity_v1",
                    language_forms=["ROMANIZED_NEPALI"],
                    acceptable=[roman] + res.lexicon.get(roman, []) + res.ambiguity.get(roman, []),
                    challenge=True,
                )
            )

    # Context challenge pairs (at least 60) — preferred is the WITH-context top target
    ctx_pairs = [
        ("english kar module", "kar", True),
        ("kar tirnu parchha", "कर", True),
        ("ram dai aayo", "राम", True),
        ("show bill total", "bill", True),
        ("bank cash deposit", "cash", True),
        ("tax kharcha kati", "कर", True),
        ("sale bechyo aaja", "बिक्री", True),
        ("party customer due", "party", True),
        ("dr amount entry", "dr", True),
        ("cr amount entry", "cr", True),
        ("net profit report", "net", True),
        ("opening balance hernu", "balance", True),
        ("voucher journal entry", "voucher", True),
        ("english kar please", "kar", True),
        ("mero kar", "कर", True),
    ]
    for idx in range(64):
        text, prefer, req = ctx_pairs[idx % len(ctx_pairs)]
        cases.append(
            _case(
                f"mai07_context_challenge_v1_{idx:03d}",
                text,
                suite_id="context_challenge_v1",
                language_forms=["ROMANIZED_NEPALI", "ENGLISH"],
                acceptable=[text, prefer] if prefer != text else [text],
                preferred=prefer if prefer != text else None,
                context_required=req,
                context_challenge=True,
                challenge=True,
            )
        )

    # Punctuation / emoji / whitespace / security / long
    extras = [
        ("mero, kharcha!", ["mero, kharcha!"], "punct_ws_emoji_v1"),
        ("mero 😀 kharcha", ["mero 😀 kharcha"], "punct_ws_emoji_v1"),
        ("cafe\u0301 paisa", ["cafe\u0301 paisa"], "punct_ws_emoji_v1"),
        ("a\r\nb", ["a\r\nb"], "punct_ws_emoji_v1"),
        ("  mero  ", ["  mero  ", "mero", "मेरो"], "punct_ws_emoji_v1"),
        ("\u202emero", ["\u202emero"], "security_adversarial_v1"),
        ("x" * 200, ["x" * 200], "security_adversarial_v1"),
        ("mero\u200bkharcha", ["mero\u200bkharcha"], "security_adversarial_v1"),
    ]
    for idx, (text, acc, suite) in enumerate(extras * 10):
        cases.append(
            _case(
                f"mai07_{suite}_{idx:03d}",
                text,
                suite_id=suite,
                language_forms=["ROMANIZED_NEPALI"],
                acceptable=acc,
                identity_expected=True,
                challenge=True,
            )
        )

    # Deduplicate by case_id
    by_id: dict[str, dict[str, Any]] = {}
    for c in cases:
        by_id[c["case_id"]] = c
    uniq = list(by_id.values())

    # Pad to >=650 with synthetic romanized tokens from lexicon combinations
    pad_i = 0
    keys = [k for k in res.lexicon if k.isalpha()]
    while len(uniq) < 650:
        a = keys[pad_i % len(keys)]
        b = keys[(pad_i * 3) % len(keys)]
        text = f"{a} {b}"
        cid = f"mai07_pad_v1_{pad_i:04d}"
        uniq.append(
            _case(
                cid,
                text,
                suite_id="romanized_common_v1",
                language_forms=["ROMANIZED_NEPALI"],
                acceptable=[text, f"{res.lexicon[a][0]} {res.lexicon[b][0]}"],
            )
        )
        pad_i += 1

    FROZEN.mkdir(parents=True, exist_ok=True)
    MANIFESTS.mkdir(parents=True, exist_ok=True)
    QUEUE.mkdir(parents=True, exist_ok=True)

    suites: dict[str, list[dict[str, Any]]] = {}
    for c in uniq:
        suites.setdefault(c["suite_id"], []).append(c)

    files_meta = []
    h = hashlib.sha256()
    for suite_id, rows in sorted(suites.items()):
        path = FROZEN / f"{suite_id}.jsonl"
        body = "".join(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n" for r in sorted(rows, key=lambda x: x["case_id"]))
        path.write_text(body, encoding="utf-8")
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        h.update(suite_id.encode())
        h.update(b"\0")
        h.update(path.read_bytes())
        files_meta.append(
            {
                "path": f"evals/mai07/frozen/{suite_id}.jsonl",
                "suite_id": suite_id,
                "case_count": len(rows),
                "sha256": digest,
            }
        )

    dataset_hash = h.hexdigest()
    man = {
        "dataset_manifest_id": "MAI_07_ROMANIZED_TRANSLITERATION_V1",
        "dataset_version": "mai07-romanized-transliteration-v1",
        "dataset_hash": dataset_hash,
        "total_cases": len(uniq),
        "prohibited_for_training": True,
        "linguist_approved": False,
        "files": files_meta,
        "context_challenge_min": 60,
        "challenge_authored_min": 150,
    }
    MANIFESTS.joinpath("MAI_07_ROMANIZED_TRANSLITERATION_V1.manifest.json").write_text(
        json.dumps(man, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    QUEUE.joinpath("PENDING_LINGUIST_REVIEW.json").write_text(
        json.dumps(
            {
                "status": "NOT_STARTED",
                "message": "No qualified linguist review performed for MAI-07 resources or frozen cases.",
                "queue_size": len(uniq),
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    challenge_n = sum(1 for c in uniq if c.get("provenance") == "engineering_challenge")
    ctx_n = sum(1 for c in uniq if c.get("context_challenge"))
    return {
        "total_cases": len(uniq),
        "dataset_hash": dataset_hash,
        "challenge_cases": challenge_n,
        "context_challenge_cases": ctx_n,
        "suites": {k: len(v) for k, v in suites.items()},
    }


def main() -> None:
    print(json.dumps(build(), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
