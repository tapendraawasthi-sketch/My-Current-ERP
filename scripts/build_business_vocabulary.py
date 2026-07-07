#!/usr/bin/env python3
"""Build categorized Nepali/English business vocabulary JSON files for e-Khata."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "ekhata" / "vocabulary" / "categories"


def cat(
    slug: str,
    en: str,
    ne: str,
    ne_roman: str,
    nature: str,
    tags: list[str],
    sector_slug: str | None = None,
    **groups: dict,
) -> dict:
    return {
        "id": slug,
        "slug": slug,
        "displayName": {"en": en, "ne": ne, "ne_roman": ne_roman},
        "businessNature": nature,
        "tags": tags,
        "sectorSlug": sector_slug,
        "groups": groups,
    }


# ── Universal transaction verbs (all businesses) ─────────────────────────────
UNIVERSAL_TRANSACTIONS = {
    "sale_verbs": {
        "label": {"en": "Sale verbs", "ne": "बिक्री क्रिया"},
        "intentHint": "khata_cash_sale",
        "en": [
            "sold", "sell", "sale", "sales", "revenue", "income", "earned", "invoiced", "billed",
            "retail sale", "cash sale", "credit sale", "wholesale sale", "dispatch", "delivered",
        ],
        "ne_roman": [
            "becheko", "beche", "bechyo", "bechye", "bechiyeko", "bechne", "bechnu", "bechda",
            "bikri", "bikyo", "bikyayo", "bikne", "biknu", "bikda", "bikyo", "bikri vayo",
            "nagad bikri", "udhaar bikri", "cash ma becheko", "nagad ma becheko",
            "maal gayo", "saman becheko", "samaan bikyo", "bikri gareko", "sales gareko",
        ],
        "ne_devanagari": ["बेचेको", "बेचyo", "बिक्री", "बिकyo", "माल गयो", "सामान बेचेको"],
        "variants": [
            "beche", "bechya", "bechiyeko", "bechiyeko", "bechiyeko", "bik", "biknu", "bikda",
            "bikri garyo", "bikri bhayo", "sale gareko", "sold out",
        ],
    },
    "purchase_verbs": {
        "label": {"en": "Purchase verbs", "ne": "खरिद क्रिया"},
        "intentHint": "khata_purchase",
        "en": [
            "bought", "buy", "purchase", "purchased", "procured", "procure", "ordered", "received goods",
            "stock in", "goods received", "imported", "sourced",
        ],
        "ne_roman": [
            "kineko", "kine", "kinyo", "kinye", "kiniyo", "kinna", "kinne", "kinnu", "kina", "kinchhu",
            "kinxu", "kharid", "kharido", "kharidyo", "kharideko", "kharid gareko", "maal aayo",
            "saman aayo", "samaan liyeko", "stock aayo", "order gareko", "order aayo",
        ],
        "ne_devanagari": ["किनेको", "खरिद", "माल आयो", "सामान लिएको"],
        "variants": ["kin", "kinyo", "kinye", "kharidne", "kharid garyo", "purchase gareko"],
    },
    "payment_in": {
        "label": {"en": "Payment received", "ne": "प्राप्त भुक्तानी"},
        "intentHint": "khata_payment_in",
        "en": [
            "received", "receive", "collected", "collection", "payment in", "cash in", "deposit received",
            "settlement received", "recovery", "recovered",
        ],
        "ne_roman": [
            "tiryo", "tireko", "tire", "tira", "tiryoo", "jama", "jamayo", "aayo", "aayeko", "aaye",
            "payo", "paye", "milyo", "milyo", "paisa aayo", "rakam aayo", "jamma gareko", "wasool",
            "wasul", "prapta", "prapti", "udharo katyo", "khata katyo", "farak aayo",
        ],
        "ne_devanagari": ["तिरyo", "जम्मा", "आयो", "पैसा आयो", "उधारो काटyo"],
        "variants": ["tirna", "tirnu", "jama gareko", "payment aayo", "received payment"],
    },
    "payment_out": {
        "label": {"en": "Payment made", "ne": "भुक्तानी गरiyo"},
        "intentHint": "khata_payment_out",
        "en": [
            "paid", "pay", "payment made", "payment out", "sent", "transferred", "disbursed", "settled",
            "remitted", "cleared bill",
        ],
        "ne_roman": [
            "tiryo diye", "tirna diye", "bhugtan", "bhugtan gareko", "payment gareko", "paisa diye",
            "diye", "diyo", "diyeko", "tireko", "cheque diye", "bank bata tireko", "cash diye",
            "farak diye", "bill tireko", "bill pay gareko",
        ],
        "ne_devanagari": ["भुक्तान", "तिरyo", "दियो", "पैसा दिए"],
        "variants": ["payment garyo", "paid cash", "paid online", "bill clear gareko"],
    },
    "expense_verbs": {
        "label": {"en": "Expense verbs", "ne": "खर्च क्रिया"},
        "intentHint": "khata_expense",
        "en": [
            "expense", "expenses", "spent", "spend", "cost", "charge", "fee", "bill paid", "utility paid",
        ],
        "ne_roman": [
            "kharcha", "kharcho", "karcha", "kharcha gareko", "kharcha bhayo", "kharcha lagyo",
            "kharcha tireko", "bill tireko", "bill aayo", "kharcha diye",
        ],
        "ne_devanagari": ["खर्च", "खर्चा", "बिल तिरyo"],
        "variants": ["expense gareko", "spent on", "kharch lagyo"],
    },
    "credit_terms": {
        "label": {"en": "Credit / udhaar", "ne": "उधार"},
        "intentHint": "credit",
        "en": ["credit", "on credit", "due", "outstanding", "receivable", "payable", "deferred"],
        "ne_roman": [
            "udhaar", "udhar", "udharo", "udhaar diye", "udhaar liyeko", "udhaar ma", "credit ma",
            "baki", "baki cha", "baki rahyo", "diney", "linu parne", "asuli", "karz", "karja",
            "pachi tirne", "agami hafta tirne", "khata ma", "hisab ma rakheko",
        ],
        "ne_devanagari": ["उधार", "उधारो", "बाँकी", "असुली"],
        "variants": ["udhar diye", "udharo diye", "on udhaar", "credit sale", "credit purchase"],
    },
    "cash_terms": {
        "label": {"en": "Cash / nagad", "ne": "नगद"},
        "intentHint": "cash",
        "en": ["cash", "in cash", "cash payment", "petty cash", "till", "counter cash"],
        "ne_roman": [
            "nagad", "nakad", "nakit", "cash ma", "nagad ma", "hath ma", "counter bata", "petty cash",
            "nagad bikri", "nagad tiryo", "cash payment", "note ma", "thaili bata",
        ],
        "ne_devanagari": ["नगद", "नकद", "हातमा"],
        "variants": ["cash ma", "nagad payment", "by cash"],
    },
    "return_refund": {
        "label": {"en": "Return / refund", "ne": "फिर्ता"},
        "intentHint": "return",
        "en": ["return", "returned", "refund", "refunded", "credit note", "debit note", "exchange"],
        "ne_roman": [
            "firta", "firta diye", "return gareko", "wapas", "wapasi", "exchange", "badli",
            "sales return", "purchase return", "customer le firta", "supplier lai firta",
        ],
        "ne_devanagari": ["फिर्ता", "वापस"],
        "variants": ["refund gareko", "return bhayo", "firta garyo"],
    },
}

UNIVERSAL_UNITS = {
    "quantity_units": {
        "label": {"en": "Quantity units", "ne": "मापन एकाइ"},
        "en": [
            "piece", "pieces", "pc", "pcs", "unit", "units", "each", "per", "dozen", "pair", "set",
            "box", "packet", "carton", "crate", "bundle", "roll", "sheet", "bag", "sack", "bora",
            "kg", "kilogram", "gram", "gm", "liter", "litre", "ltr", "ml", "meter", "metre", "ft",
            "sqft", "sq ft", "ton", "quintal", "hour", "hours", "day", "days", "month",
        ],
        "ne_roman": [
            "euta", "eutako", "eutai", "ota", "otako", "wota", "wotako", "joda", "jodako", "dozen",
            "packet", "box", "carton", "bora", "bora ko", "kg", "kilo", "gram", "gm", "liter", "ltr",
            "mitar", "ghanta", "din", "mahina", "thaili", "gaddi", "bundle", "roll",
        ],
        "ne_devanagari": ["एउटा", "एउटाको", "वटा", "जोडा", "बोरा", "प्याकेट"],
        "variants": ["per piece", "per unit", "per kg", "per dozen", "prati", "prati ko"],
    },
    "price_phrases": {
        "label": {"en": "Price phrases", "ne": "मूल्य वाक्यांश"},
        "en": [
            "for", "at", "worth", "total", "amount", "rate", "price", "mrp", "cost", "each", "per",
            "@", "rs", "npr", "rupees",
        ],
        "ne_roman": [
            "ko", "ma", "jamma", "jami", "total", "rate", "mulya", "mulya", "dam", "daam", "mrp",
            "kati ko", "kati ma", "rupiya ko", "rs ko", "prati", "prati ko", "per piece",
        ],
        "ne_devanagari": ["को", "मा", "जम्मा", "मूल्य", "दाम"],
        "variants": ["worth of", "total of", "amount of"],
    },
}

UNIVERSAL_PAYMENT = {
    "digital_wallets": {
        "label": {"en": "Digital wallets", "ne": "डिजिटल वालेट"},
        "en": ["esewa", "khalti", "ime pay", "connectips", "fonepay", "digital wallet", "qr payment"],
        "ne_roman": [
            "esewa", "e sewa", "khalti", "ime pay", "connectips", "connect ips", "fonepay", "fone pay",
            "qr", "qr bata", "online", "digital", "wallet", "mobile banking", "m banking",
        ],
        "ne_devanagari": ["ईसेवा", "खल्ती"],
        "variants": ["e-sewa", "khalti ma", "esewa ma", "online payment"],
    },
    "bank_cheque": {
        "label": {"en": "Bank / cheque", "ne": "बैंक / चेक"},
        "en": [
            "bank", "bank transfer", "neft", "rtgs", "cheque", "check", "dd", "demand draft",
            "current account", "savings account", "connect ips",
        ],
        "ne_roman": [
            "bank", "bank bata", "bank ma", "cheque", "cheque bata", "chak", "chak bata", "transfer",
            "neft", "rtgs", "jamma bank ma", "bank jamma", "khata ma jamma",
        ],
        "ne_devanagari": ["बैंक", "चेक", "जम्मा"],
        "variants": ["bank transfer", "cheque payment", "by cheque"],
    },
}

UNIVERSAL_ACCOUNTING = {
    "elements": {
        "label": {"en": "Accounting elements", "ne": "लेखा तत्व"},
        "en": [
            "asset", "assets", "liability", "liabilities", "equity", "capital", "income", "revenue",
            "expense", "expenses", "profit", "loss", "drawings", "dividend", "depreciation",
            "provision", "accrual", "prepaid", "outstanding", "receivable", "payable", "inventory",
            "stock", "fixed asset", "current asset", "goodwill", "amortization",
        ],
        "ne_roman": [
            "sampatti", "sampati", "dayitwo", "dayitwa", "rin", "karz", "punji", "puni", "poonji",
            "aamdani", "aay", "kharcha", "nafa", "ghata", "ghataa", "hral", "hral gareko",
            "drawings", "ghar kharcha", "malik le liyeko", "stock", "saman", "inventory", "hisab",
            "lekha", "journal", "voucher", "bill", "invoice", "debit", "credit", "dr", "cr",
        ],
        "ne_devanagari": [
            "सम्पत्ति", "दायित्व", "पुँजी", "आम्दानी", "खर्च", "नाफा", "घाटा", "लेखा",
        ],
        "variants": ["assets and liabilities", "profit and loss", "balance sheet", "trial balance"],
    },
    "tax_compliance": {
        "label": {"en": "Tax & compliance", "ne": "कर तथा अनुपालन"},
        "en": [
            "vat", "tds", "ssf", "cit", "income tax", "excise", "customs", "pan", "vat bill",
            "tax invoice", "withholding", "advance tax", "tax deductible", "tax credit",
        ],
        "ne_roman": [
            "vat", "byat", "bhyat", "tds", "ssf", "cit", "income tax", "kar", "tax", "pan",
            "vat bill", "tax bill", "vat registered", "non vat", "excise", "customs", "bojho",
            "bojh", "kaatyo", "kaateko", "withholding", "advance tax",
        ],
        "ne_devanagari": ["भ्याट", "कर", "आयकर", "टीडीएस"],
        "variants": ["vat registered", "non-vat bill", "tds kaateko"],
    },
}

# Sector-specific item lists (comprehensive for Nepal SME)
KIRANA_ITEMS = [
    "chamal", "rice", "atta", "flour", "daal", "dal", "lentil", "nun", "salt", "chini", "sugar",
    "tel", "oil", "mustard oil", "sunflower oil", "ghee", "dahi", "yogurt", "dudh", "milk", "pani",
    "water", "chiya", "tea", "chiya patti", "tea leaves", "coffee", "biscuit", "cookie", "noodles",
    "chowmein", "maggie", "instant noodles", "chips", "kurkure", "namkin", "snacks", "chocolate",
    "candy", "toffee", "soap", "sabun", "shampoo", "detergent", "surf", "toothpaste", "colgate",
    "cigarette", "cigrate", "bidi", "matchbox", "lighter", "egg", "anda", "bread", "pao", "pao bun",
    "masala", "spice", "haldi", "turmeric", "mirch", "chili", "jeera", "cumin", "dhaniya",
    "coriander", "besan", "suji", "semolina", "maida", "pitho", "cornflakes", "oats", "honey",
    "jam", "ketchup", "sauce", "pickle", "achar", "papad", "dry fruit", "badam", "kaju", "pista",
    "gas", "cylinder", "lpg", "gyas", "battery", "torch", "candle", "mombati", "stationery",
    "pen", "copy", "notebook", "envelope", "stamp", "medicine", "osadi", "painkiller",
]

RESTAURANT_ITEMS = [
    "momo", "samosa", "chatpate", "chowmein", "fried rice", "biryani", "dal bhat", "tarkari",
    "achar", "pickle", "tea", "chiya", "coffee", "lassi", "juice", "cold drink", "coke", "pepsi",
    "water", "mineral water", "beer", "wine", "whisky", "raksi", "local wine", "snacks", "pakoda",
    "pakauda", "paratha", "roti", "naan", "curry", "masu", "meat", "chicken", "mutton", "buff",
    "fish", "egg", "anda", "paneer", "tofu", "soup", "salad", "dessert", "ice cream", "kheer",
    "sel roti", "yomari", "newari khaja", "thakali set", "set meal", "combo", "platter",
    "takeaway", "parcel", "delivery", "table", "dine in", "catering", "party order", "buffet",
]

PHARMACY_ITEMS = [
    "medicine", "osadi", "tablet", "capsule", "syrup", "injection", "drops", "ointment", "cream",
    "gel", "bandage", "plaster", "cotton", "gauze", "thermometer", "bp machine", "mask", "sanitizer",
    "paracetamol", "cetamol", "antibiotic", "painkiller", "vitamin", "supplement", "ORS", "antacid",
    "cough syrup", "cold medicine", "fever medicine", "insulin", "inhaler", "eye drop", "ear drop",
    "contraceptive", "pregnancy test", "diaper", "baby care", "first aid", "surgical", "generic",
    "branded medicine", "prescription", "otc", "schedule h", "expiry", "batch", "strip", "bottle",
]

CLOTHING_ITEMS = [
    "shirt", "pant", "trouser", "jeans", "tshirt", "t shirt", "kurta", "suit", "coat", "jacket",
    "sweater", "hoodie", "sari", "saree", "lehenga", "kurti", "salwar", "dupatta", "scarf",
    "underwear", "innerwear", "socks", "moja", "belt", "tie", "cap", "hat", "gloves", "uniform",
    "school dress", "fabric", "cloth", "suti", "cotton", "silk", "wool", "linen", "denim",
    "chiffon", "georgette", "tailoring", "alteration", "stitching", "size", "color", "design",
]

FOOTWEAR_ITEMS = [
    "shoe", "shoes", "sandal", "slipper", "chappal", "boot", "sneaker", "sports shoe", "formal shoe",
    "ladies shoe", "gents shoe", "kids shoe", "school shoe", "hawai chappal", "flip flop", "heel",
    "wedge", "loafer", "mojari", "leather", "suede", "sole", "lace", "insole", "polish", "repair",
]

COSMETIC_ITEMS = [
    "lipstick", "lip gloss", "foundation", "compact", "powder", "kajal", "eyeliner", "mascara",
    "nail polish", "nail paint", "cream", "lotion", "moisturizer", "sunscreen", "serum", "toner",
    "face wash", "cleanser", "scrub", "mask", "pack", "perfume", "deo", "deodorant", "hair oil",
    "hair gel", "hair spray", "hair color", "dye", "shampoo", "conditioner", "soap", "body wash",
    "makeup", "beauty", "skincare", "haircare", "nail care", "bleach", "facial", "threading",
]

CLINIC_ITEMS = [
    "consultation", "opd", "checkup", "follow up", "emergency", "admission", "discharge", "bed charge",
    "nursing", "procedure", "surgery", "operation", "lab test", "pathology", "xray", "x ray", "ultrasound",
    "ecg", "echo", "mri", "ct scan", "vaccine", "immunization", "injection", "iv", "drip", "dressing",
    "stitch", "suture", "physiotherapy", "dental", "cleaning", "extraction", "filling", "root canal",
    "health package", "annual checkup", "medical certificate", "referral", "ambulance",
]

WHOLESALE_ITEMS = [
    "bulk", "wholesale", "thok", "carton", "case", "container", "truck load", "distributor",
    "dealer", "mahajani", "supplier", "manufacturer", "import", "export", "margin", "trade discount",
    "scheme", "free goods", "sample", "display", "godown", "warehouse", "dispatch", "delivery note",
    "challan", "gate pass", "loading", "unloading", "freight", "transport charge",
]

MANUFACTURING_ITEMS = [
    "raw material", "wip", "work in progress", "finished goods", "production", "manufacturing",
    "batch", "job order", "process cost", "overhead", "labor", "labour", "machine", "maintenance",
    "spare parts", "consumables", "packing material", "scrap", "wastage", "rejection", "quality check",
    "bom", "bill of materials", "standard cost", "variance", "factory", "plant", "shift",
]

CONSTRUCTION_ITEMS = [
    "cement", "iron rod", "steel", "sand", "bajri", "gravel", "brick", "block", "tile", "marble",
    "granite", "wood", "timber", "plywood", "paint", "putty", "wire", "pipe", "fitting", "sanitary",
    "plumbing", "electrical", "labour", "mason", "carpenter", "contractor", "subcontract", "ra bill",
    "running bill", "retention", "advance recovery", "site expense", "equipment hire", "scaffolding",
]

AGRICULTURE_ITEMS = [
    "seed", "fertilizer", "urea", "dap", "pesticide", "insecticide", "herbicide", "tractor", "tiller",
    "harvest", "crop", "paddy", "wheat", "maize", "potato", "vegetable", "fruit", "milk", "dairy",
    "poultry", "chicken farm", "goat", "buffalo", "feed", "fodder", "greenhouse", "irrigation",
    "canal", "tube well", "subsidy", "cooperative", "mandi", "market price",
]

TRANSPORT_ITEMS = [
    "freight", "cargo", "load", "trip", "route", "fuel", "diesel", "petrol", "toll", "parking",
    "maintenance", "repair", "tyre", "spare", "driver salary", "helper", "commission", "booking",
    "parcel", "courier", "delivery", "logistics", "warehouse rent", "customs", "clearance",
]

EDUCATION_ITEMS = [
    "tuition", "fee", "admission", "registration", "exam fee", "library", "lab fee", "hostel",
    "transport fee", "uniform", "book", "stationery", "scholarship", "donation", "grant", "salary",
    "teacher", "staff", "training", "course", "certificate", "workshop", "seminar",
]

BANKING_ITEMS = [
    "interest", "byaj", "loan", "rin", "emi", "installment", "kist", "principal", "penalty",
    "processing fee", "service charge", "commission", "forex", "remittance", "deposit", "fixed deposit",
    "recurring deposit", "overdraft", "od", "lc", "letter of credit", "guarantee", "collateral",
    "mortgage", "npl", "provision", "write off", "recovery", "refinance",
]

TELECOM_IT_ITEMS = [
    "software", "license", "subscription", "saas", "hosting", "domain", "server", "cloud", "api",
    "development", "maintenance", "support", "consulting", "hardware", "laptop", "computer", "printer",
    "network", "internet", "broadband", "mobile", "sim", "recharge", "data pack", "sms", "call rate",
]

INSURANCE_ITEMS = [
    "premium", "policy", "claim", "renewal", "coverage", "sum insured", "deductible", "commission",
    "life insurance", "health insurance", "motor insurance", "fire insurance", "marine insurance",
    "travel insurance", "endorsement", "surrender", "maturity", "bonus", "rider",
]

HYDROPOWER_ITEMS = [
    "generation", "unit", "kwh", "megawatt", "tariff", "ppa", "wheeling", "royalty", "water use",
    "maintenance", "turbine", "penstock", "transmission", "grid", "outage", "downtime", "capacity",
]

NGO_ITEMS = [
    "grant", "donation", "fund", "project", "program", "beneficiary", "sub grant", "reporting",
    "audit", "compliance", "overhead", "admin cost", "field expense", "travel", "per diem", "stipend",
]

MEDIA_ITEMS = [
    "advertisement", "ad", "spot", "airtime", "banner", "sponsorship", "subscription", "circulation",
    "printing", "design", "content", "production", "royalty", "license fee", "broadcast",
]

REMITTANCE_ITEMS = [
    "remittance", "transfer", "exchange rate", "commission", "payout", "agent", "corridor",
    "inbound", "outbound", "compliance", "kyc", "aml", "settlement", "float", "cash in", "cash out",
]

# Universal spelling aliases merged from all sectors
SPELLING_ALIASES = {
    "bechye": "becheko", "bechya": "becheko", "bechiyeko": "becheko", "bechiyeko": "becheko",
    "bechiyeko": "becheko", "biknu": "bikri", "bikda": "bikri", "kinye": "kineko", "kiniyo": "kineko",
    "eutako": "euta ko", "eutai": "euta", "wotako": "wota ko", "pratiko": "prati ko",
    "rupiyako": "rs ko", "rupiyako": "rs ko", "thok": "wholesale", "mahajani": "wholesaler",
    "osadi": "medicine", "osadhi": "medicine", "aushadhi": "medicine", "cigrate": "cigarette",
    "chiya": "tea", "chiyapatti": "tea leaves", "chiya patti": "tea leaves", "gyas": "gas",
    "chini": "sugar", "daal": "dal", "chamal": "rice", "atta": "flour", "tel": "oil",
    "sabun": "soap", "dahi": "yogurt", "anda": "egg", "momo": "momo", "samosa": "samosa",
    "chatpate": "chatpate", "pakoda": "pakoda", "pakauda": "pakoda", "suti": "cotton",
    "kapada": "cloth", "fabric": "cloth", "moja": "socks", "chappal": "slipper",
    "byat": "vat", "bhyat": "vat", "karz": "udhaar", "karja": "udhaar", "asuli": "receivable",
    "wasool": "tiryo", "wasul": "tiryo", "jami": "jamma", "dam": "rate", "daam": "rate",
    "mulya": "price", "mulya": "price", "saman": "stock", "samaan": "stock", "mal": "stock",
    "maal": "stock", "godown": "warehouse", "bora": "sack", "packet": "packet", "carton": "carton",
    "dozen": "dozen", "kilo": "kg", "liter": "ltr", "litre": "ltr", "mitar": "meter",
    "ghanta": "hour", "mahina": "month", "hajar": "hajar", "hazar": "hajar", "lakh": "lakh",
    "lac": "lakh", "saya": "saya", "sau": "saya", "connectips": "connectips", "fonepay": "fonepay",
    "esewa": "esewa", "khalti": "khalti", "cheque": "cheque", "chak": "cheque",
    "bijuli": "electricity", "bijli": "electricity", "rent": "bhaada", "bhaada": "bhaada",
    "bhada": "bhaada", "labour": "labour", "mazdoor": "labour", "jyala": "labour",
    "distributor": "supplier", "supliyer": "supplier", "supplier": "supplier", "dealer": "dealer",
    "grahak": "customer", "customer": "customer", "party": "party", "staff": "staff",
    "salary": "salary", "talab": "salary", "bonus": "bonus", "commission": "commission",
    "discount": "discount", "chhut": "discount", "chut": "discount", "firta": "return",
    "wapas": "return", "expire": "expired", "myad": "expiry", "kharab": "damaged",
    "bigreko": "damaged", "chori": "theft", "haraayo": "lost", "phalyo": "discarded",
}


def sector_cat(slug, en, ne, ne_roman, nature, tags, sector_slug, items_en, items_ne=None):
    items_ne = items_ne or items_en
    return cat(
        slug, en, ne, ne_roman, nature, tags, sector_slug,
        items={"label": {"en": "Products & services", "ne": "सामान र सेवा"}, "en": items_en, "ne_roman": items_ne, "ne_devanagari": [], "variants": []},
        transactions=UNIVERSAL_TRANSACTIONS["sale_verbs"],
        units=UNIVERSAL_UNITS["quantity_units"],
        spelling_aliases={"label": {"en": "Spelling variants", "ne": "हिज्जे"}, "map": SPELLING_ALIASES},
    )


CATEGORIES = [
    cat(
        "universal-transactions", "Universal Transactions", "सार्वभौमिक लेनदेन", "sarvabhaumik len den",
        "universal", ["all", "transactions", "verbs"], None, **UNIVERSAL_TRANSACTIONS,
        spelling_aliases={"label": {"en": "Spelling variants", "ne": "हिज्जे"}, "map": SPELLING_ALIASES},
    ),
    cat(
        "universal-units-pricing", "Units & Pricing", "एकाइ र मूल्य", "ekai ra mulya",
        "universal", ["units", "pricing", "quantity"], None, **UNIVERSAL_UNITS,
    ),
    cat(
        "universal-payment-modes", "Payment Modes", "भुक्तानी माध्यम", "bhuktani madhyam",
        "universal", ["payment", "digital", "bank"], None, **UNIVERSAL_PAYMENT,
    ),
    cat(
        "universal-accounting-tax", "Accounting & Tax", "लेखा र कर", "lekha ra kar",
        "universal", ["accounting", "tax", "ifrs"], None, **UNIVERSAL_ACCOUNTING,
    ),
    sector_cat("retail-kirana-grocery", "Kirana / General Grocery", "किराना पसल", "kirana pasal",
               "retail", ["grocery", "fmcg", "kirana"], "kirana-grocery", KIRANA_ITEMS),
    sector_cat("retail-mini-mart", "Mini Mart / Convenience Store", "मिनी मार्ट", "mini mart",
               "retail", ["minimart", "convenience"], "mini-mart", KIRANA_ITEMS + ["frozen", "ice cream", "ready to eat"]),
    sector_cat("wholesale-grocery", "Wholesale Grocery / Trading", "थोक किराना", "thok kirana",
               "wholesale", ["wholesale", "trading", "distribution"], "wholesale-grocery", KIRANA_ITEMS + WHOLESALE_ITEMS),
    sector_cat("clothing-fashion", "Clothing & Fashion", "लuga / Fashion", "luga fashion",
               "retail", ["clothing", "fashion", "textile"], "clothing-fashion", CLOTHING_ITEMS),
    sector_cat("footwear", "Footwear Shop", "जutta पसल", "jutta pasal",
               "retail", ["footwear", "shoes"], "footwear", FOOTWEAR_ITEMS),
    sector_cat("cosmetic-beauty", "Cosmetic & Beauty", "सौन्दर्य पसल", "saundarya pasal",
               "retail", ["cosmetic", "beauty", "salon"], "cosmetic", COSMETIC_ITEMS),
    sector_cat("pharmacy-medical", "Pharmacy / Medical Store", "औषधि पसल", "aushadhi pasal",
               "retail", ["pharmacy", "medical", "healthcare"], "pharmacy-medical", PHARMACY_ITEMS),
    sector_cat("clinic-health-service", "Clinic / Health Service", "क्लिनिक / स्वास्थ्य", "clinic swasthya",
               "services", ["clinic", "health", "medical"], "clinic-health", CLINIC_ITEMS),
    sector_cat("hospitality-restaurant-cafe", "Restaurant / Cafe / Hotel", "रेस्टुरेन्ट / होटल", "restaurant hotel",
               "hospitality", ["restaurant", "cafe", "hotel", "food"], None, RESTAURANT_ITEMS),
    sector_cat("manufacturing-production", "Manufacturing / Production", "उत्पादन / Factory", "utpadan factory",
               "manufacturing", ["factory", "production"], None, MANUFACTURING_ITEMS),
    sector_cat("construction-realestate", "Construction / Real Estate", "निर्माण / Real Estate", "nirman real estate",
               "construction", ["construction", "realestate", "contractor"], None, CONSTRUCTION_ITEMS),
    sector_cat("agriculture-farming", "Agriculture / Farming", "कृषि / पशुपालन", "krishi pashupalan",
               "agriculture", ["agriculture", "farming", "dairy"], None, AGRICULTURE_ITEMS),
    sector_cat("transport-logistics", "Transport / Logistics", "यातायात / Logistics", "yatayat logistics",
               "transport", ["transport", "logistics", "freight"], None, TRANSPORT_ITEMS),
    sector_cat("education-institute", "Education / Training Institute", "शिक्षा संस्था", "shiksha sanstha",
               "education", ["school", "college", "training"], None, EDUCATION_ITEMS),
    sector_cat("banking-finance-cooperative", "Banking / Finance / Cooperative", "बैंक / सहकारी", "bank sahakari",
               "finance", ["bank", "mfi", "cooperative"], None, BANKING_ITEMS),
    sector_cat("telecom-it-services", "Telecom / IT Services", "टेलिकम / IT", "telecom it",
               "services", ["telecom", "it", "software"], None, TELECOM_IT_ITEMS),
    sector_cat("insurance", "Insurance", "बीमा", "bima",
               "finance", ["insurance"], None, INSURANCE_ITEMS),
    sector_cat("hydropower-energy", "Hydropower / Energy", "जलvidyut / Energy", "jalvidyut energy",
               "energy", ["hydropower", "energy"], None, HYDROPOWER_ITEMS),
    sector_cat("ngo-nonprofit", "NGO / Non-profit", "गैह्र सरकारी", "gair sarkari",
               "nonprofit", ["ngo", "nonprofit", "donor"], None, NGO_ITEMS),
    sector_cat("media-advertising", "Media / Advertising", "मिडिया / विज्ञापन", "media vigyapan",
               "media", ["media", "advertising", "publishing"], None, MEDIA_ITEMS),
    sector_cat("remittance-money-transfer", "Remittance / Money Transfer", "रेमिट्यान्स", "remittance",
               "finance", ["remittance", "money transfer", "forex"], None, REMITTANCE_ITEMS),
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    registry = {
        "version": 1,
        "description": "Categorized Nepali/English business vocabulary for e-Khata NLU",
        "categories": [],
    }
    for c in CATEGORIES:
        path = OUT / f"{c['slug']}.json"
        path.write_text(json.dumps(c, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        registry["categories"].append({
            "slug": c["slug"],
            "displayName": c["displayName"],
            "businessNature": c["businessNature"],
            "tags": c["tags"],
            "sectorSlug": c.get("sectorSlug"),
            "file": f"categories/{c['slug']}.json",
        })
        print(f"Wrote {path.name} ({len(json.dumps(c))} bytes)")

    reg_path = ROOT / "data" / "ekhata" / "vocabulary" / "_registry.json"
    reg_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Registry: {len(registry['categories'])} categories → {reg_path}")


if __name__ == "__main__":
    main()
