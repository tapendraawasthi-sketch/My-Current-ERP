#!/usr/bin/env python3
"""Generate high-quality Nepal Universal AI language batches 05–10."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANG = ROOT / "data" / "nepal-ai" / "language"


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def batch_05_numbers() -> list[dict]:
    rows = [
        {"pattern_type": "basic_number", "examples": ["ek", "1"], "canonical_form": "ek", "numeric_value": 1, "regex_hint": r"\bek\b|1\b", "usage_examples": ["ek rupiya", "1 rs"], "common_typos": ["eak"]},
        {"pattern_type": "basic_number", "examples": ["dui", "2"], "canonical_form": "dui", "numeric_value": 2, "regex_hint": r"\bdui\b|2\b", "usage_examples": ["dui hajar"], "common_typos": ["duii"]},
        {"pattern_type": "basic_number", "examples": ["tin", "3"], "canonical_form": "tin", "numeric_value": 3, "regex_hint": r"\btin\b|3\b", "usage_examples": ["tin saya"], "common_typos": []},
        {"pattern_type": "basic_number", "examples": ["char", "4"], "canonical_form": "char", "numeric_value": 4, "regex_hint": r"\bchar\b|4\b", "usage_examples": ["char hajar"], "common_typos": ["chaar"]},
        {"pattern_type": "basic_number", "examples": ["panch", "5"], "canonical_form": "panch", "numeric_value": 5, "regex_hint": r"\bpanch\b|5\b", "usage_examples": ["panch saya"], "common_typos": ["paanch"]},
        {"pattern_type": "basic_number", "examples": ["das", "10"], "canonical_form": "das", "numeric_value": 10, "regex_hint": r"\bdas\b|10\b", "usage_examples": ["das hajar"], "common_typos": ["dus"]},
        {"pattern_type": "basic_number", "examples": ["bis", "20"], "canonical_form": "bis", "numeric_value": 20, "regex_hint": r"\bbis\b|20\b", "usage_examples": ["bis hajar"], "common_typos": ["biss"]},
        {"pattern_type": "basic_number", "examples": ["pachaas", "50"], "canonical_form": "pachaas", "numeric_value": 50, "regex_hint": r"\bpacha?s\b|50\b", "usage_examples": ["pachaas rupiya"], "common_typos": ["pachas", "pachis"]},
        {"pattern_type": "basic_number", "examples": ["saya", "100"], "canonical_form": "saya", "numeric_value": 100, "regex_hint": r"\bsaya\b|100\b", "usage_examples": ["paanch saya"], "common_typos": ["saa", "saye"]},
        {"pattern_type": "large_number", "examples": ["hajar", "hazar", "hajaar", "1000", "1k", "1K"], "canonical_form": "hajar", "numeric_value": 1000, "regex_hint": r"haj?a+r|1k|1000", "usage_examples": ["paanch hajar", "5 hajar", "5k", "5000"], "common_typos": ["hajaar", "hazar", "hazaar"]},
        {"pattern_type": "large_number", "examples": ["lakh", "lac", "1L", "1l"], "canonical_form": "lakh", "numeric_value": 100000, "regex_hint": r"\blakh\b|lac|1l", "usage_examples": ["ek lakh", "1 lakh", "10L"], "common_typos": ["lak", "lacs"]},
        {"pattern_type": "large_number", "examples": ["crore", "cr", "1Cr"], "canonical_form": "crore", "numeric_value": 10000000, "regex_hint": r"\bcrore\b|cr|1cr", "usage_examples": ["ek crore", "1Cr"], "common_typos": ["kror"]},
        {"pattern_type": "large_number", "examples": ["arab"], "canonical_form": "arab", "numeric_value": 1000000000, "regex_hint": r"\barab\b", "usage_examples": ["ek arab"], "common_typos": []},
        {"pattern_type": "fraction", "examples": ["dedh", "1.5"], "canonical_form": "dedh", "numeric_value": 1.5, "regex_hint": r"\bdedh\b", "usage_examples": ["dedh hajar"], "common_typos": []},
        {"pattern_type": "fraction", "examples": ["dhai", "2.5"], "canonical_form": "dhai", "numeric_value": 2.5, "regex_hint": r"\bdhai\b", "usage_examples": ["dhai lakh"], "common_typos": []},
        {"pattern_type": "fraction", "examples": ["sawa", "1.25"], "canonical_form": "sawa", "numeric_value": 1.25, "regex_hint": r"\bsawa\b", "usage_examples": ["sawa lakh"], "common_typos": []},
        {"pattern_type": "fraction", "examples": ["paune"], "canonical_form": "paune", "numeric_value": 0.75, "regex_hint": r"\bpaune\b", "usage_examples": ["paune hajar"], "common_typos": []},
        {"pattern_type": "approximation", "examples": ["lagbhag", "around", "about", "almost"], "canonical_form": "lagbhag", "numeric_value": None, "regex_hint": r"lagbhag|around|about", "usage_examples": ["lagbhag 5000", "around 5k"], "common_typos": ["lagbag"]},
        {"pattern_type": "approximation", "examples": ["jati", "tira"], "canonical_form": "jati", "numeric_value": None, "regex_hint": r"\bjati\b|\btira\b", "usage_examples": ["5 hajar jati", "5k tira"], "common_typos": []},
        {"pattern_type": "range", "examples": ["dekhi", "samma", "bich"], "canonical_form": "dekhi-samma", "numeric_value": None, "regex_hint": r"dekhi.*samma", "usage_examples": ["500 dekhi 1000 samma"], "common_typos": []},
        {"pattern_type": "per_unit", "examples": ["prati", "eutako", "euta ko", "per"], "canonical_form": "prati", "numeric_value": None, "regex_hint": r"prati|eutako|per", "usage_examples": ["50 prati", "20 samosa 50 eutako"], "common_typos": ["prate"]},
        {"pattern_type": "per_unit", "examples": ["pratihajar", "per thousand"], "canonical_form": "pratihajar", "numeric_value": None, "regex_hint": r"pratihajar", "usage_examples": ["100 pratihajar"], "common_typos": []},
        {"pattern_type": "percentage", "examples": ["pratishat", "%", "percent"], "canonical_form": "percent", "numeric_value": None, "regex_hint": r"%|percent|pratishat", "usage_examples": ["VAT 13%", "10 percent"], "common_typos": []},
        {"pattern_type": "currency", "examples": ["rs", "Rs", "RS"], "canonical_form": "rs", "numeric_value": None, "regex_hint": r"\brs\.?\b", "usage_examples": ["500 rs", "Rs.500"], "common_typos": []},
        {"pattern_type": "currency", "examples": ["npr", "NPR"], "canonical_form": "npr", "numeric_value": None, "regex_hint": r"\bnpr\b", "usage_examples": ["NPR 5000"], "common_typos": []},
        {"pattern_type": "currency", "examples": ["rupiya", "rupaya", "rupaiya", "rupees"], "canonical_form": "rupiya", "numeric_value": None, "regex_hint": r"rupiy?a|rupaiya|rupees", "usage_examples": ["500 rupiya", "50 rupaya ko"], "common_typos": ["rupya", "rupaye"]},
        {"pattern_type": "currency", "examples": ["paisa"], "canonical_form": "paisa", "numeric_value": None, "regex_hint": r"\bpaisa\b", "usage_examples": ["50 paisa"], "common_typos": []},
        {"pattern_type": "colloquial", "examples": ["pachas rupya"], "canonical_form": "pachaas rupiya", "numeric_value": 50, "regex_hint": r"pachas\s+rupy", "usage_examples": ["pachas rupya"], "common_typos": []},
        {"pattern_type": "colloquial", "examples": ["ek hajar paanch saya"], "canonical_form": "1500", "numeric_value": 1500, "regex_hint": r"hajar.*saya", "usage_examples": ["ek hajar paanch saya"], "common_typos": []},
        {"pattern_type": "shortcut", "examples": ["1k", "5k", "10k"], "canonical_form": "k_suffix", "numeric_value": None, "regex_hint": r"\d+k\b", "usage_examples": ["5k", "10k"], "common_typos": []},
        {"pattern_type": "shortcut", "examples": ["10L", "1L"], "canonical_form": "l_suffix", "numeric_value": None, "regex_hint": r"\d+l\b", "usage_examples": ["10L"], "common_typos": []},
        {"pattern_type": "shortcut", "examples": ["1Cr", "2Cr"], "canonical_form": "cr_suffix", "numeric_value": None, "regex_hint": r"\d+cr\b", "usage_examples": ["1Cr"], "common_typos": []},
        {"pattern_type": "written", "examples": ["500/-", "500/="], "canonical_form": "slash_suffix", "numeric_value": None, "regex_hint": r"\d+/-", "usage_examples": ["500/-"], "common_typos": []},
        {"pattern_type": "written", "examples": ["Rs.500", "Rs 500"], "canonical_form": "rs_prefix", "numeric_value": None, "regex_hint": r"rs\.?\s*\d", "usage_examples": ["Rs.500"], "common_typos": []},
        {"pattern_type": "compound", "examples": ["ath hajar"], "canonical_form": "8000", "numeric_value": 8000, "regex_hint": r"ath\s+hajar", "usage_examples": ["ath hajar"], "common_typos": []},
        {"pattern_type": "compound", "examples": ["pach hajar"], "canonical_form": "5000", "numeric_value": 5000, "regex_hint": r"pach\s+hajar", "usage_examples": ["pach hajar"], "common_typos": ["paanch hajar"]},
        {"pattern_type": "compound", "examples": ["chha hajar"], "canonical_form": "6000", "numeric_value": 6000, "regex_hint": r"chha\s+hajar", "usage_examples": ["chha hajar"], "common_typos": []},
        {"pattern_type": "minimum", "examples": ["minimum", "kamti"], "canonical_form": "minimum", "numeric_value": None, "regex_hint": r"minimum|kamti", "usage_examples": ["minimum 500"], "common_typos": []},
        {"pattern_type": "maximum", "examples": ["maximum", "badi"], "canonical_form": "maximum", "numeric_value": None, "regex_hint": r"maximum|badi", "usage_examples": ["maximum 5000"], "common_typos": []},
    ]
    return rows


def batch_06_profit_loss() -> list[dict]:
    terms = [
        ("noksan", ["nokshan", "noksana"], "EXPENSE", "khata_expense", "loss / financial loss", "noksan vo 400"),
        ("ghata", ["ghat", "ghateko", "ghatyo"], "EXPENSE", "khata_expense", "decrease / loss amount", "stock ma 200 ghateko"),
        ("kharcha", ["kharcho", "kharxa", "expense"], "EXPENSE", "khata_expense", "expense / spending", "bijuli kharcha 500"),
        ("nafa", ["profit", "munafa"], "INCOME", "khata_cash_sale", "profit / gain", "nafa kati bhayo"),
        ("aamdani", ["aamdan", "income", "revenue"], "INCOME", "khata_cash_sale", "income / revenue", "mahina ko aamdani"),
        ("munafa", ["munaffa"], "INCOME", "khata_cash_sale", "profit margin", "munafa 15%"),
        ("ghatan", ["ghatan", "loss margin"], "EXPENSE", "khata_expense", "loss on sale", "saman ma ghatan"),
        ("write off", ["writeoff", "write-off"], "EXPENSE", "khata_bad_debt_writeoff", "bad debt write-off", "Ram ko 500 write off"),
        ("bad debt", ["baddebt"], "EXPENSE", "khata_bad_debt_writeoff", "uncollectible receivable", "bad debt 2000"),
        ("depreciation", ["hras", "ghat", "amortization"], "EXPENSE", "khata_depreciation", "asset value decrease", "gadi depreciation 5000"),
        ("impairment", ["impair"], "EXPENSE", "khata_expense", "asset impairment", "impairment loss"),
        ("provision", ["reserve"], "EXPENSE", "khata_provision", "provision for loss", "bad debt provision"),
        ("discount allowed", ["discount diye"], "EXPENSE", "khata_discount_allowed", "discount given to customer", "discount allowed 100"),
        ("discount received", ["discount paayo"], "INCOME", "khata_discount_received", "discount from supplier", "discount received 50"),
        ("commission expense", ["commission kharcha"], "EXPENSE", "khata_expense", "commission paid", "commission 500"),
        ("commission income", ["commission aayo"], "INCOME", "khata_payment_in", "commission earned", "commission income 300"),
        ("rent expense", ["bhada kharcha", "bhaada"], "EXPENSE", "khata_expense", "rent paid", "office bhada 15000"),
        ("interest expense", ["byaj kharcha"], "EXPENSE", "khata_expense", "interest paid on loan", "byaj 2000"),
        ("interest income", ["byaj aamdani"], "INCOME", "khata_payment_in", "interest received", "bank byaj 500"),
        ("salary expense", ["talab kharcha"], "EXPENSE", "khata_salary_payment", "payroll cost", "talab 50000"),
        ("cogs", ["cost of goods", "stock cost"], "EXPENSE", "khata_stock_sale_cogs", "cost of goods sold", "cogs 3000"),
        ("gross profit", ["gross nafa"], "INCOME", None, "revenue minus cogs", "gross profit kati"),
        ("net profit", ["net nafa", "safal nafa"], "INCOME", None, "final profit after all expenses", "net profit 10000"),
        ("operating loss", ["sanchalan noksan"], "EXPENSE", "khata_expense", "loss from operations", "operating loss"),
        ("capital loss", ["puni noksan"], "EXPENSE", "khata_expense", "loss on capital asset", "share ma noksan"),
        ("inventory shrinkage", ["stock ghateko"], "EXPENSE", "khata_expense", "stock loss / theft", "stock shrinkage 500"),
        ("wastage", ["nash", "waste"], "EXPENSE", "khata_expense", "wasted goods", "sabji nash bhayo"),
        ("theft loss", ["chori noksan"], "EXPENSE", "khata_expense", "theft related loss", "chori le noksan"),
        ("flood damage", ["bipad noksan"], "EXPENSE", "khata_expense", "disaster loss", "bipad le noksan"),
        ("exchange loss", ["forex loss"], "EXPENSE", "khata_expense", "currency loss", "forex loss 1000"),
        ("exchange gain", ["forex gain"], "INCOME", "khata_payment_in", "currency gain", "forex gain"),
        ("penalty", ["jarivana"], "EXPENSE", "khata_expense", "fine / penalty paid", "IRD jarivana 5000"),
        ("rebate", ["chhut"], "INCOME", "khata_discount_received", "rebate received", "supplier rebate"),
        ("refund expense", ["firta kharcha"], "EXPENSE", "khata_expense", "refund cost", "customer refund"),
        ("sales return loss", ["bikri firta noksan"], "EXPENSE", "khata_sales_return", "loss on returned sale", "return ma noksan"),
        ("purchase return gain", ["kharid firta nafa"], "INCOME", "khata_purchase_return", "gain on purchase return", "supplier return"),
        ("donation", ["dan"], "EXPENSE", "khata_expense", "charitable expense", "dan 1000"),
        ("insurance claim", ["bima claim"], "INCOME", "khata_payment_in", "insurance recovery", "bima bata aayo"),
        ("subsidy", ["anudan"], "INCOME", "khata_payment_in", "government subsidy", "anudan 50000"),
        ("grant", ["grant aayo"], "INCOME", "khata_payment_in", "grant income", "grant received"),
        ("misc loss", ["anya noksan"], "EXPENSE", "khata_expense", "other losses", "anya noksan 200"),
    ]
    return [
        {
            "term_roman": t,
            "variants": v,
            "accounting_class": c,
            "journal_intent_if_entry": ji,
            "meaning_en": m,
            "example_entry": ex,
            "question_vs_entry": "k ho suffix = question; amount + vo/bhayo = entry" if t == "noksan" else None,
        }
        for t, v, c, ji, m, ex in terms
    ]


def batch_07_credit_debt() -> list[dict]:
    terms = [
        ("udhaar", ["udhar", "udharo", "udaro", "credit"], "outbound_credit", ["Ram lai 500 udhaar", "udharo ma becheko"], "credit given / receivable"),
        ("baki", ["baki cha", "outstanding"], "ambiguous", ["500 baki cha", "baki tirnu baki"], "remaining balance — direction from context"),
        ("rin", ["loan", "karz", "karja"], "inbound_debt", ["bank bata rin liyo", "loan liye"], "loan / debt"),
        ("debtor", ["debtor", "lenewala"], "receivable", ["debtor Ram"], "party who owes us"),
        ("creditor", ["creditor", "dinewala"], "payable", ["creditor Gita"], "party we owe"),
        ("receivable", ["prapti yogya", "lina baki"], "receivable", ["receivable 5000"], "amount to receive"),
        ("payable", ["tirnu baki", "dina baki"], "payable", ["payable 3000"], "amount to pay"),
        ("advance received", ["advance liyo", "agadi liyo"], "liability", ["customer advance 2000"], "advance from customer"),
        ("advance paid", ["advance diyo", "agadi diyo"], "asset", ["supplier advance 5000"], "advance to supplier"),
        ("karja", ["rin"], "inbound_debt", ["karja liyo"], "loan colloquial"),
        ("tirnu baki", ["payment due"], "payable", ["supplier tirnu baki"], "amount due to pay"),
        ("lina baki", ["collection due"], "receivable", ["Ram bata lina baki"], "amount due to collect"),
        ("udhaar ma kineko", ["credit purchase"], "payable", ["udhaar ma sariya kineko"], "purchased on credit"),
        ("udhaar ma becheko", ["credit sale"], "receivable", ["udhaar ma becheko"], "sold on credit"),
        ("Ram lai diye", ["diyo", "diye"], "receivable", ["Ram lai 500 diye"], "gave on credit to Ram"),
        ("Shyam le tiryo", ["tireko"], "receivable_collection", ["Shyam le 300 tiryo"], "Shyam paid us"),
        ("Gita lai tireko", ["payment out"], "payable_payment", ["Gita lai 200 tireko"], "we paid Gita"),
        ("jama", ["deposit", "aayo"], "receivable_collection", ["cash jama 5000"], "money received / deposited"),
        ("nikasne", ["withdrawal", "drawings"], "outbound_payment", ["owner nikasne 10000"], "withdrawal"),
        ("opening balance", ["suruwati baki"], "ambiguous", ["opening balance debtor"], "opening ledger balance"),
        ("closing balance", ["antim baki"], "ambiguous", ["closing balance"], "closing ledger balance"),
        ("overdue", ["miyad vitiyo"], "receivable", ["overdue 15 din"], "past due receivable"),
        ("installment", ["kista"], "ambiguous", ["kista 5000"], "installment payment"),
        ("emi", ["monthly payment"], "payable", ["emi 15000"], "loan EMI"),
        ("cheque bounce", ["cheque return"], "receivable", ["cheque bounce"], "dishonored cheque"),
        ("post dated cheque", ["pdc"], "receivable", ["PDC 10000"], "future dated cheque"),
        ("security deposit", ["dhara"], "asset", ["dhara 50000"], "refundable deposit paid"),
        ("earnest money", ["jama rashi"], "asset", ["earnest 25000"], "advance deposit"),
        ("retention money", ["rakam hold"], "receivable", ["retention 10%"], "held payment"),
        ("contra", ["cash bank transfer"], "neutral", ["cash bank contra"], "internal transfer not debt"),
        ("write off receivable", ["bad debt write"], "expense", ["Ram 500 write off"], "uncollectible debt"),
        ("recovery", ["recover", "firta aayo"], "income", ["bad debt recover 200"], "recovered written off debt"),
        ("interest on loan", ["byaj"], "expense", ["loan byaj 2000"], "interest on borrowed money"),
        ("principal", ["mooldhana"], "payable", ["principal 100000"], "loan principal"),
        ("maturity", ["paripakwata"], "neutral", ["loan maturity"], "loan due date"),
        ("guarantee", ["jamin"], "contingent", ["jamin diye"], "guarantee given"),
        ("mortgage", ["dhito"], "secured_debt", ["ghar dhito"], "secured loan"),
        ("unsecured loan", ["adhikar rahit rin"], "inbound_debt", ["unsecured loan"], "loan without collateral"),
        ("intercompany", ["sambandhit company"], "ambiguous", ["intercompany udhaar"], "related party balance"),
        ("staff advance", ["karmachari advance"], "asset", ["staff advance 5000"], "advance to employee"),
        ("salary payable", ["talab tirnu baki"], "payable", ["salary payable"], "unpaid salary"),
        ("dividend payable", ["labhanash tirnu"], "payable", ["dividend payable"], "dividend owed"),
    ]
    return [
        {
            "term_roman": t,
            "variants": v,
            "direction_ambiguity": d,
            "typical_patterns": p,
            "meaning_en": m,
        }
        for t, v, d, p, m in terms
    ]


def batch_08_questions() -> list[dict]:
    patterns = [
        ("X k ho", "definition_question", ["noksan k ho", "VAT k ho", "journal k ho", "debit k ho"], "question_definition", "k ho suffix asks for explanation", "explanation"),
        ("X ke ho", "definition_question", ["sampatti ke ho", "udhaar ke ho"], "question_definition", "ke ho variant", "explanation"),
        ("kati cha", "amount_question", ["baki kati cha", "balance kati cha"], "question_balance", "asks quantity not entry", "numeric_answer"),
        ("kati %", "rate_question", ["VAT kati %", "TDS kati percent"], "question_tax_rate", "rate question not entry", "rate_answer"),
        ("kasari", "how_question", ["kasari entry garne", "kasari hisab rakhe"], "question_howto", "how-to question", "explanation"),
        ("kina", "why_question", ["kina noksan bhayo", "kina mismatch"], "question_why", "why question", "explanation"),
        ("kun ho", "which_question", ["kun account ho", "kun party ho"], "question_which", "which/selection", "explanation"),
        ("ko ho", "whose_question", ["yo party ko ho", "kas ko ho"], "question_whose", "possessive question", "explanation"),
        ("kaha", "where_question", ["entry kaha dekhaune", "report kaha cha"], "question_where", "location question", "explanation"),
        ("kahile", "when_question", ["kahile tiryo", "kahile file garne"], "question_when", "time question", "explanation"),
        ("k bhanne", "meaning_question", ["noksan k bhanne", "debit k bhanne"], "question_definition", "what does X mean", "explanation"),
        ("arth k ho", "meaning_question", ["sampatti ko arth k ho"], "question_definition", "meaning of term", "explanation"),
        ("farak k ho", "comparison_question", ["debit credit farak", "nafa noksan farak"], "question_compare", "difference question", "comparison"),
        ("compare", "comparison_question", ["asset liability compare"], "question_compare", "explicit compare", "comparison"),
        ("define", "definition_question", ["define provision", "define accrual"], "question_definition", "English define", "explanation"),
        ("explain", "definition_question", ["explain double entry"], "question_definition", "English explain", "explanation"),
        ("?", "punctuation_question", ["balance?", "VAT?"], "question_general", "question mark alone", "explanation"),
        ("k huncha", "process_question", ["entry k huncha", "VAT file k huncha"], "question_howto", "what happens", "explanation"),
        ("thik ho ki", "confirmation_question", ["yo thik ho ki", "500 thik ho"], "confirm_pending", "confirmation not new entry", "confirm_flow"),
        ("ho ki hoina", "confirmation_question", ["entry gareko ho ki hoina"], "confirm_pending", "yes/no confirm", "confirm_flow"),
        ("500 diye ki nadiye", "rhetorical_entry", ["500 diye ki nadiye"], "khata_payment_out", "rhetorical but asserts payment", "entry"),
        ("becheko ki kineko", "ambiguous_direction", ["sariya becheko ki kineko"], "needs_clarify", "direction unclear", "clarify"),
        ("noksan k ho", "critical_distinction", ["noksan k ho"], "question_definition", "QUESTION not entry", "explanation"),
        ("noksan vo 400", "critical_distinction", ["noksan vo 400", "nokshan bhayo 400"], "khata_expense", "ENTRY with amount", "entry"),
        ("VAT kati %", "critical_distinction", ["VAT kati %"], "question_tax_rate", "rate question", "rate_answer"),
        ("VAT 13% tireko", "critical_distinction", ["VAT 13% tireko"], "khata_expense", "tax payment entry", "entry"),
        ("balance sheet k ho", "report_question", ["balance sheet k ho"], "question_definition", "report concept", "explanation"),
        ("balance kati cha", "balance_question", ["balance kati cha", "khata balance"], "question_balance", "balance inquiry", "balance_answer"),
        ("Ram ko baki", "party_balance_question", ["Ram ko baki kati"], "question_balance", "party balance", "balance_answer"),
        ("entry kasari", "howto_question", ["khata entry kasari garne"], "question_howto", "how to enter", "explanation"),
        ("kati tirnu parcha", "obligation_question", ["tax kati tirnu parcha"], "question_tax", "obligation amount", "tax_answer"),
        ("kun din", "date_question", ["file kun din"], "question_when", "which date", "date_answer"),
        ("kasto cha", "status_question", ["hisaab kasto cha"], "question_status", "status inquiry", "status_answer"),
        ("sampatti k ho", "accounting_concept", ["sampatti k ho", "asset k ho"], "question_definition", "concept definition", "explanation"),
        ("kitna", "hindi_question", ["kitna baki", "kitna tax"], "question_amount", "Hindi amount question", "numeric_answer"),
        ("what is", "english_question", ["what is depreciation"], "question_definition", "English what is", "explanation"),
        ("how much", "english_amount", ["how much VAT", "how much balance"], "question_amount", "English how much", "numeric_answer"),
    ]
    return [
        {
            "pattern": p,
            "type": t,
            "examples": ex,
            "intent": intent,
            "NOT_entry_because": not_entry,
            "response_type": resp,
        }
        for p, t, ex, intent, not_entry, resp in patterns
    ]


def batch_09_discourse() -> list[dict]:
    items = [
        ("ho", ["ho", "ho ni", "hoo", "hoe"], "affirmation", "strong", "confirm_pending", "User sees card → types ho → confirms"),
        ("huncha", ["huncha", "hunchha"], "affirmation", "strong", "confirm_pending", "affirm continuation"),
        ("thik cha", ["thik cha", "thik chha", "thik"], "affirmation", "strong", "confirm_pending", "ok confirm"),
        ("sahi", ["sahi", "sahi cha", "correct"], "affirmation", "strong", "confirm_pending", "correct confirm"),
        ("hajur", ["hajur", "ji"], "affirmation", "polite", "confirm_pending", "polite yes"),
        ("la", ["la", "laa"], "affirmation", "casual", "confirm_pending", "casual ok"),
        ("ok", ["ok", "okay", "oke"], "affirmation", "strong", "confirm_pending", "English ok"),
        ("yes", ["yes", "yep", "yeah"], "affirmation", "strong", "confirm_pending", "English yes"),
        ("huss", ["huss", "huss la"], "affirmation", "casual", "confirm_pending", "done ok"),
        ("ramro", ["ramro", "ramro cha"], "affirmation", "mild", "confirm_pending", "looks good"),
        ("hoina", ["hoina", "hoina ni"], "negation", "strong", "cancel_pending", "cancel entry"),
        ("chaina", ["chaina", "chhaina", "xaina"], "negation", "strong", "cancel_pending", "no / don't"),
        ("pardaina", ["pardaina", "mildaina"], "negation", "strong", "cancel_pending", "should not"),
        ("no", ["no", "nope", "nah"], "negation", "strong", "cancel_pending", "English no"),
        ("cancel", ["cancel", "hatau", "hata"], "negation", "strong", "cancel_pending", "explicit cancel"),
        ("nagarnu", ["nagarnu", "na gar"], "negation", "strong", "cancel_pending", "don't do"),
        ("galat", ["galat", "galti", "wrong"], "correction", "strong", "correct_pending", "wrong entry"),
        ("mistake", ["mistake", "error"], "correction", "strong", "correct_pending", "English mistake"),
        ("tyo hoina", ["tyo hoina", "yo hoina"], "correction", "strong", "correct_pending", "that is wrong"),
        ("500 hoina 600", ["500 hoina 600", "500 hoina 600 ho"], "correction", "strong", "correct_amount", "amount correction"),
        ("farak cha", ["farak cha", "different"], "correction", "medium", "correct_pending", "something different"),
        ("ali ali", ["ali ali", "thikai"], "partial_confirm", "weak", "confirm_partial", "partially ok"),
        ("thikai", ["thikai", "testo"], "partial_confirm", "weak", "confirm_partial", "so-so confirm"),
        ("hola", ["hola", "holaa"], "uncertainty", "weak", "clarify_needed", "maybe uncertain"),
        ("maybe", ["maybe", "perhaps"], "uncertainty", "weak", "clarify_needed", "English maybe"),
        ("thaha bhayena", ["thaha bhayena", "thaha chaina"], "uncertainty", "medium", "clarify_needed", "don't know"),
        ("bujhena", ["bujhena", "bujhina"], "uncertainty", "medium", "clarify_needed", "didn't understand"),
        ("k bhanne", ["k bhanne", "k bhancha"], "uncertainty", "medium", "clarify_needed", "what to say"),
        ("kunni", ["kunni", "k garne"], "uncertainty", "weak", "clarify_needed", "not sure"),
        ("confirm gar", ["confirm gar", "pakka gar"], "confirmation_request", "medium", "confirm_pending", "ask confirm"),
        ("entry gar", ["entry gar", "lekha de"], "action_request", "strong", "post_entry", "request to post"),
        ("feri", ["feri", "pachi"], "continuation", "medium", "continue_flow", "continue conversation"),
        ("aru", ["aru", "arko"], "continuation", "medium", "continue_flow", "another item"),
        ("pahile ko", ["pahile ko", "agadi ko"], "reference", "medium", "reference_prior", "refer prior"),
        ("yo ho", ["yo ho", "yes yo"], "affirmation", "strong", "confirm_pending", "this one yes"),
        ("nai", ["nai", "nai ho"], "emphasis", "medium", "confirm_pending", "emphatic yes"),
        ("chaldaina", ["chaldaina", "hudaina"], "negation", "strong", "cancel_pending", "won't work"),
        ("ruk", ["ruk", "rok"], "negation", "strong", "cancel_pending", "stop"),
        ("sodh", ["sodh", "sodhnus"], "inquiry", "medium", "ask_clarify", "ask back"),
        ("hera", ["hera", "hernu"], "review", "medium", "review_card", "review entry"),
        ("change", ["change", "badal"], "correction", "strong", "correct_pending", "change request"),
        ("update", ["update", "modify"], "correction", "medium", "correct_pending", "update request"),
    ]
    return [
        {
            "pattern": p,
            "variants": v,
            "type": t,
            "strength": s,
            "multi_turn_action": a,
            "examples": [ex],
            "NOT_confused_with": "ho as verb form" if p == "ho" else None,
        }
        for p, v, t, s, a, ex in items
    ]


def batch_10_time_date() -> list[dict]:
    rows = [
        {"pattern_type": "relative_day", "terms": ["aja", "aaja", "today"], "gregorian_approx": "today", "fiscal_significance": "current_period", "usage": "aja 500 becheko"},
        {"pattern_type": "relative_day", "terms": ["hijo", "yesterday"], "gregorian_approx": "yesterday", "fiscal_significance": "prior_day", "usage": "hijo kharcha"},
        {"pattern_type": "relative_day", "terms": ["parsi", "tomorrow"], "gregorian_approx": "tomorrow", "fiscal_significance": "future", "usage": "parsi dincha"},
        {"pattern_type": "relative_day", "terms": ["abhui", "day before yesterday"], "gregorian_approx": "d-2", "fiscal_significance": "prior_day", "usage": "abhui ko"},
        {"pattern_type": "relative_day", "terms": ["naparsi", "day after tomorrow"], "gregorian_approx": "d+2", "fiscal_significance": "future", "usage": "naparsi"},
        {"pattern_type": "week", "terms": ["hapta", "week"], "gregorian_approx": "week", "fiscal_significance": "period", "usage": "yo hapta"},
        {"pattern_type": "week", "terms": ["mahina", "month"], "gregorian_approx": "month", "fiscal_significance": "period", "usage": "yo mahina"},
        {"pattern_type": "week", "terms": ["barsa", "year", "sal"], "gregorian_approx": "year", "fiscal_significance": "period", "usage": "yo barsa"},
        {"pattern_type": "fiscal_month", "terms": ["shrawan", "sawan"], "gregorian_approx": "mid-jul", "fiscal_significance": "FY_start", "usage": "shrawan 1"},
        {"pattern_type": "fiscal_month", "terms": ["bhadra"], "gregorian_approx": "mid-aug", "fiscal_significance": "FY_month_2", "usage": "bhadra"},
        {"pattern_type": "fiscal_month", "terms": ["ashwin", "aswin"], "gregorian_approx": "mid-sep", "fiscal_significance": "FY_month_3", "usage": "dashain period"},
        {"pattern_type": "fiscal_month", "terms": ["kartik"], "gregorian_approx": "mid-oct", "fiscal_significance": "FY_month_4", "usage": "tihar period"},
        {"pattern_type": "fiscal_month", "terms": ["mangsir"], "gregorian_approx": "mid-nov", "fiscal_significance": "FY_month_5", "usage": "mangsir"},
        {"pattern_type": "fiscal_month", "terms": ["poush"], "gregorian_approx": "mid-dec", "fiscal_significance": "FY_month_6", "usage": "poush"},
        {"pattern_type": "fiscal_month", "terms": ["magh"], "gregorian_approx": "mid-jan", "fiscal_significance": "FY_month_7", "usage": "magh"},
        {"pattern_type": "fiscal_month", "terms": ["falgun", "fagun"], "gregorian_approx": "mid-feb", "fiscal_significance": "FY_month_8", "usage": "falgun"},
        {"pattern_type": "fiscal_month", "terms": ["chaitra", "chait"], "gregorian_approx": "mid-mar", "fiscal_significance": "FY_month_9", "usage": "chaitra"},
        {"pattern_type": "fiscal_month", "terms": ["baishakh", "baisakh"], "gregorian_approx": "mid-apr", "fiscal_significance": "FY_month_10", "usage": "baishakh"},
        {"pattern_type": "fiscal_month", "terms": ["jestha", "jesta"], "gregorian_approx": "mid-may", "fiscal_significance": "FY_month_11", "usage": "jestha"},
        {"pattern_type": "fiscal_month", "terms": ["ashadh", "asad"], "gregorian_approx": "mid-jun", "fiscal_significance": "FY_end", "usage": "FY close ashadh"},
        {"pattern_type": "bs_date", "terms": ["bs", "vikram", "bikram sambat"], "gregorian_approx": "nepali_calendar", "fiscal_significance": "official_date", "usage": "2081/04/15"},
        {"pattern_type": "bs_date", "terms": ["ad", "english date"], "gregorian_approx": "gregorian", "fiscal_significance": "alternate_date", "usage": "2024-07-01"},
        {"pattern_type": "quarter", "terms": ["quarter", "trimasik"], "gregorian_approx": "quarter", "fiscal_significance": "reporting", "usage": "Q1 report"},
        {"pattern_type": "deadline", "terms": ["last date", "antim miti"], "gregorian_approx": "deadline", "fiscal_significance": "compliance", "usage": "VAT last date"},
        {"pattern_type": "period", "terms": ["period", "awadhi"], "gregorian_approx": "range", "fiscal_significance": "reporting", "usage": "yo awadhi"},
        {"pattern_type": "opening", "terms": ["opening", "suruwati"], "gregorian_approx": "period_start", "fiscal_significance": "opening_balance", "usage": "opening balance"},
        {"pattern_type": "closing", "terms": ["closing", "antim"], "gregorian_approx": "period_end", "fiscal_significance": "closing_balance", "usage": "month end closing"},
        {"pattern_type": "festival", "terms": ["dashain", "tihar"], "gregorian_approx": "festival", "fiscal_significance": "seasonal", "usage": "dashain bonus"},
        {"pattern_type": "festival", "terms": ["holi", "teej"], "gregorian_approx": "festival", "fiscal_significance": "seasonal", "usage": "festival kharcha"},
        {"pattern_type": "time_of_day", "terms": ["bihan", "morning"], "gregorian_approx": "am", "fiscal_significance": "timestamp", "usage": "bihan ko"},
        {"pattern_type": "time_of_day", "terms": ["dopahar", "afternoon"], "gregorian_approx": "pm", "fiscal_significance": "timestamp", "usage": "dopahar"},
        {"pattern_type": "time_of_day", "terms": ["beluka", "evening"], "gregorian_approx": "eve", "fiscal_significance": "timestamp", "usage": "beluka"},
        {"pattern_type": "time_of_day", "terms": ["rati", "night"], "gregorian_approx": "night", "fiscal_significance": "timestamp", "usage": "rati"},
        {"pattern_type": "duration", "terms": ["din", "days"], "gregorian_approx": "days", "fiscal_significance": "aging", "usage": "15 din baki"},
        {"pattern_type": "duration", "terms": ["mahina", "months"], "gregorian_approx": "months", "fiscal_significance": "aging", "usage": "3 mahina"},
        {"pattern_type": "due", "terms": ["miyad", "due date"], "gregorian_approx": "due", "fiscal_significance": "payable", "usage": "miyad ashadh"},
        {"pattern_type": "backdate", "terms": ["pahile ko date", "backdate"], "gregorian_approx": "past", "fiscal_significance": "adjustment", "usage": "hijo ko date ma"},
        {"pattern_type": "postdate", "terms": ["pachi ko", "postdate"], "gregorian_approx": "future", "fiscal_significance": "scheduled", "usage": "parsi ko lagi"},
        {"pattern_type": "instant", "terms": ["aile", "abhi", "now"], "gregorian_approx": "now", "fiscal_significance": "current", "usage": "aile tiryo"},
        {"pattern_type": "range", "terms": ["dekhi", "bata", "from"], "gregorian_approx": "range_start", "fiscal_significance": "period", "usage": "shrawan dekhi"},
        {"pattern_type": "range", "terms": ["samma", "until", "to"], "gregorian_approx": "range_end", "fiscal_significance": "period", "usage": "ashadh samma"},
    ]
    return rows


def main() -> int:
    files = [
        ("numbers_amounts.jsonl", batch_05_numbers()),
        ("profit_loss_vocab.jsonl", batch_06_profit_loss()),
        ("credit_debt_vocab.jsonl", batch_07_credit_debt()),
        ("question_patterns.jsonl", batch_08_questions()),
        ("affirmation_negation.jsonl", batch_09_discourse()),
        ("time_date.jsonl", batch_10_time_date()),
    ]
    for name, rows in files:
        path = LANG / name
        write_jsonl(path, rows)
        print(f"Wrote {path} ({len(rows)} rows)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
