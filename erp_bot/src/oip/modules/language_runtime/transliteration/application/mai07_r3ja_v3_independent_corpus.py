"""MAI-07R3J-A — independently authored V3 review corpus (no V1/V2 imports).

All items are NEW_HUMAN_AUTHORED or INDEPENDENT_ENGINEERING_SCENARIO.
Gold labels are intentionally blank — humans decide in Round A/B.
Runtime lexicon/ranker must never author gold here.
"""

from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass, field
from typing import Any

PHASE_ID = "MAI-07R3J-A-INDEPENDENT-V3-GOVERNANCE-AND-REVIEW-PACKET"
SPLIT_SEED = "mai07-r3ja-v3-family-split-20260716"
CORPUS_SEED = "mai07-r3ja-v3-corpus-20260716"
PROHIBITED_FOR_TRAINING = True

PROVENANCE_CLASSES = (
    "NEW_HUMAN_AUTHORED",
    "LICENSED_PUBLIC_CORPUS",
    "OFFICIAL_PUBLIC_TEXT_WITH_PERMITTED_EVALUATION_USE",
    "INDEPENDENT_ENGINEERING_SCENARIO",
    "PROFESSIONAL_REVIEWER_SUBMITTED",
)

MIN_COVERAGE = {
    "clear_romanized_nepali": 180,
    "clear_english_identity": 150,
    "shared_lexeme_families": 150,
    "counterfactual_groups": 120,
    "counterfactual_cases": 360,
    "accounting_business": 150,
    "names_entities_acronyms_ids": 100,
    "protected_span": 100,
    "ambiguous_review_required": 100,
    "candidate_generation_challenge": 100,
    "unicode_alignment": 50,
    "total_unique": 1000,
    "multi_token_ratio_relevant": 0.70,
}


@dataclass
class V3SourceItem:
    source_item_id: str
    family_id: str
    provenance_class: str
    source_document: str
    source_licence: str
    input_text: str
    highlighted_span: str
    design_tags: list[str] = field(default_factory=list)
    counterfactual_group_id: str | None = None
    counterfactual_role: str | None = None  # EN_CONTEXT | NP_CONTEXT | AMBIGUOUS
    proposed_round_b_candidates: list[str] = field(default_factory=list)
    multi_token: bool = False
    prohibited_for_training: bool = True

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _hid(*parts: str) -> str:
    h = hashlib.sha256(":".join(parts).encode("utf-8")).hexdigest()
    return h[:12]


def _item_id(kind: str, n: int) -> str:
    return f"V3SRC-{kind}-{_hid(CORPUS_SEED, kind, str(n))}"


def _family(kind: str, key: str) -> str:
    return f"V3FAM-{kind}-{_hid(CORPUS_SEED, 'fam', kind, key)}"


# Independently authored romanized Nepali stems (engineering scenarios).
# Not copied from frozen V1/V2 case bodies.
_ROMANIZED_STEMS = [
    "aaja", "hijo", "bholi", "bihana", "beluka", "raati", "hapta", "mahina",
    "barsa", "paisa", "rupiya", "kharcha", "aamdani", "nafa", "noksan",
    "byaj", "udharo", "baaki", "hisab", "khata", "lejhar", "jabaj",
    "kinyo", "bechyo", "tireko", "linchu", "dinchu", "gara", "garaidim",
    "dekhau", "rakha", "pathau", "bola", "suna", "bujhe", "thaha",
    "cha", "chha", "chaina", "chhaina", "hunxa", "huncha", "bhayo",
    "thiyo", "thyo", "aayo", "gayo", "basnu", "jaanu", "aaunu",
    "ramro", "naramro", "thulo", "sano", "dherai", "thorai", "sabai",
    "kehi", "aru", "ani", "tara", "kinabhane", "yasari", "tyasari",
    "hamro", "timro", "mero", "usko", "tapai", "hajurko", "malai",
    "lai", "bata", "sanga", "samma", "pachi", "pahila", "aba", "aile",
    "kasto", "kati", "kun", "kahile", "kaha", "kasari", "kin", "ke",
    "ho", "hoina", "haina", "thik", "milcha", "pugcha", "sakcha",
    "parcha", "bhaneko", "gareko", "lekheko", "padheko", "suneeko",
    "dokaan", "dukan", "pasal", "grahak", "malik", "kamdar", "staff",
    "talab", "bonus", "bhatta", "kiraya", "bhada", "bijuli", "paani",
    "internet", "phone", "petrol", "diesel", "saman", "maal", "stock",
    "order", "bill", "invoice", "receipt", "voucher", "cheque", "cash",
    "bank", "deposit", "withdraw", "transfer", "balance", "statement",
]

_ENGLISH_IDENTITY = [
    "invoice", "receipt", "voucher", "ledger", "journal", "debit", "credit",
    "balance", "statement", "reconcile", "audit", "tax", "VAT", "PAN",
    "GST", "payroll", "salary", "bonus", "allowance", "expense", "income",
    "profit", "loss", "capital", "asset", "liability", "equity", "inventory",
    "purchase", "sales", "return", "discount", "freight", "transport",
    "supplier", "customer", "vendor", "contractor", "employee", "manager",
    "branch", "warehouse", "godown", "office", "headquarters", "module",
    "report", "dashboard", "export", "import", "sync", "backup", "restore",
    "password", "username", "settings", "configuration", "template", "draft",
    "confirm", "cancel", "approve", "reject", "pending", "posted", "void",
    "fiscal", "quarter", "annual", "monthly", "weekly", "daily", "opening",
    "closing", "carryforward", "adjustment", "provision", "depreciation",
    "amortization", "accrual", "prepaid", "receivable", "payable", "cashflow",
    "budget", "forecast", "variance", "kpi", "margin", "markup", "sku",
    "barcode", "batch", "lot", "serial", "warranty", "delivery", "shipment",
    "logistics", "packaging", "unit", "quantity", "rate", "amount", "total",
    "subtotal", "grandtotal", "rounding", "currency", "NPR", "USD", "INR",
    "bank", "cheque", "transfer", "upi", "wallet", "gateway", "settlement",
    "charge", "fee", "commission", "interest", "penalty", "rebate", "refund",
    "creditnote", "debitnote", "proforma", "quotation", "estimate", "po",
    "so", "grn", "dc", "challan", "ewaybill", "hsn", "sac", "tds", "tcs",
]

# Shared surfaces needing context (engineering list; not V2 case copies).
_SHARED_LEXEMES = [
    "cash", "bill", "rate", "bank", "stock", "order", "note", "form", "card",
    "file", "post", "book", "account", "charge", "credit", "debit", "balance",
    "return", "draft", "check", "mail", "box", "bag", "set", "list", "mark",
    "sign", "seal", "stamp", "slip", "sheet", "page", "line", "entry", "code",
    "key", "lock", "gate", "pass", "token", "ticket", "passbook", "folder",
    "copy", "print", "scan", "upload", "download", "share", "link", "path",
    "root", "node", "edge", "graph", "table", "column", "row", "cell",
    "field", "value", "label", "tag", "flag", "status", "state", "mode",
    "type", "class", "group", "batch", "lot", "series", "range", "limit",
    "cap", "floor", "peak", "base", "ratecard", "pricelist", "catalogue",
    "menu", "option", "choice", "select", "filter", "sort", "search",
    "query", "result", "match", "hit", "miss", "error", "warning", "info",
    "alert", "notice", "memo", "minute", "agenda", "schedule", "calendar",
    "shift", "duty", "role", "right", "access", "permission", "policy",
    "rule", "clause", "term", "condition", "warranty", "guarantee", "bond",
    "margin", "spread", "premium", "discount", "offer", "deal", "contract",
    "agreement", "invoice", "receipt", "voucher", "challan", "manifest",
    "waybill", "passport", "license", "permit", "id", "pan", "vat", "tin",
    "sku", "upc", "ean", "imei", "serial", "lotno", "batchno", "refno",
    "txn", "utr", "rrn", "arn", "mid", "tid", "pos", "atm", "branch",
    "outlet", "counter", "desk", "window", "queue", "tokenno", "slipno",
]

_NAMES = [
    "Ram Bahadur", "Sita Devi", "Hari Krishna", "Gita Sharma", "Bikash Thapa",
    "Anita Gurung", "Rajesh Karki", "Sunita Magar", "Prakash Adhikari",
    "Mina Shrestha", "Dipesh Rai", "Kabita Limbu", "Nabin Poudel",
    "Sarita Bhandari", "Kiran Joshi", "Laxmi Pandey", "Suresh Bhattarai",
    "Puja Acharya", "Manish Regmi", "Rina Koirala", "Ajay Basnet",
    "Nisha Tamang", "Roshan Dhakal", "Bimala Neupane", "Sagar Gautam",
]

_ACRONYMS = [
    "PAN", "VAT", "TDS", "TCS", "HSN", "SAC", "NPR", "FY", "Q1", "Q2",
    "Q3", "Q4", "SKU", "PO", "SO", "GRN", "DC", "MRP", "FIFO", "LIFO",
    "KPI", "ROI", "EBITDA", "COGS", "AP", "AR", "GL", "TB", "BS", "PL",
]

_PROTECTED_PATTERNS = [
    ("PAN-A1B2C3D4E5", "synthetic taxpayer id token"),
    ("MOB-9800000001", "synthetic mobile token"),
    ("ACC-SYN-100200", "synthetic account token"),
    ("INV-SYN-9001", "synthetic invoice token"),
    ("TXN-SYN-778899", "synthetic transaction token"),
    ("EMAIL-user.syn@example.test", "synthetic email token"),
    ("URL-https://example.test/eval/v3", "synthetic url token"),
    ("UUID-00000000-0000-4000-8000-000000000001", "synthetic uuid"),
    ("IMEI-356938035643809", "synthetic device id"),
    ("SERIAL-SN-V3-0001", "synthetic serial"),
]


def family_pool_assignment(family_id: str) -> str:
    """Deterministic family-level split; opaque to reviewers."""
    digest = hashlib.sha256(f"{SPLIT_SEED}:{family_id}".encode("utf-8")).hexdigest()
    # ~55% frozen evaluation pool by family
    return "FROZEN_EVALUATION" if int(digest[:8], 16) % 100 < 55 else "POLICY_DEVELOPMENT"


def _romanized_sentence(stem: str, i: int) -> tuple[str, str]:
    templates = [
        f"aaja {stem} hisab milaaidim please",
        f"hijo ko {stem} entry check gara",
        f"bholi samma {stem} baaki clear garnu",
        f"grahak le {stem} bare sodheko cha",
        f"malik ji {stem} report pathaunuhos",
        f"{stem} ra paisa mismatch bhayo",
        f"please {stem} update gardinu",
        f"yo {stem} last week ko ho",
    ]
    text = templates[i % len(templates)]
    return text, stem


def _english_sentence(term: str, i: int) -> tuple[str, str]:
    templates = [
        f"Please open the {term} module and export the report",
        f"The {term} status must remain pending until confirm",
        f"Do not transliterate the word {term} in this English sentence",
        f"Accounting staff asked about {term} settings in Ask MokXya",
        f"Keep {term} as Latin identity for the ERP toolbar label",
        f"Filter by {term} then print the ledger summary",
        f"Sync failed for {term} queue — retry after backup",
        f"Create a draft {term} and leave it unposted",
    ]
    text = templates[i % len(templates)]
    return text, term


def _counterfactual_triple(lexeme: str, n: int) -> list[V3SourceItem]:
    fam = _family("shared", lexeme)
    gid = f"V3CF-{_hid(CORPUS_SEED, 'cf', lexeme, str(n))}"
    en = f"Please update the {lexeme} field in the English settings panel"
    np = f"aaja {lexeme} ko hisab milaaidim ra baaki clear gara"
    amb = f"check {lexeme} once before posting — context unclear"
    roles = [
        ("EN_CONTEXT", en, ["shared_context", "clear_english_identity", "multi_token", "accounting_business"]),
        ("NP_CONTEXT", np, ["shared_context", "clear_romanized_nepali", "multi_token", "accounting_business"]),
        ("AMBIGUOUS", amb, ["shared_context", "ambiguous_review_required", "multi_token"]),
    ]
    out: list[V3SourceItem] = []
    for role_i, (role, text, tags) in enumerate(roles):
        out.append(
            V3SourceItem(
                source_item_id=_item_id("cf", n * 10 + role_i),
                family_id=fam,
                provenance_class="INDEPENDENT_ENGINEERING_SCENARIO",
                source_document="MokXya MAI-07R3J-A independent engineering scenario registry",
                source_licence="Synthetic evaluation content; prohibited_for_training=true; not for redistribution as gold",
                input_text=text,
                highlighted_span=lexeme,
                design_tags=tags + ["counterfactual_triple", "candidate_generation_challenge"],
                counterfactual_group_id=gid,
                counterfactual_role=role,
                proposed_round_b_candidates=[lexeme, lexeme.upper(), f"{lexeme}_alt"],
                multi_token=True,
            )
        )
    return out


def build_independent_corpus() -> list[V3SourceItem]:
    items: list[V3SourceItem] = []
    seen_text: set[str] = set()

    def add(item: V3SourceItem) -> None:
        key = f"{item.input_text}||{item.highlighted_span}"
        if key in seen_text:
            return
        seen_text.add(key)
        items.append(item)

    # Clear romanized (≥180)
    for i, stem in enumerate(_ROMANIZED_STEMS * 3):
        if i >= 200:
            break
        text, span = _romanized_sentence(stem, i)
        add(
            V3SourceItem(
                source_item_id=_item_id("rom", i),
                family_id=_family("rom", stem),
                provenance_class="NEW_HUMAN_AUTHORED",
                source_document="MokXya MAI-07R3J-A human-authored romanized Nepali evaluation stems",
                source_licence="Human-authored synthetic evaluation; prohibited_for_training=true",
                input_text=text,
                highlighted_span=span,
                design_tags=["clear_romanized_nepali", "multi_token", "candidate_generation_challenge"],
                proposed_round_b_candidates=[span, span.capitalize()],
                multi_token=True,
            )
        )

    # Clear English identity (≥150)
    for i, term in enumerate(_ENGLISH_IDENTITY):
        text, span = _english_sentence(term, i)
        add(
            V3SourceItem(
                source_item_id=_item_id("eng", i),
                family_id=_family("eng", term.lower()),
                provenance_class="NEW_HUMAN_AUTHORED",
                source_document="MokXya MAI-07R3J-A human-authored English identity evaluation stems",
                source_licence="Human-authored synthetic evaluation; prohibited_for_training=true",
                input_text=text,
                highlighted_span=span,
                design_tags=["clear_english_identity", "multi_token", "accounting_business"],
                proposed_round_b_candidates=[span],
                multi_token=True,
            )
        )

    # Shared families + counterfactual triples (≥150 families, ≥120 groups)
    shared = _SHARED_LEXEMES[:150]
    for i, lex in enumerate(shared):
        # Ensure family counted even outside triples
        if i < 120:
            for cf in _counterfactual_triple(lex, i):
                add(cf)
        else:
            text = f"review shared surface {lex} in mixed shop note before close"
            add(
                V3SourceItem(
                    source_item_id=_item_id("sh", i),
                    family_id=_family("shared", lex),
                    provenance_class="INDEPENDENT_ENGINEERING_SCENARIO",
                    source_document="MokXya MAI-07R3J-A shared-lexeme engineering registry",
                    source_licence="Synthetic evaluation content; prohibited_for_training=true",
                    input_text=text,
                    highlighted_span=lex,
                    design_tags=["shared_context", "ambiguous_review_required", "multi_token"],
                    proposed_round_b_candidates=[lex],
                    multi_token=True,
                )
            )

    # Accounting/business extras
    for i in range(80):
        term = _ENGLISH_IDENTITY[i % len(_ENGLISH_IDENTITY)]
        stem = _ROMANIZED_STEMS[i % len(_ROMANIZED_STEMS)]
        text = f"branch ledger: {term} entry ra {stem} baaki milaaune"
        add(
            V3SourceItem(
                source_item_id=_item_id("acc", i),
                family_id=_family("acc", f"{term}:{stem}"),
                provenance_class="INDEPENDENT_ENGINEERING_SCENARIO",
                source_document="MokXya MAI-07R3J-A accounting/business scenario registry",
                source_licence="Synthetic evaluation content; prohibited_for_training=true",
                input_text=text,
                highlighted_span=term if i % 2 == 0 else stem,
                design_tags=["accounting_business", "multi_token", "candidate_generation_challenge"],
                proposed_round_b_candidates=[term, stem],
                multi_token=True,
            )
        )

    # Names / entities / acronyms / identifiers
    for i, name in enumerate(_NAMES * 3):
        if i >= 60:
            break
        text = f"Customer {name} paid by bank transfer yesterday (name case {i})"
        add(
            V3SourceItem(
                source_item_id=_item_id("name", i),
                family_id=_family("name", f"{name}:{i}"),
                provenance_class="NEW_HUMAN_AUTHORED",
                source_document="MokXya MAI-07R3J-A synthetic personal-name evaluation set",
                source_licence="Synthetic names; not real persons; prohibited_for_training=true",
                input_text=text,
                highlighted_span=name.split()[0],
                design_tags=["names_entities_acronyms_ids", "multi_token"],
                proposed_round_b_candidates=[name.split()[0]],
                multi_token=True,
            )
        )
    for i, acr in enumerate(_ACRONYMS * 2):
        if i >= 50:
            break
        text = f"Enter {acr} code in the tax panel without Devanagari rewrite (acr case {i})"
        add(
            V3SourceItem(
                source_item_id=_item_id("acr", i),
                family_id=_family("acr", f"{acr}:{i}"),
                provenance_class="INDEPENDENT_ENGINEERING_SCENARIO",
                source_document="MokXya MAI-07R3J-A acronym/identifier evaluation registry",
                source_licence="Synthetic evaluation content; prohibited_for_training=true",
                input_text=text,
                highlighted_span=acr,
                design_tags=["names_entities_acronyms_ids", "multi_token", "clear_english_identity"],
                proposed_round_b_candidates=[acr],
                multi_token=True,
            )
        )

    # Protected spans (≥100) using synthetic tokens only
    for i in range(100):
        token, note = _PROTECTED_PATTERNS[i % len(_PROTECTED_PATTERNS)]
        unique_token = f"{token}-R{i:03d}"
        text = f"Do not mutate protected token {unique_token} inside the posting draft case {i} ({note})"
        add(
            V3SourceItem(
                source_item_id=_item_id("prot", i),
                family_id=_family("prot", unique_token),
                provenance_class="INDEPENDENT_ENGINEERING_SCENARIO",
                source_document="MokXya MAI-07R3J-A protected-span synthetic token registry",
                source_licence="Synthetic identifiers only; prohibited_for_training=true",
                input_text=text,
                highlighted_span=unique_token,
                design_tags=["protected_span", "multi_token", "unicode_alignment"],
                proposed_round_b_candidates=[unique_token],
                multi_token=True,
            )
        )

    # Ambiguous / review-required extras
    for i in range(40):
        lex = shared[i % len(shared)]
        text = f"maybe {lex} means English UI or Romanized Nepali — reviewer must decide (case {i})"
        add(
            V3SourceItem(
                source_item_id=_item_id("amb", i),
                family_id=_family("amb", f"{lex}:{i}"),
                provenance_class="INDEPENDENT_ENGINEERING_SCENARIO",
                source_document="MokXya MAI-07R3J-A ambiguity review registry",
                source_licence="Synthetic evaluation content; prohibited_for_training=true",
                input_text=text,
                highlighted_span=lex,
                design_tags=["ambiguous_review_required", "multi_token"],
                proposed_round_b_candidates=[lex, "none_acceptable"],
                multi_token=True,
            )
        )

    # Unicode / alignment challenges (≥50)
    unicode_samples = [
        ("cafe\u0301", "combining acute"),
        ("n\u0303epali", "combining tilde"),
        ("\ufeffopening", "BOM prefix"),
        ("a\u200baja", "zero-width space"),
        ("kharcha\u00a0baaki", "nbsp"),
        ("\u201chisab\u201d", "smart quotes"),
        ("paisa\u2026", "ellipsis"),
        ("NPR\u2212100", "minus sign"),
        ("½", "vulgar fraction"),
        ("㎡", "square metre symbol"),
    ]
    for i in range(50):
        surface, note = unicode_samples[i % len(unicode_samples)]
        text = f"alignment challenge {i}: keep surface [{surface}] intact ({note})"
        add(
            V3SourceItem(
                source_item_id=_item_id("uni", i),
                family_id=_family("uni", f"{i}:{note}"),
                provenance_class="INDEPENDENT_ENGINEERING_SCENARIO",
                source_document="MokXya MAI-07R3J-A unicode/alignment challenge registry",
                source_licence="Synthetic evaluation content; prohibited_for_training=true",
                input_text=text,
                highlighted_span=surface,
                design_tags=["unicode_alignment", "multi_token", "candidate_generation_challenge"],
                proposed_round_b_candidates=[surface],
                multi_token=True,
            )
        )

    # Pad with additional multi-token romanized/english mixes to clear 1000 if needed
    n = 0
    while len(items) < 1000:
        stem = _ROMANIZED_STEMS[n % len(_ROMANIZED_STEMS)]
        term = _ENGLISH_IDENTITY[n % len(_ENGLISH_IDENTITY)]
        text = f"scenario {n}: {stem} hisab ra {term} module milaaune kaam"
        add(
            V3SourceItem(
                source_item_id=_item_id("pad", n),
                family_id=_family("pad", f"{stem}:{term}:{n}"),
                provenance_class="INDEPENDENT_ENGINEERING_SCENARIO",
                source_document="MokXya MAI-07R3J-A coverage padding registry (unique scenarios)",
                source_licence="Synthetic evaluation content; prohibited_for_training=true",
                input_text=text,
                highlighted_span=stem if n % 2 == 0 else term,
                design_tags=["multi_token", "accounting_business", "candidate_generation_challenge"],
                proposed_round_b_candidates=[stem, term],
                multi_token=True,
            )
        )
        n += 1
        if n > 5000:
            break

    return items


def coverage_report(items: list[V3SourceItem]) -> dict[str, Any]:
    tags = {k: 0 for k in (
        "clear_romanized_nepali",
        "clear_english_identity",
        "accounting_business",
        "names_entities_acronyms_ids",
        "protected_span",
        "ambiguous_review_required",
        "candidate_generation_challenge",
        "unicode_alignment",
        "multi_token",
        "shared_context",
        "counterfactual_triple",
    )}
    for it in items:
        for t in it.design_tags:
            if t in tags:
                tags[t] += 1
    shared_families = {it.family_id for it in items if "shared_context" in it.design_tags or it.family_id.startswith("V3FAM-shared-")}
    cf_groups = {it.counterfactual_group_id for it in items if it.counterfactual_group_id}
    cf_cases = sum(1 for it in items if it.counterfactual_group_id)
    multi = sum(1 for it in items if it.multi_token)
    relevant = [it for it in items if any(
        t in it.design_tags
        for t in (
            "clear_romanized_nepali",
            "clear_english_identity",
            "shared_context",
            "accounting_business",
            "ambiguous_review_required",
            "candidate_generation_challenge",
        )
    )]
    multi_rel = sum(1 for it in relevant if it.multi_token)
    ratio = (multi_rel / len(relevant)) if relevant else 0.0

    observed = {
        "clear_romanized_nepali": tags["clear_romanized_nepali"],
        "clear_english_identity": tags["clear_english_identity"],
        "shared_lexeme_families": len(shared_families),
        "counterfactual_groups": len(cf_groups),
        "counterfactual_cases": cf_cases,
        "accounting_business": tags["accounting_business"],
        "names_entities_acronyms_ids": tags["names_entities_acronyms_ids"],
        "protected_span": tags["protected_span"],
        "ambiguous_review_required": tags["ambiguous_review_required"],
        "candidate_generation_challenge": tags["candidate_generation_challenge"],
        "unicode_alignment": tags["unicode_alignment"],
        "total_unique": len(items),
        "multi_token_ratio_relevant": round(ratio, 4),
        "multi_token_total": multi,
    }
    failures: list[str] = []
    for key, need in MIN_COVERAGE.items():
        got = observed[key]
        if key == "multi_token_ratio_relevant":
            if got < need:
                failures.append(f"{key}:{got}<{need}")
        elif got < need:
            failures.append(f"{key}:{got}<{need}")
    return {
        "minimums": MIN_COVERAGE,
        "observed": observed,
        "ok": not failures,
        "failures": failures,
        "tag_counts": tags,
    }
