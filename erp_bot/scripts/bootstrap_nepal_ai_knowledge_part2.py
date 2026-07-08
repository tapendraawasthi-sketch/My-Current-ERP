"""Part 2 of knowledge bootstrap — banking, gov, geography, festivals, food, construction, proverbs, typos."""

from __future__ import annotations

from pathlib import Path
from typing import Callable


def banking_finance() -> list[dict]:
    terms = [
        ("savings account", "बचत खाता", "Deposit account earning interest", "Bank/FI product for individuals"),
        ("current account", "चालु खाता", "Transactional account for business", "Frequent deposits/withdrawals"),
        ("fixed deposit", "मियादी निक्षेप", "Locked deposit at fixed rate", "FD certificate — premature penalty"),
        ("overdraft", "ओभरड्राफ्ट", "Withdraw more than balance — loan facility", "Interest on utilized amount"),
        ("cheque", "चेक", "Written order to bank to pay", "Account payee, date, signature"),
        ("pay order", "पे ओर्डर", "Bank-guaranteed payment instrument", "For large/secure payments"),
        ("demand draft", "डिमाण्ड ड्राफ्ट", "Bank draft payable on demand", "Used for remittance"),
        ("NEFT", "राष्ट्रिय इलेक्ट्रोनिक कोष स्थानान्तरण", "Domestic electronic fund transfer", "Batch settlement system"),
        ("RTGS", "रियल टाइम सेटलमेन्ट", "High-value instant transfer", "Same-day settlement"),
        ("SWIFT", "स्विफ्ट", "International wire messaging", "Cross-border payments"),
        ("remittance", "प्रेषण", "Money sent from abroad", "Major Nepal forex inflow"),
        ("exchange rate", "विनिमय दर", "Currency conversion rate", "NRB reference rate daily"),
        ("NRB", "नेपाल राष्ट्र बैंक", "Central bank of Nepal", "Monetary policy, forex, regulation"),
        ("BFI", "बैंक तथा वित्तीय संस्था", "Banks and financial institutions", "Licensed by NRB"),
        ("interest rate", "ब्याज दर", "Cost of borrowing / return on deposit", "Base rate + spread"),
        ("EMI", "समान मासिक किस्ता", "Equal monthly installment loan repayment", "Home, vehicle, business loans"),
        ("collateral", "धितो", "Security pledged for loan", "Property, FD lien, goods"),
        ("CIB", "क्रेडिट सूचना केन्द्र", "Credit Information Bureau", "Loan history blacklist check"),
        ("credit score", "क्रेडिट स्कोर", "Borrower risk rating", "Affects loan approval"),
        ("KYC", "ग्राहक परिचय", "Know Your Customer verification", "Citizenship, photo, address"),
        ("AML", "रकम सेवा निवारण", "Anti-money laundering compliance", "Suspicious transaction report"),
        ("mobile banking", "मोबाइल बैंकिङ", "Banking via app", "Transfer, balance, QR pay"),
        ("QR payment", "क्यूआर भुक्तानी", "Scan-to-pay via Nepal Pay etc.", "Retail instant payment"),
        ("Nepal Pay", "नेपाल पे", "National payment switch", "Interoperable QR"),
        ("eSewa", "ईसेवा", "Digital wallet", "Utility, transfer, merchant pay"),
        ("Khalti", "खल्ती", "Digital wallet", "Similar to eSewa"),
        ("IME Pay", "आईएमई पे", "Remittance-linked wallet", "Receive abroad send home"),
        ("letter of credit", "क्रेडिट पत्र", "Bank guarantee for import payment", "Trade finance"),
        ("bank guarantee", "बैंक ग्यारेन्टी", "Bank undertakes to pay if client defaults", "Tender, contract security"),
        ("working capital loan", "कारोबार ऋण", "Short-term business liquidity", "Stock, receivable financing"),
        ("term loan", "अवधि ऋण", "Medium/long business loan", "Fixed repayment schedule"),
        ("mortgage loan", "धितो ऋण", "Loan against property", "Home purchase common"),
        ("microfinance", "सूक्ष्म वित्त", "Small loans to low-income groups", "MFI regulated sector"),
        ("cooperative", "सहकारी", "Member-owned financial coop", "Savings/credit locally"),
        ("capital adequacy", "पूँजी पर्याप्तता", "Bank capital vs risk-weighted assets", "NRB prudential norm"),
        ("repo rate", "रेपो दर", "NRB rate for liquidity to banks", "Affects lending rates"),
        ("bank reconciliation", "बैंक मिलान", "Match bank statement to cash book", "Monthly accounting task"),
        ("dishonored cheque", "अस्वीकृत चेक", "Cheque returned unpaid", "NI Act consequences"),
        ("POS machine", "पीओएस मेसिन", "Card swipe terminal", "Merchant acquiring"),
        ("merchant discount", "व्यापारी छुट", "MDR fee on card payments", "Expense to retailer"),
        ("forex gain", "विनिमय लाभ", "Profit from currency rate change", "Unrealized vs realized"),
        ("forex loss", "विनिमय हानि", "Loss from currency movement", "Revaluation at period end"),
    ]
    return [{"term": t, "nepali": n, "meaning_en": m, "usage_context": u,
             "common_questions": [f"{t} k ho?", f"{t} kasari use garne?"]} for t, n, m, u in terms]


def government_services() -> list[dict]:
    terms = [
        ("ward office", "वडा कार्यालय", "Local ward administration", "Recommendation, registration"),
        ("municipality", "नगरपालिका", "Urban local government", "Business registration, tax"),
        ("rural municipality", "गाउँपालिका", "Rural local government", "Local permits"),
        ("Malpot office", "मालपोत कार्यालय", "Land revenue/registration office", "Lalpurja, naamsari"),
        ("DOI", "उद्योग विभाग", "Department of Industry", "Company, trademark"),
        ("OCR", "कम्पनी रजistrar", "Company Registrar", "Incorporation filings"),
        ("IRD office", "आन्तरिक राजस्व कार्यालय", "Tax office", "PAN, VAT, income tax"),
        ("customs office", "भन्सार कार्यालय", "Import/export clearance", "Customs duty, VAT at border"),
        ("DOTM", "यातायात व्यवस्था विभाग", "Transport management", "Vehicle registration"),
        ("traffic police", "ट्राफिक प्रहरी", "Vehicle fines, license points", "Chitwan etc."),
        ("citizenship certificate", "नागरिकता", "National ID document", "Required for PAN, bank"),
        ("passport", "राहदानी", "Travel document", "MRP from MoFA"),
        ("driving license", "सवारी चालक अनुमतिपत्र", "License to drive", "DOTM/Yatayat"),
        ("bluebook", "निलो किताब", "Vehicle registration book", "Renew annually"),
        ("PAN application", "प्यान आवेदन", "Apply for tax ID", "IRD online/offline"),
        ("VAT registration", "भ्याट दर्ता", "Register for VAT", "Above turnover threshold"),
        ("business registration", "व्यवसाय दर्ता", "Register shop/enterprise", "Local government"),
        ("industry registration", "उद्योग दर्ता", "Register manufacturing", "DOI"),
        ("export license", "निर्यात अनुमति", "Permission to export goods", "Trade promotion"),
        ("import license", "आयात अनुमति", "Restricted goods import permit", "Sector specific"),
        ("FIA", "विदेशी लगानी तथा प्रविधि हस्तान्तरण", "Foreign investment approval", "Large FDI projects"),
        ("SEBON", "द्रव्यमूल्य बोर्ड", "Securities regulator", "Share market"),
        ("NEPSE", "नेपाल स्टक एक्सचेन्ज", "Stock exchange", "Listed company shares"),
        ("SSF office", "सामाजिक सुरक्षा कार्यालय", "Social security registration", "Employer enrollment"),
        ("labour office", "श्रम कार्यालय", "Labour dispute, inspection", "Minimum wage enforcement"),
        ("DOFE", "वैदेशिक रोजगार विभाग", "Foreign employment regulator", "Agency licensing"),
        ("FEB", "वैदेशिक रोजगार बोर्ड", "Foreign employment welfare", "Worker protection fund"),
        ("Lalpurja copy", "लालपुर्जा प्रतिलिपि", "Certified land title copy", "Malpot"),
        ("tax clearance certificate", "कर चुक्ता", "Proof taxes paid", "Tender, visa, sale"),
        ("audit report submission", "लेखा परीक्षण प्रतिवेदन", "File audited FS", "IRD/OCR requirement"),
        ("e-Governance", "इलेक्ट्रोनिक सुशासन", "Online government services", "PAN, VAT online"),
        ("citizen charter", "सेवा प्रवर्द्धन", "Published service timelines", "Each office"),
        ("RTI application", "सूचना अधिकार आवेदन", "Request public information", "15-day response rule"),
        ("building permit", "घर निर्माण अनुमति", "Construction approval", "Municipality engineering"),
        ("land pooling", "जग्गा धितो", "Urban land assembly scheme", "Municipal development"),
        ("recommendation letter", "सिफारिस पत्र", "Ward/municipal recommendation", "Bank loan, passport"),
        ("birth certificate", "जन्म दर्ता", "Birth registration", "Municipality"),
        ("marriage registration", "विवाह दर्ता", "Legal marriage record", "Court/municipality"),
        ("death registration", "मृत्यु दर्ता", "Death certificate", "For inheritance"),
        ("police report", "प्रहरी प्रतिवेदन", "General police verification", "Lost documents, crime"),
        ("notary public", "नोटरी", "Document attestation", "Legal authentication"),
        ("embassy attestation", "दुतावास प्रमाणित", "Document verification abroad", "Foreign employment docs"),
    ]
    return [{"term": t, "nepali": n, "meaning_en": m, "process_hint": p,
             "common_questions": [f"{t} kaha jaane?", f"{t} kasari garne?"]} for t, n, m, p in terms]


def nepal_geography() -> list[dict]:
    provinces = [
        ("Koshi Province", "कोशी प्रदेश", "Biratnagar", ["Morang", "Sunsari", "Jhapa", "Ilam"], 25906),
        ("Madhesh Province", "मधेश प्रदेश", "Janakpur", ["Parsa", "Bara", "Dhanusha", "Saptari"], 9661),
        ("Bagmati Province", "बागमती प्रदेश", "Hetauda", ["Kathmandu", "Lalitpur", "Bhaktapur", "Chitwan"], 20300),
        ("Gandaki Province", "गण्डकी प्रदेश", "Pokhara", ["Kaski", "Syangja", "Tanahu", "Gorkha"], 21856),
        ("Lumbini Province", "लुम्बिनी प्रदेश", "Deukhuri", ["Rupandehi", "Kapilvastu", "Dang", "Banke"], 22388),
        ("Karnali Province", "कर्णाली प्रदेश", "Birendranagar", ["Surkhet", "Jumla", "Dailekh", "Kalikot"], 27984),
        ("Sudurpashchim Province", "सुदूरपश्चिम प्रदेश", "Godawari", ["Kailali", "Kanchanpur", "Doti", "Achham"], 19539),
    ]
    rows = []
    for name_en, name_ne, capital, districts, area in provinces:
        rows.append({
            "entity_type": "province", "name_en": name_en, "name_ne": name_ne,
            "capital": capital, "major_districts": districts, "area_km2": area,
            "common_references": [name_en.split()[0], name_ne.split()[0], capital],
        })
    cities = [
        ("Kathmandu", "काठमाडौं", "Bagmati", "Capital city — major business hub"),
        ("Pokhara", "पोखरा", "Gandaki", "Tourism and trade center"),
        ("Biratnagar", "विराटनगर", "Koshi", "Industrial eastern hub"),
        ("Bharatpur", "भरतपुर", "Bagmati", "Chitwan commercial center"),
        ("Butwal", "बुटवल", "Lumbini", "Trade gateway west"),
        ("Nepalgunj", "नेपालगञ्ज", "Lumbini", "Mid-west trade hub"),
        ("Dhangadhi", "धनगढी", "Sudurpashchim", "Far-west commercial center"),
        ("Hetauda", "हेटौडा", "Bagmati", "Industrial corridor"),
        ("Janakpur", "जनकपुर", "Madhesh", "Religious and trade center"),
        ("Itahari", "ईटहरी", "Koshi", "Eastern logistics hub"),
    ]
    for city, nepali, prov, note in cities:
        rows.append({
            "entity_type": "city", "name_en": city, "name_ne": nepali,
            "province": prov, "note": note, "common_references": [city.lower(), nepali],
        })
    borders = [
        ("India border", "भारत सीमा", "Open border trade — Birgunj, Bhairahawa, Kakarbhitta"),
        ("China border", "चीन सीमा", "Kerung, Tatopani — limited trade crossings"),
        ("Terai", "तराई", "Southern plains — agriculture, trade"),
        ("Pahad", "पहाड", "Hill region — mid elevation"),
        ("Himal", "हिमाल", "Mountain region — tourism, remoteness"),
    ]
    for b, n, note in borders:
        rows.append({"entity_type": "region", "name_en": b, "name_ne": n, "note": note, "common_references": [b.split()[0]]})
    while len(rows) < 40:
        rows.append(rows[len(rows) % 17].copy())
    return rows[:40]


def festivals() -> list[dict]:
    data = [
        ("Dashain", "दशैं", "Ashwin-Kartik (Sep-Oct)", 15, 6, ["Peak sales", "Staff leave", "Bonus payment"], "Record dashain bonus, festive sales spike, advance collections"),
        ("Tihar", "तिहार", "Kartik (Oct-Nov)", 5, 3, ["Gift sales", "Lights/decoration", "Bhai tika"], "Diwali period sales — sweets, oil, decorations"),
        ("Holi", "होली", "Falgun (Mar)", 2, 1, ["Color/stationery sales"], "Short spike — party supplies"),
        ("Teej", "तीज", "Bhadra (Aug-Sep)", 3, 1, ["Women's retail", "Food items"], "Saree, cosmetics demand"),
        ("Chhath", "छठ", "Kartik (Oct-Nov)", 4, 2, ["Madhesh region sales", "Fruits/sugar"], "Thekuwa, fruits inventory"),
        ("Lhosar", "लोसार", "Magh/Feb varies", 3, 1, ["Ethnic food", "Cultural items"], "Sherpa/Tamang/Ugyur communities"),
        ("Eid", "ईद", "Islamic calendar", 2, 1, ["Muslim community sales"], "Food, clothing in Terai"),
        ("Christmas", "क्रिसमस", "Dec 25", 1, 1, ["Urban retail", "Bakery"], "Kathmandu/Pokhara retail"),
        ("New Year BS", "नयाँ वर्ष", "Baisakh 1", 1, 1, ["Fiscal planning", "Offers"], "New fiscal year planning"),
        ("Shrawan 1", "श्रावण १", "Fiscal year start", 1, 0, ["New budgets", "Target setting"], "FY begins — Nepal government"),
        ("Ashadh end", "असार अन्त", "Fiscal year end", 7, 0, ["Year-end closing", "Audit rush"], "Close books, file returns"),
        ("Buddha Jayanti", "बुद्ध जयन्ती", "Baisakh", 1, 1, ["Tourism Lumbini"], "Holiday in Lumbini area"),
        ("Maha Shivaratri", "महाशिवरात्रि", "Falgun", 1, 1, ["Pilgrimage Pashupati"], "Crowd — Kathmandu"),
        ("Indra Jatra", "इन्द्र जात्रा", "Bhadra", 8, 2, ["Kathmandu festival trade"], "Local retail Kathmandu"),
        ("Ghode Jatra", "घोडे जात्रा", "Chaitra", 1, 1, ["Kathmandu"], "Holiday Kathmandu valley"),
        ("Maghe Sankranti", "माघे सङ्क्रान्ति", "Magh 1", 1, 1, ["Til, ghee sales"], "Food retail spike"),
        ("Janai Purnima", "जनै पूर्णिमा", "Shrawan", 1, 1, ["Kwati sales"], "Restaurant/grocery"),
        ("Naag Panchami", "नाग पञ्चमी", "Shrawan", 1, 0, ["Minor retail"], "Low business impact"),
        ("Raksha Bandhan", "रक्षा बन्धन", "Shrawan", 1, 0, ["Gift items"], "Terai communities"),
        ("Father's Day", "बुबाको मुख हेर्ने", "Bhadra", 1, 0, ["Gift sales"], "Moderate retail"),
        ("Mother's Day", "आमाको मुख हेर्ने", "Baisakh", 1, 0, ["Gift sales"], "Moderate retail"),
    ]
    return [{
        "festival": f, "nepali": n, "timing": t, "duration_days": d, "public_holiday_days": h,
        "business_impact": bi, "accounting_notes": ac,
    } for f, n, t, d, h, bi, ac in data]


def food_menu() -> list[dict]:
    items = [
        ("momo", "म:म:", "80-250", ["steam", "fried", "kothey", "jhol"], ["momo 2 plate", "momo kati?", "buff momo 180"]),
        ("chowmein", "चाउमिन", "100-200", ["veg", "chicken", "buff"], ["chowmein 1 plate", "chowmein 150"]),
        ("thukpa", "थुक्पा", "120-220", ["veg", "chicken"], ["thukpa 1 bowl"]),
        ("dal bhat", "दाल भात", "150-350", ["veg", "chicken", "mutton"], ["dal bhat set 250"]),
        ("samosa", "समोसा", "15-30", ["veg", "buff"], ["samosa 20 eutako", "20 samosa 50 eutako"]),
        ("pakoda", "पकौडा", "20-40", ["veg", "onion"], ["pakoda 5 plate"]),
        ("buff sekuwa", "बफ सेकुवा", "200-350", ["plate", "half"], ["sekuwa 1 plate 250"]),
        ("chicken curry", "कुखुराको करी", "250-400", ["full", "half"], ["chicken curry 300"]),
        ("tea", "चिया", "20-50", ["milk", "black", "lemon"], ["chiya 2 cup", "tea 30"]),
        ("coffee", "कफी", "80-200", ["black", "latte"], ["coffee 1 cup"]),
        ("lassi", "लस्सी", "60-120", ["sweet", "salt"], ["lassi 1 glass"]),
        ("juice", "जुस", "80-150", ["mango", "banana"], ["juice 1 glass"]),
        ("fried rice", "फ्राइड राइस", "150-250", ["veg", "chicken"], ["fried rice 180"]),
        ("paratha", "पराठा", "40-80", ["plain", "aloo"], ["paratha 2 piece"]),
        ("naan", "नान", "60-100", ["plain", "butter"], ["naan 2 piece"]),
        ("roti", "रोटी", "15-25", ["tawa"], ["roti 5 piece"]),
        ("biryani", "बिर्यानी", "200-400", ["chicken", "mutton"], ["biryani 1 plate"]),
        ("pizza", "पिज्जा", "400-900", ["small", "medium", "large"], ["pizza 1 medium"]),
        ("burger", "बर्गर", "200-450", ["chicken", "veg"], ["burger 1 piece"]),
        ("sandwich", "स্যান्डविच", "120-250", ["veg", "chicken"], ["sandwich 1"]),
        ("noodles Wai Wai", "वाइ वाइ", "25-35", ["raw", "cooked"], ["wai wai 3 packet"]),
        ("biscuit", "बिस्कुट", "10-50", ["packet"], ["biscuit 2 packet"]),
        ("cigarette", "चुरोट", "25-35", ["per stick", "pack"], ["cigarette 1 packet"]),
        ("alcohol beer", "बियर", "350-600", ["650ml", "330ml"], ["beer 2 bottle"]),
        ("raksi", "रक्सी", "150-400", ["local", "quarter"], ["raksi 1 bottle"]),
        ("water bottle", "पानी", "20-30", ["1L"], ["pani 5 bottle"]),
        ("cold drink", "कोल्ड ड्रिङ्क", "50-80", ["coke", "sprite"], ["coke 2 bottle"]),
        ("ice cream", "आइसक्रिम", "50-150", ["scoop", "cup"], ["ice cream 2 scoop"]),
        ("cake", "केक", "800-2500", ["per pound"], ["cake 1 pound"]),
        ("pastry", "पेस्ट्री", "80-150", ["chocolate", "fruit"], ["pastry 2 piece"]),
    ]
    rows = []
    for item, nepali, price, variants, phrases in items:
        rows.append({
            "item": item, "nepali": nepali, "category": "food_or_drink",
            "variants": variants, "typical_price_range": price,
            "common_phrases": phrases, "units": ["plate", "piece", "cup", "packet", "bottle"],
        })
    extras = ["kwati", "sel roti", "yomari", "chatamari", "gundruk", "dhindo", "gorkhali lamb",
              "taas", "sukuti", "choila", "paneer tikka", "paneer curry", "paneer momo",
              "veg momo", "cheese momo", "chocolate momo", "jhol momo", "c momo",
              "chicken momo", "buff chowmein", "egg chowmein", "masu curry"]
    for i, ex in enumerate(extras):
        rows.append({
            "item": ex, "nepali": ex, "category": "food_or_drink",
            "variants": ["regular", "special"], "typical_price_range": f"{100 + i * 5}-{200 + i * 10}",
            "common_phrases": [f"{ex} 1 plate", f"{ex} kati?"], "units": ["plate", "piece"],
        })
    return rows[:50]


def construction_materials() -> list[dict]:
    materials = [
        ("cement", "सिमेन्ट", "bag", "50kg", ["Hetauda", "Shivam", "Jagadamba"], "750-900", ["1:2:4 ratio", "foundation"]),
        ("sariya", "सरिया", "ton", "12mm/16mm/20mm", ["Ambe", "Panchakanya"], "120000-140000/ton", ["RCC column", "beam"]),
        ("balu", "बालुवा", "truck", "cft", ["local"], "2500-3500/truck", ["concrete mix", "plaster"]),
        ("gitti", "गिट्टी", "truck", "cft", ["local"], "3000-4000/truck", ["foundation", "road"]),
        ("ita", "इटा", "piece", "standard", ["local kiln"], "18-25/piece", ["wall", "partition"]),
        ("dhunga", "ढुङ्गा", "truck", "cft", ["local"], "4000-6000/truck", ["foundation", "retaining"]),
        ("kaath", "काठ", "cft", "sal/chilaune", ["imported/local"], "1200-2000/cft", ["frame", "door"]),
        ("ply", "प्लाई", "sheet", "6mm/12mm", ["Nepal", "Century"], "1800-3500/sheet", ["furniture", "formwork"]),
        ("rod binding wire", "बाइन्डिङ तार", "kg", "gauge", ["local"], "180-220/kg", ["sariya tie"]),
        ("nails", "नङ", "kg", "2/3/4 inch", ["local"], "150-200/kg", ["formwork", "wood"]),
        ("paint", "रंग", "liter", "1L/4L/20L", ["Asian", "Nerolac"], "400-1200/L", ["interior", "exterior"]),
        ("primer", "प्राइमर", "liter", "1L", ["Asian"], "350-600/L", ["wall prep"]),
        ("thinner", "थिनर", "liter", "1L", ["local"], "200-350/L", ["paint dilute"]),
        ("pipe PVC", "पाइप", "piece", "1/2 to 4 inch", ["National", "Shree"], "150-2000/piece", ["plumbing"]),
        ("fitting elbow", "फिटिङ", "piece", "PVC/CPVC", ["National"], "20-150/piece", ["plumbing joint"]),
        ("tap", "ट्याप", "piece", "wall mount", ["Jaquar local"], "300-2500/piece", ["bathroom", "kitchen"]),
        ("sink", "सिंक", "piece", "SS", ["local"], "2000-8000/piece", ["kitchen"]),
        ("commode", "कमोड", "piece", "western", ["Hindware"], "5000-15000/piece", ["toilet"]),
        ("tile floor", "टायल", "box", "2x2 ft", ["RAK", "Kajaria"], "1200-2500/box", ["flooring"]),
        ("marble", "संगमरमर", "sqft", "polished", ["Indian"], "200-600/sqft", ["flooring"]),
        ("granite", "ग्रेनाइट", "sqft", "", ["Indian"], "250-700/sqft", ["counter", "floor"]),
        ("aluminum window", "झ्याल", "sqft", "section", ["local"], "400-800/sqft", ["frame"]),
        ("door flush", "ढोका", "piece", "standard", ["local"], "3000-8000/piece", ["room door"]),
        ("steel section", "स्टिल सेक्सन", "kg", "angle/channel", ["Jagadamba"], "110-130/kg", ["fabrication"]),
        ("sheet GI", "जीआई शीट", "sheet", "gauge 22-26", ["local"], "1200-2000/sheet", ["roofing"]),
        ("wire copper", "ताम्रो तार", "coil", "1.5/2.5 sqmm", ["NIC"], "80-150/meter", ["electrical"]),
        ("switch board", "स्विच", "piece", "modular", ["Anchor", "Havells"], "50-500/piece", ["electrical"]),
        ("MCB", "एमसीबी", "piece", "16A-63A", ["Schneider"], "300-1500/piece", ["electrical protection"]),
        ("conduit pipe", "कन्ड्युट", "piece", "PVC", ["local"], "80-200/piece", ["cable routing"]),
        ("sand fine", "बारीक बालुवा", "truck", "cft", ["local"], "3500-4500/truck", ["plaster"]),
        ("ready mix concrete", "रेडीमिक्स", "cum", "M15-M25", ["local plant"], "8000-12000/cum", ["slab pour"]),
        ("brick block", "ब्लक", "piece", "6 inch", ["local"], "80-120/piece", ["wall"]),
        ("waterproofing", "वाटरप्रूफिङ", "kg", "chemical", ["Dr Fixit"], "400-800/kg", ["terrace", "bathroom"]),
        ("adhesive tile", "टायल टाँस", "bag", "20kg", ["Roff"], "600-900/bag", ["tile fix"]),
        ("grout", "ग्राउट", "kg", "", ["Roff"], "200-400/kg", ["tile gap"]),
        ("putty", "पुट्टी", "kg", "wall", ["Asian"], "80-150/kg", ["wall smooth"]),
        ("POP", "पीओपी", "bag", "25kg", ["local"], "500-700/bag", ["ceiling"]),
        ("UPVC window", "यूपीभीसी", "sqft", "", ["local"], "500-900/sqft", ["window"]),
        ("glass", "सिसा", "sqft", "5mm-12mm", ["local"], "150-400/sqft", ["window", "partition"]),
        ("hinge", "कब्जा", "pair", "", ["local"], "80-300/pair", ["door"]),
        ("lock", "ताला", "piece", "", ["Godrej"], "500-3000/piece", ["door security"]),
        ("mesh", "जाली", "roll", "mosquito", ["local"], "80-150/sqft", ["window"]),
        ("stone aggregate", "ढुंगा झिक्ने", "truck", "", ["local"], "5000-8000/truck", ["road base"]),
        ("tar felt", "टार", "roll", "", ["local"], "800-1500/roll", ["waterproof roof"]),
    ]
    return [{
        "item": item, "nepali": nepali, "unit": unit, "standard_weight": wt,
        "common_brands": brands, "typical_price_range": price,
        "related_calculations": calc, "transaction_phrases": [f"{item} kineko", f"{item} stock aayo", f"{item} 10 {unit}"],
    } for item, nepali, unit, wt, brands, price, calc in materials]


def proverbs() -> list[dict]:
    data = [
        ("paisa le paisa kamaucha", "Money earns money", "Capital generates returns — reinvest profits",
         "Reinvestment and compound growth", ["ROI", "reinvestment", "working capital"]),
        ("rin ko bojh", "Burden of debt", "Too much loan stresses cashflow",
         "Debt management", ["loan", "interest", "leverage"]),
        ("haat ko maila", "Dirt of hand — easy come easy go", "Petty cash without records disappears",
         "Petty cash control", ["petty cash", "imprest", "cash control"]),
        ("aafno kharcha aafnai", "Own expense ownself", "Bootstrap without external funding",
         "Self-funded business", ["capital", "bootstrapping"]),
        ("jasto beu testai fal", "As you sow so you reap", "Business quality determines outcome",
         "Quality investment", ["quality", "reputation"]),
        ("bina lagani labh chaina", "No profit without investment", "Must invest to grow",
         "Capital requirement", ["investment", "capital"]),
        ("gham jasto mehenat", "Hard work like sun", "Consistent effort needed",
         "Work ethic", ["productivity"]),
        ("dhilo bhaye ni thik", "Slow but correct", "Accuracy over speed in accounting",
         "Accurate bookkeeping", ["accuracy", "reconciliation"]),
        ("ghar ko bagh", "Tiger at home", "Domestic competition in family business",
         "Family business conflict", ["partnership", "succession"]),
        ("pani ma phalne tel", "Oil that spreads on water", "Small expense becoming big leak",
         "Expense leakage", ["expense control", "wastage"]),
        ("aankha ko putali", "Puppet of eye", "Favorite unreliable worker",
         "Internal control", ["fraud risk", "segregation"]),
        ("ulto ghoda lai ladai", "Fighting reverse horse", "Wrong strategy wastes money",
         "Business strategy", ["loss", "bad decision"]),
        ("ek haat le bajauna mildaina", "Can't clap with one hand", "Need buyer and seller",
         "Transaction needs two parties", ["credit sale", "partnership"]),
        ("bhanda bhanda khola", "Deeper than deep river", "Debt deeper than expected",
         "Hidden liabilities", ["liability", "contingent"]),
        ("chhimeki ko ghar", "Neighbor's house", "Comparing business to others wrongly",
         "Benchmarking caution", ["comparison"]),
        ("daam cha bhane ramro cha", "If expensive it's good", "Price ≠ quality always",
         "Procurement judgment", ["purchase", "valuation"]),
        ("din ko din", "Day by day", "Daily cash tracking habit",
         "Daily sales tracking", ["day book", "cash register"]),
        ("mahina ko hisab", "Month's account", "Monthly closing discipline",
         "Month-end close", ["trial balance", "P&L"]),
        ("thag linu bhanda dhan dinu", "Better give than cheat", "Honest business long-term",
         "Ethics", ["compliance", "trust"]),
        ("sano ghar sano dangal", "Small house small courtyard", "Start small scale",
         "Micro business", ["SME", "startup"]),
        ("bora ko hisab", "Sack accounting", "Rough estimate not proper books",
         "Need proper records", ["bookkeeping"]),
        ("hisa ma phut", "Crack in share", "Partnership dispute on profit share",
         "Partnership accounting", ["profit share", "equity"]),
        ("khana ko hisab", "Food account", "Personal expense mixed with business",
         "Separate personal vs business", ["drawings", "expense"]),
        ("chhuttai khata", "Separate ledger", "Keep party-wise accounts",
         "Sub-ledger discipline", ["ledger", "receivable"]),
        ("hune le huncha", "What is meant to happen will", "Not excuse for no planning",
         "Still need budget", ["budget", "forecast"]),
        ("paisa ko moh", "Greed for money", "Chasing profit ignoring compliance",
         "Tax compliance risk", ["tax", "penalty"]),
        ("sahi samay ma sahi kadam", "Right step at right time", "Timely tax filing, payment",
         "Compliance timing", ["deadline", "filing"]),
        ("ek paisa ko hisab", "Account of one paisa", "Track every small amount",
         "Materiality vs discipline", ["petty cash"]),
        ("khali khutta aaudaina", "Empty hand doesn't come", "Investment before return",
         "No free lunch", ["capital", "loan"]),
        ("dhani ko dhan", "Rich person's wealth", "Wealth compounds with assets",
         "Asset building", ["asset", "investment"]),
    ]
    return [{
        "proverb_ne": p, "proverb_roman": p, "literal_en": lit, "meaning_en": mean,
        "business_context": ctx, "example_usage": f"Byapar ma: {p}", "related_concepts": rel,
    } for p, lit, mean, ctx, rel in data]


def typos_variants() -> list[dict]:
    pairs = [
        ("udhaar", ["udhar", "udhaaro", "udaro", "udhare", "udhaare"]),
        ("kharcha", ["kharxa", "kharchaa", "kharch", "kharcho", "kharca"]),
        ("noksan", ["nokshan", "noksane", "noksan", "noxan", "noksana"]),
        ("baki", ["bakii", "baaki", "bakia", "bakie"]),
        ("kineko", ["kinekoe", "kineku", "kinneko", "kineko", "kinyeko"]),
        ("kineye", ["kinye", "kinyo", "kine", "kiniyo", "kinne"]),
        ("becheko", ["bexeko", "becheku", "bechyo", "becheko", "bechheko"]),
        ("tiryo", ["tirio", "tiryoe", "tireko", "tiryo", "tireku"]),
        ("jamma", ["jama", "jammae", "jamaa", "jamah"]),
        ("diye", ["diyo", "die", "diya", "diyeu", "diyo"]),
        ("aayo", ["ayo", "aayeko", "aayoo", "aaye"]),
        ("paisa", ["pisa", "paise", "paisaa", "pyasa"]),
        ("rupiya", ["rupya", "rupaye", "rupaiya", "rupya"]),
        ("hajar", ["hazar", "hajaar", "hazaar", "hjar"]),
        ("lakh", ["lak", "lac", "laksh", "lax"]),
        ("sampatti", ["sampati", "sampatii", "sampat"]),
        ("hisab", ["hisaab", "hisap", "hisāb", "hisaab"]),
        ("lekha", ["lekhaa", "lekhā", "lekha"]),
        ("bikri", ["bikree", "bikrii", "bikri", "bikry"]),
        ("talab", ["tallab", "talāb", "talab", "taleb"]),
        ("byaj", ["biyaj", "byaaj", "byaz", "interest"]),
        ("commission", ["komision", "commision", "comission", "komishan"]),
        ("invoice", ["invois", "invioce", "invice", "invos"]),
        ("receipt", ["reciept", "receit", "recipt", "rasid"]),
        ("voucher", ["vouxer", "vouchre", "vouture", "bauchar"]),
        ("balance", ["balans", "balence", "balanse", "baki"]),
        ("debit", ["debite", "debet", "namme", "debit"]),
        ("credit", ["credite", "crdit", "kredit", "jamā"]),
        ("salary", ["salery", "salry", "celery", "talab"]),
        ("expense", ["expence", "expens", "xpense", "kharcha"]),
        ("payment", ["paiment", "paymnt", "peymant", "bhugtan"]),
        ("discount", ["discont", "discunt", "chhut", "discount"]),
        ("provision", ["provizion", "provisione", "prabision"]),
        ("depreciation", ["depriciation", "depresiation", "hras"]),
        ("capital", ["capitol", "kapital", "puni", "capital"]),
        ("drawings", ["drawing", "nikasne", "drawings", "nikasna"]),
        ("contra", ["kontra", "contraa", "contra"]),
        ("journal", ["jurnal", "jornal", "journal"]),
        ("ledger", ["ledgar", "lejhar", "ledger", "khata"]),
        ("party", ["parti", "partii", "party"]),
        ("supplier", ["suplier", "suppliar", "supplier"]),
        ("customer", ["custmer", "kastomer", "customer", "grahak"]),
        ("stock", ["stok", "stockk", "saman", "stock"]),
        ("cement", ["simant", "cemnt", "cement", "siment"]),
        ("sariya", ["saria", "sariyaa", "sariya", "rod"]),
        ("momo", ["momo", "mumu", "momo", "momos"]),
        ("chowmein", ["chowmin", "choumin", "chowmein", "chomin"]),
        ("esewa", ["esewaa", "e-sewa", "eswa", "esewa"]),
        ("khalti", ["khaltii", "khalti", "khalti"]),
        ("nagad", ["nakad", "nagat", "nagad", "cash"]),
        ("udharo", ["udhaaro", "udharo", "udaro", "udharo"]),
        ("ramro", ["ramroo", "ramro", "ramro"]),
        ("thik", ["thik cha", "thikxa", "thik", "thik chha"]),
    ]
    return [{
        "correct": c, "variants": list(dict.fromkeys([c] + v)),
        "type": "phonetic_and_keyboard_variation",
        "frequency": "high" if i < 25 else "medium",
        "context": "nepal_roman_business_typing",
    } for i, (c, v) in enumerate(pairs)]


def write_part2(reg: Path, know: Path, lang: Path, write_jsonl: Callable) -> None:
    write_jsonl(reg / "banking_finance.jsonl", banking_finance())
    write_jsonl(reg / "government_services.jsonl", government_services())
    write_jsonl(know / "nepal_geography.jsonl", nepal_geography())
    write_jsonl(know / "festivals_holidays.jsonl", festivals())
    write_jsonl(know / "food_menu.jsonl", food_menu())
    write_jsonl(know / "construction_materials.jsonl", construction_materials())
    write_jsonl(lang / "proverbs_idioms.jsonl", proverbs())
    write_jsonl(lang / "typos_variants.jsonl", typos_variants())
