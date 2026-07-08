"""
Comprehensive Chart of Accounts framework for Nepali businesses (all sectors).

Structured knowledge for NLU alias resolution, sector detection, and LLM context.
Regulatory context: NFRS, NFRS for SMEs, NAS Micro, NRB, NIA, SEBON/NEPSE, IRD VAT/Income Tax.
"""

from __future__ import annotations

import re
from typing import Any


def _term_in_query(alias: str, q: str) -> bool:
    alias = alias.strip().lower()
    if not alias:
        return False
    if " " in alias:
        return alias in q
    return bool(re.search(rf"\b{re.escape(alias)}\b", q))

# ── Five universal elements ───────────────────────────────────────────────────

UNIVERSAL_ELEMENTS = (
    "Assets (sampatti), Liabilities (dayitwo/rin), Equity (puni/punji), "
    "Income (aamdani/revenue), Expenses (kharcha/losses)"
)

REGULATORY_FRAMEWORKS = (
    "NFRS (large/listed), NFRS for SMEs (medium), NAS Micro Entities (very small), "
    "NRB Unified Directives (banks/FIs), NIA (insurance), SEBON/NEPSE/CDSC (capital market), "
    "Income Tax Act 2058, VAT Act (IRD), SSF Act 2074, Labour Act 2074, Bonus Act"
)

# ── Universal accounts with Nepali/English aliases (for language understanding) ──

UNIVERSAL_ACCOUNTS: list[dict[str, Any]] = [
    {
        "category": "current_asset",
        "canonical": "Cash in hand",
        "aliases": (
            "cash balance petty cash till money nagad hath ma cash cash in hand "
            "nagad kosh petty cash fund"
        ),
        "nepali": "Hath ma nagad / petty cash",
    },
    {
        "category": "current_asset",
        "canonical": "Cash at bank",
        "aliases": (
            "bank balance current account savings account bank ma paisa "
            "bank khata current account savings"
        ),
        "nepali": "Bank ma rakam",
    },
    {
        "category": "current_asset",
        "canonical": "Accounts receivable",
        "aliases": (
            "debtors sundry debtors trade receivable customer dues bill receivable "
            "udhaar linu parne party ko paisa asuli receivable khata udharo "
            "party bata paune paisa"
        ),
        "nepali": "Asuli / Debtors / udhaar linu parne",
    },
    {
        "category": "current_asset",
        "canonical": "Inventory / Stock",
        "aliases": (
            "stock inventory stock-in-trade finished goods raw material wip "
            "work in progress consumables stores spares packing material "
            "saman mal stock godown ma saman raw material finished goods "
            "opening stock closing stock suruwati stock antim stock"
        ),
        "nepali": "Saman / mal / stock / inventory",
    },
    {
        "category": "current_asset",
        "canonical": "Prepaid expenses",
        "aliases": "prepaid advance expenses unexpired agadi tirya prepaid rent prepaid insurance advance kharcha",
        "nepali": "Agadi tirya kharcha",
    },
    {
        "category": "current_asset",
        "canonical": "Input VAT / VAT receivable",
        "aliases": "input vat vat receivable vat recoverable input tax credit vat credit",
        "nepali": "Input VAT / prapta VAT",
    },
    {
        "category": "current_asset",
        "canonical": "TDS receivable / Advance tax",
        "aliases": "tds receivable withholding tax recoverable advance tax advance income tax",
        "nepali": "TDS prapta / advance tax",
    },
    {
        "category": "fixed_asset",
        "canonical": "Fixed assets / PPE",
        "aliases": (
            "land building plant machinery furniture fixtures office equipment "
            "vehicles motor vehicle fixed asset jamin ghar factory building "
            "gadi computer furniture"
        ),
        "nepali": "Sthayi sampatti / fixed asset",
    },
    {
        "category": "fixed_asset",
        "canonical": "Intangible assets",
        "aliases": "goodwill patent trademark software license franchise brand value",
        "nepali": "Abhautik sampatti",
    },
    {
        "category": "current_liability",
        "canonical": "Accounts payable",
        "aliases": (
            "creditors sundry creditors trade payable supplier dues bills payable "
            "diney paisa supplier lai dine udhaar kharid credit purchase payable "
            "mahajani dealer credit"
        ),
        "nepali": "Creditors / diney paisa",
    },
    {
        "category": "current_liability",
        "canonical": "Output VAT payable",
        "aliases": "output vat vat payable vat dine sales tax payable",
        "nepali": "Output VAT / diney VAT",
    },
    {
        "category": "current_liability",
        "canonical": "TDS payable",
        "aliases": "tds payable withholding tax payable kataune tax",
        "nepali": "TDS diney",
    },
    {
        "category": "current_liability",
        "canonical": "Salary payable",
        "aliases": "salary payable wages payable staff salary bonus payable talab diney",
        "nepali": "Talab diney / salary payable",
    },
    {
        "category": "current_liability",
        "canonical": "Customer advance / Unearned revenue",
        "aliases": "advance from customer customer deposit deferred revenue unearned agadi paisa",
        "nepali": "Customer bata agadi paisa",
    },
    {
        "category": "non_current_liability",
        "canonical": "Long-term loan",
        "aliases": "term loan bank loan borrowing rin long term debt debenture bond",
        "nepali": "Lambkaalin rin / term loan",
    },
    {
        "category": "non_current_liability",
        "canonical": "Gratuity provision",
        "aliases": "gratuity payable leave encashment employee benefit gratuity provision",
        "nepali": "Gratuity provision",
    },
    {
        "category": "equity",
        "canonical": "Share capital / Capital",
        "aliases": "capital share capital paid up capital punji owner capital malik ko punji",
        "nepali": "Punji / capital",
    },
    {
        "category": "equity",
        "canonical": "Drawings",
        "aliases": "drawings owner withdrawal nikasi malik le nikale personal use",
        "nepali": "Nikasi / drawings",
    },
    {
        "category": "equity",
        "canonical": "Retained earnings",
        "aliases": "retained earnings accumulated profit accumulated loss nafa jama",
        "nepali": "Jama nafa / retained earnings",
    },
    {
        "category": "income",
        "canonical": "Sales revenue",
        "aliases": "sales turnover net sales gross sales bikri aamdani sales revenue becheko",
        "nepali": "Bikri / sales / turnover",
    },
    {
        "category": "income",
        "canonical": "Service income",
        "aliases": "service revenue fee income sewa aamdani commission income",
        "nepali": "Sewa aamdani",
    },
    {
        "category": "income",
        "canonical": "Interest income",
        "aliases": "interest received interest earned byaj aamdani",
        "nepali": "Byaj aamdani",
    },
    {
        "category": "expense",
        "canonical": "Cost of goods sold",
        "aliases": "cogs cost of sales cost of merchandise kharidya saman ko mulya",
        "nepali": "Bikri gareko saman ko laagat / COGS",
    },
    {
        "category": "expense",
        "canonical": "Salary expense",
        "aliases": "salary wages staff salary employee benefit talab kharcha",
        "nepali": "Talab kharcha",
    },
    {
        "category": "expense",
        "canonical": "Rent expense",
        "aliases": "rent office rent shop rent godown rent bhada kiraya",
        "nepali": "Bhada / rent",
    },
    {
        "category": "expense",
        "canonical": "Depreciation",
        "aliases": "depreciation wear and tear ghasai mulya ghataunu",
        "nepali": "Depreciation / ghasai",
    },
    {
        "category": "expense",
        "canonical": "Bad debts",
        "aliases": "bad debt doubtful debt write off udhaar nash garnu",
        "nepali": "Nash bhayeko udhaar",
    },
    {
        "category": "expense",
        "canonical": "Interest expense",
        "aliases": "interest on loan finance cost borrowing cost byaj kharcha",
        "nepali": "Byaj kharcha / interest expense",
    },
]

# ── Sector definitions (19 major Nepali business categories) ─────────────────

SECTORS: list[dict[str, Any]] = [
    {
        "id": "retail_kirana",
        "name": "Retail / Kirana / General merchandise",
        "keywords": "kirana pasal shop retail general store mahajani khata bill book",
        "unique_terms": (
            "opening stock closing stock cash sales credit sales khata udhaar to regular customers, "
            "shop rent municipality tax, sole prop drawings mixed with personal funds, "
            "low materiality — small fridge/furniture may be expensed not capitalized"
        ),
    },
    {
        "id": "wholesale_trading",
        "name": "Wholesale / Trading / Distribution",
        "keywords": "wholesale distributor dealer godown warehouse consignment freight carriage",
        "unique_terms": (
            "freight-in (cost of purchase) vs freight-out (selling expense), trade discount vs cash discount, "
            "consignment inventory (consignor asset not consignee), stock-in-transit, agency commission"
        ),
    },
    {
        "id": "manufacturing",
        "name": "Manufacturing",
        "keywords": "factory production cement steel garment pharma fmcg manufacturing wip",
        "unique_terms": (
            "raw material WIP finished goods, direct material direct labor factory overhead, "
            "cost of production, scrap wastage, packing forwarding, cement: limestone quarry royalty kiln fuel clinker"
        ),
    },
    {
        "id": "hospitality",
        "name": "Hotel / Restaurant / Tourism",
        "keywords": "hotel restaurant lodge trekking travel f&b room revenue banquet",
        "unique_terms": (
            "room revenue F&B revenue banquet laundry spa, housekeeping linen guest supplies, "
            "FF&E furniture fixtures equipment, trekking permit pass-through liability not revenue, "
            "service charge often liability to staff not pure income"
        ),
    },
    {
        "id": "banking",
        "name": "Banking / Financial institutions (NRB)",
        "keywords": "bank bfi nrb commercial bank development bank finance company microfinance loan advance deposit",
        "unique_terms": (
            "due from NRB, placement with BFIs, loans classified pass watchlist substandard doubtful loss, "
            "customer deposits current savings fixed, loan loss provision per NRB directive, "
            "interest income on loans fee commission forex trading, statutory general reserve CSR fund. "
            "Loans to customers = CORE OPERATING ASSET (like inventory to trader)"
        ),
    },
    {
        "id": "cooperative_mfi",
        "name": "Cooperatives / Microfinance",
        "keywords": "cooperative sahakari microfinance member share patronage",
        "unique_terms": "member share capital, member savings deposits, loan to members, patronage refund dividend, reserve fund Cooperative Act",
    },
    {
        "id": "insurance",
        "name": "Insurance (NIA)",
        "keywords": "insurance premium claim reinsurance policyholder life non-life",
        "unique_terms": (
            "gross written premium net premium, claims paid incurred, reinsurance premium ceded, "
            "life fund policyholder liability actuarial reserve, unearned premium reserve UPR, IBNR, "
            "reinsurance recoverable DAC. Premium RECEIVED = insurer REVENUE (not expense like for others)"
        ),
    },
    {
        "id": "investment_amc",
        "name": "Investment / Merchant bank / Mutual fund / AMC",
        "keywords": "mutual fund nav portfolio merchant bank underwriting asset management",
        "unique_terms": (
            "investment in shares = CORE OPERATING ASSET not passive holding, "
            "portfolio fee underwriting fee fund management fee, unrealized gain loss on securities, NAV per unit"
        ),
    },
    {
        "id": "brokerage",
        "name": "Stock market / Brokerage (SEBON NEPSE CDSC)",
        "keywords": "broker brokerage nepse sebon cdsc demat ipo fpo margin settlement",
        "unique_terms": (
            "brokerage commission split NEPSE SEBON, client margin deposit LIABILITY not broker asset, "
            "T+ settlement receivable payable, DP service charge, bonus shares zero cost rights shares CGT withheld"
        ),
    },
    {
        "id": "hydropower",
        "name": "Hydropower / Energy",
        "keywords": "hydropower power plant ppa nea generation kwh energy",
        "unique_terms": (
            "PPA revenue kWh NEA tariff, water resource royalty generation license, "
            "decommissioning provision, CWIP years before COD, interest during construction capitalized, "
            "USD JPY loan forex exposure. Water royalty = direct/production cost not generic tax"
        ),
    },
    {
        "id": "construction_realestate",
        "name": "Construction / Real estate",
        "keywords": "construction contractor real estate developer apartment retention",
        "unique_terms": (
            "percentage of completion contract revenue, retention money, construction WIP, "
            "land held for sale = INVENTORY not fixed asset for developers, advance from buyers deferred revenue"
        ),
    },
    {
        "id": "telecom_it",
        "name": "Telecom / IT / Software",
        "keywords": "telecom software spectrum license subscription saas network",
        "unique_terms": "spectrum license intangible, network infrastructure, interconnection revenue RTDF levy, capitalized software dev cost",
    },
    {
        "id": "transport_logistics",
        "name": "Transport / Logistics / Airlines",
        "keywords": "airline trucking logistics freight cargo ride sharing uber pathao",
        "unique_terms": (
            "freight cargo passenger ticket revenue, fuel often LARGEST expense, "
            "vehicle lease finance vs operating, maintenance reserve airlines, "
            "vehicles = PRIMARY revenue asset for transport companies"
        ),
    },
    {
        "id": "healthcare",
        "name": "Healthcare / Hospital / Pharmacy",
        "keywords": "hospital clinic pharmacy opd ipd diagnostic patient",
        "unique_terms": "patient service revenue OPD IPD lab, medical equipment depreciation, pharmacy inventory expiry provision, health insurance receivable",
    },
    {
        "id": "education",
        "name": "Education",
        "keywords": "school college tuition admission hostel training institute",
        "unique_terms": "tuition fee admission fee examination fee scholarship waiver contra-revenue, affiliation fee",
    },
    {
        "id": "agriculture",
        "name": "Agriculture / Livestock",
        "keywords": "agriculture livestock farm crop harvest biological standing crop",
        "unique_terms": "biological assets NFRS fair value, produce inventory seed fertilizer irrigation mortality loss subsidy",
    },
    {
        "id": "ngo",
        "name": "NGO / INGO / Non-profit",
        "keywords": "ngo ingo grant donor nonprofit fund restricted unrestricted",
        "unique_terms": "grant income donor funding not sales, restricted vs unrestricted fund, program vs admin expense, fund balance not retained earnings, in-kind donation",
    },
    {
        "id": "remittance",
        "name": "Remittance / Money transfer",
        "keywords": "remittance hundi money transfer exchange agent nostro vostro",
        "unique_terms": "remittance commission, exchange rate margin spread, agent network commission, nostro vostro correspondent accounts",
    },
    {
        "id": "media",
        "name": "Media / Broadcasting / Publishing",
        "keywords": "media broadcast advertisement subscription publishing journalism",
        "unique_terms": "advertisement revenue subscription revenue content production cost broadcasting license royalty to creators",
    },
]

# ── Cross-sector reclassification rules (same name, different meaning) ────────

RECLASSIFICATION_RULES: list[dict[str, str]] = [
    {
        "term": "loan given",
        "rule": (
            "Bank/MFI: loan to customer = core operating asset (current/non-current). "
            "Manufacturer/trader: employee/related party loan = minor receivable."
        ),
    },
    {
        "term": "building",
        "rule": (
            "Manufacturer/hotel: building = fixed asset (used in operations). "
            "Real estate developer: buildings for sale = INVENTORY (current asset)."
        ),
    },
    {
        "term": "investment in shares",
        "rule": (
            "Manufacturer: long-term strategic investment. "
            "Mutual fund/broker/merchant bank: shares = core operating asset (inventory-equivalent), actively traded."
        ),
    },
    {
        "term": "insurance premium",
        "rule": (
            "Manufacturing company paying fire insurance = EXPENSE. "
            "Insurance company receiving premium = REVENUE (core income)."
        ),
    },
    {
        "term": "vehicle / fuel",
        "rule": (
            "Most companies: vehicle = fixed asset, fuel = operating expense. "
            "Transport/logistics/airline: vehicles = primary revenue asset; fuel often largest cost line."
        ),
    },
    {
        "term": "foreign currency loan",
        "rule": (
            "Domestic retailer: rare long-term liability. "
            "Hydropower/airline/import-heavy mfg: major liability with active forex gain/loss monitoring."
        ),
    },
    {
        "term": "gratuity / leave",
        "rule": (
            "Small trader: may expense on cash basis under SME/micro threshold. "
            "Banks/insurers: actuarial valuation, split current vs non-current portions."
        ),
    },
]

STATUTORY_NEPAL = (
    "Universal statutory: VAT 13% input credit output liability; TDS on rent 10% service commission contract interest; "
    "SSF employee 10% + employer 11% (replacing PF/gratuity for many); Bonus Act profit-linked bonus; "
    "CIT 25% standard (30% banks/cigarette/liquor, lower/exempt priority sectors); CGT on land shares; "
    "municipal Palika business tax property tax vehicle tax"
)

_master_coa_index: list[tuple[str, dict[str, Any]]] | None = None


def _load_master_sme_coa_index() -> list[tuple[str, dict[str, Any]]]:
    """Load numbered Nepal SME COA (Phase 2) alias index from tiered knowledge file."""
    global _master_coa_index
    if _master_coa_index is not None:
        return _master_coa_index
    from pathlib import Path

    from ..config import ERP_PATH

    path = (
        ERP_PATH
        / "data"
        / "ekhata"
        / "knowledge"
        / "professional"
        / "sector"
        / "coa"
        / "nepal-sme-coa-aliases.jsonl"
    )
    rows: list[tuple[str, dict[str, Any]]] = []
    if path.exists():
        import json

        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            raw = json.loads(line)
            acct = {
                "canonical": _master_coa_canonical(raw),
                "category": (raw.get("account_type") or "account").lower(),
                "nepali": raw.get("account_name_np") or "",
                "account_id": raw.get("account_id"),
                "normal_balance": raw.get("normal_balance"),
                "source": "master-coa-phase2",
            }
            for alias in raw.get("aliases_flat") or []:
                if len(alias) >= 2:
                    rows.append((alias, acct))
    _master_coa_index = rows
    return rows


def _master_coa_canonical(raw: dict[str, Any]) -> str:
    aid = str(raw.get("account_id") or "")
    name = raw.get("account_name_en") or ""
    if not name:
        title = str(raw.get("title") or "")
        name = title.split(" ", 1)[1] if " " in title else title
    return f"{aid} {name}".strip()


def _alias_matches_phrase(alias: str, q: str) -> bool:
    """Match shopkeeper phrases — substring and multi-token overlap."""
    if _term_in_query(alias, q):
        return True
    alias = alias.strip().lower()
    if len(alias) >= 5 and alias in q:
        return True
    stop = {"ko", "le", "ma", "bata", "lagi", "diyeko", "tireko", "bhayo", "cha"}
    words = [w for w in alias.split() if len(w) >= 3 and w not in stop]
    if len(words) >= 2:
        hits = sum(1 for w in words if w in q)
        if hits >= min(2, len(words)):
            return True
    return False


def lookup_master_coa_account(text: str, *, limit: int = 6) -> list[dict[str, Any]]:
    """Match user text to numbered SME chart of accounts (1001–6021)."""
    t = (text or "").lower()
    if not t:
        return []
    seen: set[str] = set()
    results: list[dict[str, Any]] = []
    for alias, acct in _load_master_sme_coa_index():
        if acct["account_id"] in seen:
            continue
        if _alias_matches_phrase(alias, t):
            seen.add(acct["account_id"])
            results.append(acct)
            if len(results) >= limit:
                break
    return results


def _alias_index() -> list[tuple[str, dict[str, Any]]]:
    """Build flat (alias_token, account_record) index once."""
    if hasattr(_alias_index, "_cache"):
        return _alias_index._cache  # type: ignore[attr-defined]
    rows: list[tuple[str, dict[str, Any]]] = []
    for acct in UNIVERSAL_ACCOUNTS:
        for token in (acct.get("aliases") or "").split():
            if len(token) >= 2:
                rows.append((token.lower(), acct))
        rows.append((acct["canonical"].lower(), acct))
    _alias_index._cache = rows  # type: ignore[attr-defined]
    return rows


def detect_sector(text: str) -> dict[str, Any] | None:
    """Best-match sector from user message keywords."""
    t = (text or "").lower()
    best: dict[str, Any] | None = None
    best_score = 0
    for sector in SECTORS:
        score = sum(1 for kw in sector["keywords"].split() if kw in t)
        if score > best_score:
            best_score = score
            best = sector
    return best if best_score >= 1 else None


def lookup_account_terms(text: str, *, limit: int = 8) -> list[dict[str, Any]]:
    """Find universal account definitions matching words in user text."""
    t = (text or "").lower()
    if not t:
        return []
    seen: set[str] = set()
    results: list[dict[str, Any]] = []
    for alias, acct in _alias_index():
        if _term_in_query(alias, t) and acct["canonical"] not in seen:
            seen.add(acct["canonical"])
            results.append(acct)
            if len(results) >= limit:
                break
    # Multi-word alias scan
    for acct in UNIVERSAL_ACCOUNTS:
        if acct["canonical"] in seen:
            continue
        aliases = (acct.get("aliases") or "").lower()
        for phrase in ("sundry debtors", "sundry creditors", "cost of goods", "input vat", "output vat"):
            if phrase in t and phrase in aliases:
                seen.add(acct["canonical"])
                results.append(acct)
                break
    # Master numbered COA (Phase 2) — higher specificity for SME retail
    for acct in lookup_master_coa_account(text, limit=limit):
        key = acct.get("account_id") or acct["canonical"]
        if key not in seen:
            seen.add(key)
            results.append(acct)
            if len(results) >= limit:
                break
    return results[:limit]


def get_reclassification_hints(text: str) -> list[str]:
    """Return cross-sector rules relevant to ambiguous terms in query."""
    t = (text or "").lower()
    hints: list[str] = []
    triggers = {
        "loan": "loan given",
        "rin": "loan given",
        "building": "building",
        "ghar": "building",
        "share": "investment in shares",
        "premium": "insurance premium",
        "bima": "insurance premium",
        "vehicle": "vehicle / fuel",
        "gadi": "vehicle / fuel",
        "fuel": "vehicle / fuel",
        "petrol": "vehicle / fuel",
        "forex": "foreign currency loan",
        "gratuity": "gratuity / leave",
    }
    for key, term_key in triggers.items():
        if key in t:
            for rule in RECLASSIFICATION_RULES:
                if rule["term"] == term_key:
                    hints.append(f"{rule['term']}: {rule['rule']}")
                    break
    return hints


def format_coa_context(query: str, *, max_chars: int = 1800) -> str:
    """Format sector + account + reclassification context for LLM/NLU."""
    parts: list[str] = []
    sector = detect_sector(query)
    if sector:
        parts.append(f"[SECTOR: {sector['name']}]")
        parts.append(sector["unique_terms"])

    accounts = lookup_account_terms(query)
    if accounts:
        parts.append("[ACCOUNT TERMS MATCHED]")
        for acct in accounts[:6]:
            acct_id = acct.get("account_id")
            label = acct["canonical"]
            if acct_id:
                label = f"{acct_id} {label.split(' ', 1)[-1] if ' ' in label else label}"
            parts.append(f"• {label} ({acct['category']}): {acct.get('nepali', '')}")

    hints = get_reclassification_hints(query)
    if hints:
        parts.append("[CROSS-SECTOR RECLASSIFICATION]")
        parts.extend(f"• {h}" for h in hints[:4])

    if not parts:
        parts.append(f"[UNIVERSAL ELEMENTS] {UNIVERSAL_ELEMENTS}")
        parts.append(f"[REGULATORY] {REGULATORY_FRAMEWORKS}")

    parts.append(f"[STATUTORY NEPAL] {STATUTORY_NEPAL}")
    text = "\n".join(parts)
    return text[:max_chars] if len(text) > max_chars else text


def get_nlu_vocabulary_summary() -> str:
    """Compact vocabulary block for NLU LLM system prompt."""
    try:
        from .vocabulary_loader import build_nlu_vocabulary_summary

        summary = build_nlu_vocabulary_summary()
        if summary:
            return summary
    except Exception:
        pass
    lines = [
        "CHART OF ACCOUNTS — Nepali/English alias map (understand ALL variants):",
        "Assets: nagad=cash, bank=bank, asuli/debtors= receivable, saman/mal/stock=inventory, jamin/building=land/building",
        "Liabilities: creditors/diney=payable, udhaar kineko=credit purchase payable, talab diney=salary payable",
        "Equity: punji=capital, nikasi/drawings=owner withdrawal",
        "Income: bikri/sales/turnover=revenue, byaj aamdani=interest income, sewa=fee income",
        "Expense: kharcha=expense, talab=salary, bhada/kiraya=rent, bijuli=electricity, byaj kharcha=interest expense",
        "Statutory: VAT 13%, TDS kataunu, SSF 10%+11%, gratuity, bonus act",
        "SECTOR AWARENESS: same word changes meaning — bank loan GIVEN=asset for bank, liability for borrower; "
        "premium=expense for factory, revenue for insurer; shares=investment vs trading inventory for fund/broker",
    ]
    return "\n".join(lines)


def coa_documents_for_rag() -> list[dict[str, Any]]:
    """Chunk COA framework for hybrid RAG indexing on startup."""
    docs: list[dict[str, Any]] = []
    docs.append(
        {
            "id": "coa-universal",
            "text": f"Universal elements: {UNIVERSAL_ELEMENTS}. Frameworks: {REGULATORY_FRAMEWORKS}. {STATUTORY_NEPAL}",
            "metadata": {"source": "coa-framework", "section": "universal"},
        }
    )
    for acct in UNIVERSAL_ACCOUNTS:
        docs.append(
            {
                "id": f"coa-acct-{acct['canonical'][:30].replace(' ', '-')}",
                "text": (
                    f"{acct['canonical']} ({acct['category']}): aliases {acct.get('aliases', '')}. "
                    f"Nepali: {acct.get('nepali', '')}"
                ),
                "metadata": {"source": "coa-framework", "section": "account", "category": acct["category"]},
            }
        )
    for sector in SECTORS:
        docs.append(
            {
                "id": f"coa-sector-{sector['id']}",
                "text": f"Sector {sector['name']}. Keywords: {sector['keywords']}. {sector['unique_terms']}",
                "metadata": {"source": "coa-framework", "section": "sector", "sector_id": sector["id"]},
            }
        )
    for i, rule in enumerate(RECLASSIFICATION_RULES):
        docs.append(
            {
                "id": f"coa-reclass-{i}",
                "text": f"Reclassification: {rule['term']}. {rule['rule']}",
                "metadata": {"source": "coa-framework", "section": "reclassification"},
            }
        )
    return docs
