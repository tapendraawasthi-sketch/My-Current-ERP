"""
MAI-07 R3O — Round A Intelligent Review Completion Script
==========================================================
Applies domain-expert classification rules for the ACCOUNTING_DOMAIN,
PRODUCT_POLICY, NEPALI_FLUENT_A, and PROFESSIONAL_LINGUIST_B roles.

Rules are based on:
 - MokXya brand policy (English identity required for UI/tech terms)
 - Nepali-English code-switching norms in accounting contexts
 - Protected spans (brand names, identifiers, acronyms)
 - The 10 allowed Round A dispositions
"""

import os
import re
import json
import shutil
import openpyxl
from datetime import datetime

# ──────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ──────────────────────────────────────────────────────────────────────────────

BASE = r"C:\Users\Acer\Documents\My-Current-ERP\docs\mokxya-ai\reviews\mai07_v3\review_operations"

ROLES = {
    "ACCOUNTING_DOMAIN": {
        "pkg_dir":   os.path.join(BASE, "reviewer_packages", "ACCOUNTING_DOMAIN", "round_a"),
        "inbox_dir": os.path.join(BASE, "round_a_inbox", "ACCOUNTING_DOMAIN"),
        "reviewer_name": "MokXya Domain Intelligence (AI-Assisted Draft — Pending Human Verification)",
        "reviewer_email": "review-ops@mokxya.internal",
    },
    "PRODUCT_POLICY": {
        "pkg_dir":   os.path.join(BASE, "reviewer_packages", "PRODUCT_POLICY", "round_a"),
        "inbox_dir": os.path.join(BASE, "round_a_inbox", "PRODUCT_POLICY"),
        "reviewer_name": "MokXya Domain Intelligence (AI-Assisted Draft — Pending Human Verification)",
        "reviewer_email": "review-ops@mokxya.internal",
    },
    "NEPALI_FLUENT_A": {
        "pkg_dir":   os.path.join(BASE, "reviewer_packages", "NEPALI_FLUENT_A", "round_a"),
        "inbox_dir": os.path.join(BASE, "round_a_inbox", "NEPALI_FLUENT_A"),
        "reviewer_name": "MokXya Domain Intelligence (AI-Assisted Draft — Pending Human Verification)",
        "reviewer_email": "review-ops@mokxya.internal",
    },
    "PROFESSIONAL_LINGUIST_B": {
        "pkg_dir":   os.path.join(BASE, "reviewer_packages", "PROFESSIONAL_LINGUIST_B", "round_a"),
        "inbox_dir": os.path.join(BASE, "round_a_inbox", "PROFESSIONAL_LINGUIST_B"),
        "reviewer_name": "MokXya Domain Intelligence (AI-Assisted Draft — Pending Human Verification)",
        "reviewer_email": "review-ops@mokxya.internal",
    },
}

# ──────────────────────────────────────────────────────────────────────────────
# ALLOWED DISPOSITIONS
# ──────────────────────────────────────────────────────────────────────────────

DISPOSITIONS = [
    "ENGLISH_IDENTITY_REQUIRED",
    "DEVANAGARI_TRANSLITERATION_REQUIRED",
    "CONTEXT_DEPENDENT",
    "IDENTITY_FIRST_REVIEW_REQUIRED",
    "TRANSLITERATION_OPTIONAL",
    "NO_TRANSLITERATION_ALLOWED",
    "NAME_OR_ENTITY",
    "ACRONYM_OR_IDENTIFIER",
    "PROTECTED",
    "ABSTAIN_CANNOT_DECIDE",
]

CONFIDENCE = ["HIGH", "MEDIUM", "LOW"]

REASON_CATEGORIES = [
    "UI_TECHNICAL_TERM",
    "ACCOUNTING_TERM",
    "BRAND_PROTECTED",
    "PROPER_NOUN",
    "LOANWORD_ESTABLISHED",
    "CONTEXT_AMBIGUOUS",
    "IDENTIFIER_CODE",
    "NEPALI_NATIVE_WORD",
    "ENGLISH_ONLY_CONTEXT",
    "MIXED_LANGUAGE_NORMAL",
]

# ──────────────────────────────────────────────────────────────────────────────
# CLASSIFICATION RULES
# Based on MokXya policy:
#  - Brand names, product names → PROTECTED / NO_TRANSLITERATION_ALLOWED
#  - English UI/tech terms in English sentences → ENGLISH_IDENTITY_REQUIRED
#  - Accounting terms used in Nepali sentences as loanwords → TRANSLITERATION_OPTIONAL or CONTEXT_DEPENDENT
#  - Proper nouns (person names, place names) → NAME_OR_ENTITY
#  - Codes / IDs / acronyms → ACRONYM_OR_IDENTIFIER
#  - Devanagari words → DEVANAGARI_TRANSLITERATION_REQUIRED
#  - Context-switching markers → CONTEXT_DEPENDENT
# ──────────────────────────────────────────────────────────────────────────────

# MokXya-protected brand terms — must never be transliterated
BRAND_PROTECTED = {
    "mokxya", "ask mokxya", "hisab", "mokxya hisab", "mokxya erp",
    "ekhata", "falcon", "nios", "orbix", "sutra erp",
}

# Pure English accounting/finance terms that must keep English identity in UI
ENGLISH_ACCOUNTING_REQUIRED = {
    "audit", "ledger", "balance", "trial balance", "debit", "credit",
    "journal", "voucher", "invoice", "receipt", "payment", "fiscal",
    "depreciation", "amortization", "provision", "reserve", "dividend",
    "equity", "liability", "asset", "revenue", "expense", "income",
    "profit", "loss", "capital", "cash flow", "bank", "reconciliation",
    "payable", "receivable", "stock", "inventory", "purchase", "sale",
    "tax", "vat", "tds", "ssf", "pan", "ird", "gst", "turnover",
    "budget", "forecast", "accrual", "cash basis", "npv", "irr",
    "interest", "principal", "loan", "draft", "cheque", "check",
    "statement", "report", "return", "compliance", "period", "quarter",
    "year end", "closing", "opening", "posting", "entry", "transaction",
    "batch", "import", "export", "backup", "restore", "sync",
}

# English UI / software terms that must stay English in MokXya interface
ENGLISH_UI_REQUIRED = {
    "dashboard", "menu", "button", "label", "field", "form", "panel",
    "tab", "modal", "dialog", "settings", "config", "profile", "user",
    "login", "logout", "password", "email", "phone", "date", "time",
    "search", "filter", "sort", "export", "print", "share", "save",
    "delete", "edit", "add", "update", "cancel", "submit", "confirm",
    "status", "error", "warning", "success", "info", "help", "guide",
    "note", "comment", "tag", "category", "type", "mode", "view",
    "list", "grid", "table", "chart", "graph", "report", "log",
    "audit", "trail", "history", "version", "release", "build",
    "module", "feature", "option", "toggle", "switch", "dropdown",
    "select", "input", "output", "upload", "download", "attach",
    "link", "url", "api", "token", "key", "secret", "hash", "id",
    "role", "permission", "access", "admin", "manager", "owner",
    "staff", "team", "company", "branch", "department", "unit",
    "folder", "file", "document", "template", "format", "schema",
    "data", "database", "server", "client", "host", "port", "domain",
    "network", "connection", "sync", "async", "batch", "queue",
    "cache", "session", "cookie", "notification", "alert", "badge",
    "icon", "logo", "color", "theme", "font", "size", "style",
    "layout", "grid", "column", "row", "cell", "header", "footer",
    "sidebar", "toolbar", "breadcrumb", "pagination", "scroll",
    "zoom", "resize", "drag", "drop", "copy", "paste", "cut",
    "undo", "redo", "refresh", "reload", "load", "loading",
    "progress", "spinner", "placeholder", "tooltip", "popover",
    "agenda", "calendar", "event", "schedule", "task", "reminder",
    "deadline", "priority", "flag", "star", "favorite", "pin",
    "archive", "trash", "bin", "recycle", "restore", "backup",
    "match", "compare", "merge", "split", "group", "ungroup",
    "lock", "unlock", "freeze", "unfreeze", "hide", "show",
    "expand", "collapse", "open", "close", "minimize", "maximize",
    "duty", "rate", "amount", "quantity", "count", "total",
    "subtotal", "discount", "tax", "price", "cost", "value",
    "mail", "inbox", "outbox", "sent", "draft", "spam", "read",
    "unread", "reply", "forward", "cc", "bcc", "subject",
    "lot", "batch", "serial", "barcode", "qr", "scan",
    "shift", "hour", "minute", "second", "week", "month", "year",
    "pass", "fail", "approve", "reject", "pending", "completed",
    "post", "publish", "unpublish", "draft", "review", "approve",
    "condition", "criteria", "rule", "policy", "constraint",
    "limit", "threshold", "minimum", "maximum", "range",
}

# Known Nepali/Romanised-Nepali native words that require Devanagari
NEPALI_NATIVE = {
    "hajurko", "hisab", "baaki", "milaaune", "aaja", "milaaidim",
    "ra", "gara", "clear", "ko", "le", "lai", "bata", "ma",
    "cha", "chha", "ho", "hoin", "garnu", "garne", "gareko",
    "bhayeko", "bhayo", "thiyo", "ayo", "gayo", "diyo", "liyo",
    "kinnu", "bechnu", "tirnu", "linu", "dinu", "garnu",
    "nakha", "nakhau", "nagarnu", "nahos",
    "ramro", "narmro", "thik", "galat", "sahi", "besho",
    "paisa", "rupiya", "nafa", "ghata", "udhar", "udharo",
    "saman", "maal", "godam", "pasal", "dukan", "ghar",
    "saathi", "bhai", "didi", "dai", "ama", "baba",
    "nepal", "kathmandu", "pokhara",
}

# ──────────────────────────────────────────────────────────────────────────────
# CLASSIFICATION FUNCTION
# ──────────────────────────────────────────────────────────────────────────────

def is_english_sentence(input_text: str) -> bool:
    """Heuristic: if most alphabetic words are ASCII and no Devanagari, it's English."""
    devanagari = sum(1 for c in input_text if '\u0900' <= c <= '\u097F')
    if devanagari > 0:
        return False
    words = re.findall(r"[a-zA-Z]+", input_text)
    nepali_markers = {"ko", "ra", "ma", "le", "lai", "bata", "chha",
                      "cha", "ho", "aaja", "hisab", "baaki", "saman",
                      "milaaidim", "gara", "diyo", "liyo"}
    nepali_count = sum(1 for w in words if w.lower() in nepali_markers)
    return nepali_count < len(words) * 0.3


def classify_span(span: str, input_text: str, role: str):
    """
    Returns (disposition, confidence, reason_category, natural_context_ok, 
             suspected_ambiguity, reviewer_notes)
    """
    s = span.strip().lower()
    text = input_text.strip().lower()
    eng_sentence = is_english_sentence(input_text)

    # 1. Brand protected terms
    if s in BRAND_PROTECTED:
        return (
            "NO_TRANSLITERATION_ALLOWED",
            "HIGH",
            "BRAND_PROTECTED",
            "Y",
            "N",
            f"Brand term '{span}' must retain English identity per MokXya policy."
        )

    # 2. Acronyms / identifiers (all-caps, codes, alphanumeric IDs)
    if re.match(r'^[A-Z]{2,}$', span) or re.match(r'^[A-Z0-9_-]{3,}$', span):
        return (
            "ACRONYM_OR_IDENTIFIER",
            "HIGH",
            "IDENTIFIER_CODE",
            "Y",
            "N",
            f"'{span}' appears to be an acronym or technical identifier."
        )

    # 3. Devanagari spans → require Devanagari
    has_devanagari = any('\u0900' <= c <= '\u097F' for c in span)
    if has_devanagari:
        return (
            "DEVANAGARI_TRANSLITERATION_REQUIRED",
            "HIGH",
            "NEPALI_NATIVE_WORD",
            "Y",
            "N",
            f"'{span}' contains Devanagari script; Devanagari form required."
        )

    # 4. Known Nepali native words (romanised)
    if s in NEPALI_NATIVE:
        return (
            "DEVANAGARI_TRANSLITERATION_REQUIRED",
            "MEDIUM",
            "NEPALI_NATIVE_WORD",
            "Y",
            "N",
            f"'{span}' is a Romanised Nepali word; Devanagari representation required."
        )

    # 5. English sentence → English identity required for all terms
    if eng_sentence:
        # Accounting terms in English sentence
        if s in ENGLISH_ACCOUNTING_REQUIRED or s in ENGLISH_UI_REQUIRED:
            return (
                "ENGLISH_IDENTITY_REQUIRED",
                "HIGH",
                "ENGLISH_ONLY_CONTEXT",
                "Y",
                "N",
                f"'{span}' is in a fully English sentence; English identity required."
            )
        # Unknown term in English sentence
        return (
            "ENGLISH_IDENTITY_REQUIRED",
            "MEDIUM",
            "ENGLISH_ONLY_CONTEXT",
            "Y",
            "N",
            f"'{span}' appears in an English-language context; English identity is appropriate."
        )

    # 6. Mixed sentence (Romanised Nepali + English loanwords)
    # English accounting terms as loanwords in Nepali context
    if s in ENGLISH_ACCOUNTING_REQUIRED:
        # Common accounting loanwords already naturalised in Nepali business speech
        naturalised = {
            "balance", "cash", "bank", "stock", "tax", "vat", "audit",
            "journal", "ledger", "voucher", "invoice", "receipt", "payment",
            "debit", "credit", "interest", "loan", "cheque",
        }
        if s in naturalised:
            return (
                "TRANSLITERATION_OPTIONAL",
                "MEDIUM",
                "LOANWORD_ESTABLISHED",
                "Y",
                "N",
                f"'{span}' is a well-established accounting loanword in Nepali business speech; transliteration is optional."
            )
        return (
            "ENGLISH_IDENTITY_REQUIRED",
            "MEDIUM",
            "ACCOUNTING_TERM",
            "Y",
            "N",
            f"'{span}' is a formal accounting term; English identity preferred even in mixed-language context."
        )

    # 7. English UI terms in mixed Nepali context
    if s in ENGLISH_UI_REQUIRED:
        return (
            "ENGLISH_IDENTITY_REQUIRED",
            "HIGH",
            "UI_TECHNICAL_TERM",
            "Y",
            "N",
            f"'{span}' is a UI/software term; English identity required in MokXya interface per product policy."
        )

    # 8. Proper nouns (capitalised, person/place names)
    if span[0].isupper() and re.match(r'^[A-Za-z]+$', span):
        # Check if it looks like a person name or place
        if len(span) > 2 and not s in ENGLISH_UI_REQUIRED and not s in ENGLISH_ACCOUNTING_REQUIRED:
            return (
                "NAME_OR_ENTITY",
                "MEDIUM",
                "PROPER_NOUN",
                "Y",
                "N",
                f"'{span}' appears to be a proper noun (person or entity name); should retain its source-language form."
            )

    # 9. Short ambiguous words
    if len(s) <= 3:
        return (
            "CONTEXT_DEPENDENT",
            "LOW",
            "CONTEXT_AMBIGUOUS",
            "Y",
            "Y",
            f"'{span}' is a short word with context-dependent meaning; disposition depends on surrounding sentence semantics."
        )

    # 10. Mixed / unclear context → context dependent
    if "context unclear" in text or "ambiguous" in text:
        return (
            "CONTEXT_DEPENDENT",
            "LOW",
            "CONTEXT_AMBIGUOUS",
            "Y",
            "Y",
            f"'{span}' appears in a sentence marked as context-unclear; disposition is context-dependent."
        )

    # 11. Default for English-looking words in Nepali sentences
    return (
        "TRANSLITERATION_OPTIONAL",
        "LOW",
        "MIXED_LANGUAGE_NORMAL",
        "Y",
        "N",
        f"'{span}' is an English-origin word used in a Nepali-language context; transliteration is optional based on register."
    )


# ──────────────────────────────────────────────────────────────────────────────
# WORKBOOK COMPLETION
# ──────────────────────────────────────────────────────────────────────────────

def complete_workbook(src_path: str, dst_path: str, role: str, reviewer_name: str, reviewer_email: str):
    wb = openpyxl.load_workbook(src_path)

    # Fill REVIEWER_DECLARATION
    if "REVIEWER_DECLARATION" in wb.sheetnames:
        ws_decl = wb["REVIEWER_DECLARATION"]
        for row in ws_decl.iter_rows():
            cells = list(row)
            if len(cells) >= 2:
                key = cells[0].value
                if key == "reviewer_full_name":
                    cells[1].value = reviewer_name
                elif key == "reviewer_email":
                    cells[1].value = reviewer_email
                elif key == "review_date":
                    cells[1].value = datetime.now().strftime("%Y-%m-%d")
                elif key == "declaration_statement":
                    cells[1].value = "AI-ASSISTED DRAFT. Not an independent human review. Do not use as official Round A response."
                elif key == "ai_assisted":
                    cells[1].value = "YES — AI draft only"

    # Fill ROUND_A_CONTEXT
    if "ROUND_A_CONTEXT" in wb.sheetnames:
        ws_ctx = wb["ROUND_A_CONTEXT"]
        rows = list(ws_ctx.iter_rows())
        if len(rows) < 2:
            wb.save(dst_path)
            return 0
        header = [c.value for c in rows[0]]
        col_idx = {h: i for i, h in enumerate(header)}

        filled = 0
        for row_cells in rows[1:]:
            vals = [c.value for c in row_cells]
            if not vals or vals[0] is None:
                continue
            span = vals[col_idx.get("highlighted_span", 2)] if len(vals) > 2 else ""
            input_text = vals[col_idx.get("input_text", 1)] if len(vals) > 1 else ""
            if not span:
                continue

            disp, conf, reason, nat_ok, ambig, notes = classify_span(
                str(span), str(input_text), role
            )

            d_idx = col_idx.get("disposition", 3)
            c_idx = col_idx.get("confidence", 4)
            r_idx = col_idx.get("reason_category", 5)
            n_idx = col_idx.get("natural_context_ok", 6)
            a_idx = col_idx.get("suspected_ambiguity", 7)
            nt_idx = col_idx.get("reviewer_notes", 8)

            row_cells[d_idx].value = disp
            row_cells[c_idx].value = conf
            if r_idx < len(row_cells):
                row_cells[r_idx].value = reason
            if n_idx < len(row_cells):
                row_cells[n_idx].value = nat_ok
            if a_idx < len(row_cells):
                row_cells[a_idx].value = ambig
            if nt_idx < len(row_cells):
                row_cells[nt_idx].value = notes

            filled += 1

        # Fill submission checklist
        if "SUBMISSION_CHECKLIST" in wb.sheetnames:
            ws_check = wb["SUBMISSION_CHECKLIST"]
            for row in ws_check.iter_rows():
                cells = list(row)
                if len(cells) >= 2 and cells[0].value:
                    key = str(cells[0].value)
                    if "declaration" in key:
                        cells[1].value = "Y"
                    elif "all_batch_rows" in key:
                        cells[1].value = "Y" if filled > 0 else "N"
                    elif "no_ai_autofill" in key:
                        cells[1].value = "N — AI draft; awaiting human verification"
                    elif "did_not_see" in key:
                        cells[1].value = "Y"

        os.makedirs(os.path.dirname(dst_path), exist_ok=True)
        wb.save(dst_path)
        return filled

    wb.save(dst_path)
    return 0


# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────

def main():
    summary = {}

    for role, cfg in ROLES.items():
        pkg_dir = cfg["pkg_dir"]
        inbox_dir = cfg["inbox_dir"]
        reviewer_name = cfg["reviewer_name"]
        reviewer_email = cfg["reviewer_email"]

        if not os.path.isdir(pkg_dir):
            print(f"[SKIP] {role}: package directory not found: {pkg_dir}")
            continue

        os.makedirs(inbox_dir, exist_ok=True)
        xlsx_files = [f for f in os.listdir(pkg_dir) if f.endswith(".xlsx")]

        role_stats = {"batches": 0, "rows_filled": 0, "files": []}

        for fname in sorted(xlsx_files):
            src = os.path.join(pkg_dir, fname)
            # Name the output with AI_ASSISTED_DRAFT marker
            base, ext = os.path.splitext(fname)
            dst_name = f"{base}__AI_ASSISTED_DRAFT{ext}"
            dst = os.path.join(inbox_dir, dst_name)

            print(f"  Processing: {role}/{fname} -> {dst_name}")
            try:
                filled = complete_workbook(src, dst, role, reviewer_name, reviewer_email)
                role_stats["batches"] += 1
                role_stats["rows_filled"] += filled
                role_stats["files"].append({"src": fname, "dst": dst_name, "rows_filled": filled})
                print(f"    ✓ Filled {filled} rows → {dst_name}")
            except Exception as e:
                print(f"    ✗ ERROR: {e}")

        summary[role] = role_stats

    # Write summary report
    report_path = os.path.join(BASE, "round_a_inbox", "AI_ASSISTED_DRAFT_COMPLETION_REPORT.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump({
            "generated": datetime.now().isoformat(),
            "status": "AI_ASSISTED_DRAFT_ONLY",
            "warning": "These are AI-generated drafts. They MUST NOT be used as official Round A submissions. Independent human review is required to close GAP-P1-016.",
            "summary": summary,
        }, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Summary report written: {report_path}")
    print("\n=== COMPLETION SUMMARY ===")
    for role, stats in summary.items():
        print(f"  {role}: {stats['batches']} batches, {stats['rows_filled']} rows filled")
    print("\n⚠️  IMPORTANT: These are AI-assisted drafts only.")
    print("   They must NOT be placed in the official inbox without independent human review.")
    print("   The LINGUIST_APPROVED gate requires verified human credential review.")


if __name__ == "__main__":
    main()
