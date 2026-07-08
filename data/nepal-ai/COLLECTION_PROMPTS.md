# Nepal Universal AI — Ready-to-Paste Claude Prompts

## How to Use
1. Copy ONE prompt block (between the `---` lines)
2. Paste into Claude (claude.ai free tier works)
3. Copy Claude's output
4. Save to the filename shown in each prompt's header
5. Move to next prompt

Each prompt is 100% self-contained. No extra text needed.

---

## BATCH 01: Master Sector Ontology
**Save as:** `ontology/master_sectors.jsonl`

```
You are building a Nepal AI knowledge base. Generate a comprehensive taxonomy of ALL professions, businesses, and sectors in Nepal.

TASK: Create 50 sector/profession entries covering:
- Retail (kirana, hardware, mobile, electronics, clothing, pharmacy, stationery)
- Food (restaurant, cafe, bakery, meat shop, dairy, fruit/vegetable)
- Construction (contractor, materials supplier, architect, plumber, electrician)
- Professional services (CA, lawyer, auditor, consultant, notary)
- Healthcare (clinic, hospital admin, lab, pharmacy, ayurvedic)
- Education (school, tuition, training center, coaching)
- Transport (truck, taxi, logistics, courier)
- Agriculture (farmer, cooperative, agro supplier, dairy farm)
- Manufacturing (garment, handicraft, food processing)
- Finance (bank, microfinance, cooperative, insurance agent)
- Government/public (ward office, land revenue, CDO, municipality)
- IT/Tech (software, ISP, computer repair, CCTV installer)

For EACH entry provide:
{"id": "sector-xxx", "macro_sector": "...", "subsector": "...", "name_en": "...", "name_ne_roman": "...", "name_ne_devanagari": "...", "typical_roles": ["..."], "common_transactions": ["..."], "example_user_phrases": ["...", "...", "..."], "tags": ["..."]}

OUTPUT: 50 JSONL lines (one JSON object per line, no markdown fences, no explanation text).
Start output immediately with first JSON object.
```

---

## BATCH 02: Nepali Verb Conjugation Map (Part 1 - Core Business Verbs)
**Save as:** `language/verbs_core.jsonl`

```
You are building a Nepali language parser for AI. Generate verb conjugation maps for business/transaction verbs.

TASK: For these 25 verb lemmas, provide ALL spoken variants Nepalis actually type:
kinnu (buy), bechnu (sell), dinu (give), linu (take), tirnu (pay), 
aunu (come/receive), janu (go), garnu (do), rakhnu (keep), pathaaunu (send),
firta garnu (return), jamma garnu (deposit), jhiknu (withdraw), lekhnu (write/record),
ghatnu (reduce/loss), badhnu (increase), baki rakhnu (keep credit), 
saadhnu (settle), banaaunu (make), kinbech garnu (trade), bhuktan garnu (make payment),
kharcha garnu (spend), kamaunu (earn), bachaat garnu (save), rin dinu (lend)

For EACH verb provide:
{"lemma": "kinnu", "meaning_en": "to buy/purchase", "semantic_action": "PURCHASE", "variants": ["kineko", "kine", "kinyo", "kinye", "kiniyo", "kinne", "kinna", "kin", "kharid", "kharido"], "tense_map": {"past": ["kineko", "kinyo", "kinye", "kine"], "present": ["kincha", "kinchha", "kinne"], "habitual": ["kinne gareko"]}, "common_typos": ["kineye", "kiney", "kinaye"], "example_sentences": [{"ne_roman": "sariya kineko 5000", "en": "bought iron rod for 5000"}]}

OUTPUT: 25 JSONL lines. No markdown. Start immediately with first JSON object.
```

---

## BATCH 03: Nepali Verb Conjugation Map (Part 2 - State & Auxiliary Verbs)
**Save as:** `language/verbs_auxiliary.jsonl`

```
You are building a Nepali language parser. Generate conjugation maps for state/auxiliary verbs that Nepalis type in many variant spellings.

TASK: Map these 20 verbs with ALL their spoken/typed variants:
hunu (to be/happen), chanu (to be-present), bhayeko (happened), 
rahanu (remain), saknu (can/complete), parnu (must/fall), 
thaha hunu (know), chahanu (want), aaunu (come), pugnu (reach/enough),
bujhnu (understand), birsanu (forget), samjhanu (remember), sodhnu (ask),
bhannu (say/tell), sunnu (hear), dekhnu (see), khojnu (search/want),
paunu (get/find), haalnu (put)

Include critical variants like:
- bhayo/vayo/bho/vo (happened)
- cha/chha/xa/xha (is)
- thiyo/thyo/thio (was)
- huncha/hunchha/hunxa (will be)

For EACH provide:
{"lemma": "hunu", "meaning_en": "to be/happen", "variants": ["bhayo", "vayo", "bho", "vo", "bhayeko", "vayeko", "bhayena", "vayena", "huncha", "hunchha", "hunxa", "hola", "hos", "hunu", "bhaye", "vaye"], "tense_map": {"past": ["bhayo", "vayo", "vo", "bho"], "present": ["cha", "chha", "xa"], "past_was": ["thiyo", "thyo"]}, "common_typos": ["vo", "xha", "hunxa"], "signals_completion": true}

OUTPUT: 20 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 04: Particles & Postpositions (Transaction Direction)
**Save as:** `language/particles.jsonl`

```
You are building Nepali NLU for financial transactions. Map ALL particles/postpositions that indicate money direction.

TASK: Document 30 Nepali particles with their transaction implications:
lai (to), le (by/ergative), bata (from), sanga (with), ko (of/genitive),
ma (in/at), dekhi (from-time), samma (until), lagi (for), prati (per/towards),
bina (without), bahek (except), bhanda (than), jasto (like), pachhadi (after),
agaadi (before), mathi (above), tala (below), bhitra (inside), baahira (outside),
nira (near), tadha (far), bich (between), wari (across), pari (other side),
tira (towards), najik (near), muni (under), upara (over), aghi (before)

For EACH provide:
{"particle": "lai", "devanagari": "लाई", "grammatical_role": "dative/recipient marker", "transaction_direction": "money_out_or_credit_given", "example_patterns": [{"pattern": "X lai Y diye", "meaning": "gave Y to X", "transaction": "payment_out_or_credit_sale"}, {"pattern": "X lai tireko", "meaning": "paid to X", "transaction": "payment_out"}], "disambiguation_rules": ["lai + diye = outgoing", "lai + becheko = sold to (credit possible)"], "common_confusions": ["lai vs le confusion in speech"]}

OUTPUT: 30 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 05: Number & Amount Expressions
**Save as:** `language/numbers_amounts.jsonl`

```
You are building amount parser for Nepal AI. Document ALL ways Nepalis express numbers and money amounts.

TASK: Cover 40 number/amount expression patterns:
- Basic: ek, dui, tin... das, bis, tis, chalis, pachaas, saathi, satari, aasi, nabbe, saya
- Large: hajar, lakh, crore, arab, kharab
- Fractions: dedh (1.5), dhai (2.5), sawa (1.25), paune (0.75 of)
- Approximations: jati, lagbhag, tira, around, almost, about
- Ranges: dekhi-samma, bich ma, minimum-maximum
- Per-unit: prati, eutako, pratihajar, percentage
- Currency markers: rs, Rs, npr, NPR, rupiya, rupaya, rupaiya, rupees, paisa
- Colloquial: pachas rupya, hajaar, lakh rupiya, ek hajar paanch saya
- Written shortcuts: 1k, 5k, 10L, 1Cr, 500/-, Rs.500

For EACH provide:
{"pattern_type": "large_number", "examples": ["hajar", "hazar", "hajaar", "1000", "1k", "1K"], "canonical_form": "hajar", "numeric_value": 1000, "regex_hint": "haj?a+r|1k|1000", "usage_examples": ["paanch hajar", "5 hajar", "5k", "5000"], "common_typos": ["hajaar", "hazar", "hazaar"]}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 06: Profit/Loss/Expense Vocabulary
**Save as:** `language/profit_loss_vocab.jsonl`

```
You are building Nepal business AI. Document ALL ways Nepalis express profit, loss, expense, income concepts.

TASK: Cover 40 terms across these categories:

PROFIT/GAIN: nafa, naafa, profit, faida, faaida, labh, kamai, amdani, aamdani, income, earning, munafa
LOSS/DAMAGE: noksan, nokshan, nakashan, nuksan, ghata, ghaata, loss, damage, waste, bigreko, kharab, nasht
EXPENSE/COST: kharcha, kharcho, kharch, expense, cost, lagat, vyaya, byaya
REVENUE: aaya, aay, bikri, sales, turnover, rajaswa
DISCOUNT: chhut, chut, discount, offer, kamti, less
COMMISSION: commission, dalali, brokerage, fee
WASTAGE: waste, fohor, bigreko, expired, nasht
THEFT/SHORTAGE: chori, shortage, kam bho, harayo, missing

For EACH term provide:
{"term_roman": "noksan", "variants": ["nokshan", "nakashan", "nuksan", "noksaan"], "devanagari": "नोक्सान", "meaning_en": "loss/damage", "accounting_class": "loss_or_expense", "typical_phrases": ["noksan vo 400", "400 ko noksan bhayo", "noksan ma gayo", "loss bhayo"], "clarify_needed_when": "unclear if stock loss, cash loss, or business P&L loss", "journal_intent_if_entry": "khata_expense_or_write_down", "risk_of_misparse": "might be treated as question 'noksan k ho'"}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 07: Credit/Debt/Outstanding Vocabulary  
**Save as:** `language/credit_debt_vocab.jsonl`

```
You are building Nepal business AI. Document ALL credit/debt/receivable/payable expressions.

TASK: Cover 35 terms and phrases:

CREDIT GIVEN: udhaar, udhar, udharo, udhari, credit, baki, baaki, tirna baki, receivable
CREDIT TAKEN: rin, loan, karza, sapati, udhaar leko, credit leko
PAYMENT DUE: tirna parcha, bujhaunu parcha, due, payable, baki cha
ADVANCE: agaadi, advance, peshgi, deposit, booking amount, token
SETTLEMENT: chukta, chuktaa, settle, clear, mitayo, sakyo
PARTIAL: aadha, kati, partial, installment, kist, EMI

Include phrases like:
- "Ram lai 500 udhaar" (credit sale to Ram)
- "Ram bata 500 udhaar" (credit purchase from Ram)  
- "baki 2000 cha" (2000 outstanding)
- "agaadi leko 1000" (advance taken 1000)

For EACH provide:
{"term_roman": "udhaar", "variants": ["udhar", "udharo", "udhari", "udhaar"], "devanagari": "उधारो", "meaning_en": "credit/loan/on-account", "direction_ambiguity": "needs lai/le/bata to determine direction", "typical_patterns": [{"pattern": "X lai Y udhaar", "meaning": "sold Y to X on credit", "intent": "khata_credit_sale"}, {"pattern": "X bata udhaar", "meaning": "bought on credit from X", "intent": "khata_credit_purchase"}], "common_errors": ["confusing direction without particle"]}

OUTPUT: 35 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 08: Question Words & Patterns
**Save as:** `language/question_patterns.jsonl`

```
You are building Nepal AI. Document ALL question patterns to distinguish questions from transaction entries.

TASK: Cover 35 question patterns in Nepali:

QUESTION WORDS: ke, k, kina, kasari, kahile, kaha, kati, kun, ko, kasko, kasto, kata
QUESTION MARKERS: ? (question mark), ki, ta, ni, ra
QUESTION PHRASES: k ho, ke ho, k huncha, kasari huncha, kina bhayo, kati cha, kun ho

Critical distinctions:
- "noksan k ho" = QUESTION (what is loss)
- "noksan vo 400" = ENTRY (loss happened 400)
- "VAT kati %" = QUESTION
- "VAT 13% tireko" = ENTRY

For EACH provide:
{"pattern": "X k ho", "type": "definition_question", "examples": ["noksan k ho", "VAT k ho", "journal k ho", "debit k ho"], "intent": "question_definition", "NOT_entry_because": "k ho suffix asks for explanation", "response_type": "explanation"}

Also include:
- rhetorical questions that ARE entries: "500 diye ki nadiye" → actually gave 500
- confirmation questions: "yo thik ho?" after entry → not new entry

OUTPUT: 35 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 09: Affirmation/Negation/Correction Patterns
**Save as:** `language/affirmation_negation.jsonl`

```
You are building Nepal AI. Document affirmation, negation, and correction patterns for conversation flow.

TASK: Cover 40 patterns:

AFFIRMATIONS (yes/confirm): ho, huncha, hunchha, thik, thik cha, sahi, hajur, la, ok, okay, yes, huss, ramro, correct, aaba, ho ni
NEGATIONS (no/cancel): hoina, chaina, chhaina, xaina, pardaina, mildaina, no, nope, cancel, hatau, nagarnu, nahune
CORRECTIONS: galat, galti, wrong, mistake, tyo hoina, yo hoina, 500 hoina 600, farak cha
PARTIAL CONFIRM: ali ali, thikai, testo, jasto, lagcha
UNCERTAINTY: thaha bhayena, bujhena, k bhanne, kunni, maybe, perhaps, hola

Critical for multi-turn:
- "ho" after confirm card = CONFIRM entry
- "hoina" after confirm card = CANCEL entry  
- "500 hoina 600 ho" = CORRECTION (change amount)
- "tyo galat, yo ho" = CORRECTION

For EACH provide:
{"pattern": "ho", "variants": ["ho", "ho ni", "hoo", "hoe"], "type": "affirmation", "strength": "strong", "multi_turn_action": "confirm_pending", "examples": ["User sees card → types 'ho' → confirms entry"], "NOT_confused_with": "ho as verb form"]}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 10: Time & Date Expressions
**Save as:** `language/time_date.jsonl`

```
You are building Nepal AI. Document ALL time/date expressions including Nepal-specific (Bikram Sambat).

TASK: Cover 40 time/date patterns:

RELATIVE DAYS: aaja, aja, bholi, parsi, hijo, asti, asti hijo, aile, ahile
NEPALI MONTHS: baishakh, jestha, ashar/asar, shrawan/saun, bhadra/bhadau, ashwin/asoj, kartik, mangsir, poush/push, magh, falgun/fagun, chaitra/chait
GREGORIAN: january-december, jan-dec
FISCAL: fiscal year, aarthik barsha, FY, 2080/81, 080-81
DATES: gate, taarikh, miti, 15 gate, baishakh 15
PERIODS: mahina, barsha, hafta, week, month, year, quarter, Q1-Q4
RELATIVE PERIODS: yo mahina, gako mahina, aauney mahina, gako barsha

Nepal fiscal year: Shrawan 1 to Ashadh end (mid-July to mid-July)

For EACH provide:
{"pattern_type": "nepali_month", "terms": ["shrawan", "saun", "saaun", "साउन"], "gregorian_approx": "mid-July to mid-August", "fiscal_significance": "first month of Nepal fiscal year", "common_phrases": ["shrawan 1 dekhi", "saun ma submit"]}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 11: Retail/Kirana Sector Phrases
**Save as:** `sectors/retail_kirana.jsonl`

```
You are building Nepal AI for shop owners. Generate realistic shopkeeper phrases for retail/kirana stores.

TASK: Generate 40 transaction phrases as shopkeepers ACTUALLY type them (messy, abbreviated, mixed language):

Cover these transaction types:
- Cash sales: "chini 2kg becheko 300", "sabun 5 wata cash"
- Credit sales: "Ram lai 500 udhaar", "saman udharo diye"
- Purchases from supplier: "wholesaler bata maal aayo 15000", "chini kineko 50kg"
- Credit purchases: "Shyam bata udhaar kineko 8000"  
- Expenses: "light bill 500", "bhada tireko 3000", "helper ko salary 8000"
- Payments received: "Ram le 300 tiryo", "aaja 2000 collection"
- Payments made: "supplier lai 5000 diye", "wholesaler payment 10000"
- Returns: "customer le sabun firta garyo 50", "supplier lai damaged maal firta"
- Wastage: "tel bigryo 2L noksan", "expired maal 500"
- Discounts: "100 ko 10 chhut diye"

For EACH provide:
{"input": "Ram lai 500 udhaar", "normalized": "ram lai 500 udhaar", "intent": "khata_credit_sale", "entities": {"party": "Ram", "amount": 500, "item": null}, "confidence": 0.95, "needs_clarify": false, "sector": "retail_kirana", "register": "colloquial"}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 12: Hardware/Construction Materials Phrases
**Save as:** `sectors/hardware_construction.jsonl`

```
You are building Nepal AI for hardware/construction material shops. Generate realistic phrases.

TASK: Generate 40 phrases covering:

ITEMS: sariya (iron rod), cement, bajri (gravel), gitti (chips), balu (sand), rod, pipe, fitting, paint, putty, primer, wire, cable, switch, socket, nail, screw, bolt, nut, tile, ply, hardboard, door, window, grill, gate

TRANSACTIONS:
- "sariya 50kg kineko 7500"
- "cement 10 bag aayo wholesaler bata"  
- "thekdar lai 20000 ko saman udhaar"
- "site ma delivery kharcha 500"
- "Sharma contractor le 15000 tiryo"
- "rod waste bhayo 2kg, 400 loss"
- "paint 5L becheko cash 2500"
- "naksha anusaar saman list banau" (quotation context)

For EACH provide:
{"input": "sariya kineye ghar banauna", "intent": "khata_purchase", "entities": {"item": "sariya", "amount": null, "purpose": "ghar banauna"}, "needs_clarify": true, "clarify_question": "Sariya kati amount ma kineko? Number lekhnus.", "sector": "hardware_construction"}

Include phrases WITHOUT amounts that need clarification.
OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 13: Restaurant/Cafe/Food Business Phrases
**Save as:** `sectors/restaurant_cafe.jsonl`

```
You are building Nepal AI for restaurant/cafe owners. Generate realistic phrases.

TASK: Generate 40 phrases covering:

ITEMS: momo, chowmein, thukpa, khana set, buff, chicken, mutton, tea, coffee, juice, cold drinks, beer, raksi, snacks, breakfast, lunch, dinner

TRANSACTIONS:
- "aaja ko sale 25000"
- "kitchen kharcha 8000" 
- "staff salary 4 jana 40000"
- "gas cylinder 2 wata kineko 3200"
- "party booking advance 5000 aayo"
- "table 5 ko bill 2800 cash"
- "masu kineko 10kg 6000"
- "tarkari sabji aayo 1500"
- "customer le bill tirena gayo" (potential bad debt)
- "bigreko khana waste 500"
- "electricity bill 4500"
- "rent tireko 25000"

For EACH provide:
{"input": "masu 10kg kineko bholi tirne", "intent": "khata_credit_purchase", "entities": {"item": "masu/meat", "quantity": "10kg", "amount": null, "payment_terms": "credit"}, "needs_clarify": true, "clarify_question": "Masu ko rate kati ho? Total amount lekhnus.", "sector": "restaurant_cafe"}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 14: Mobile/Electronics Repair Phrases
**Save as:** `sectors/mobile_electronics.jsonl`

```
You are building Nepal AI for mobile/electronics repair shops. Generate realistic phrases.

TASK: Generate 40 phrases covering:

ITEMS: mobile, phone, screen, display, battery, charger, cable, earphone, cover, tempered glass, IC, motherboard, speaker, mic, camera, laptop, computer, RAM, SSD, HDD, printer, CCTV

SERVICES: screen change, battery replace, software, flashing, unlock, repair, servicing, data recovery

TRANSACTIONS:
- "Samsung screen change 3500 cash"
- "customer ko phone aayo repair lagi" (job received)
- "spare parts kineko Kathmandu bata 15000"
- "iPhone battery wholesale 20 piece 12000"
- "repair charge 800 ma milayo"
- "display kineko tara kaam bhayena, noksan 2000" (defective part loss)
- "part supplier lai 8000 advance"
- "customer le phone lagna aayena, 1 mahina bho" (unclaimed item)
- "used phone kineko 5000, becheko 7500"
- "warranty claim part firta pathako"

For EACH provide:
{"input": "display kineko kaam bhayena", "intent": "khata_expense_or_loss", "entities": {"item": "display", "amount": null, "issue": "defective"}, "needs_clarify": true, "clarify_question": "Display ko price kati thiyo? Loss amount lekhnus.", "sector": "mobile_electronics"}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 15: Clinic/Pharmacy Admin Phrases
**Save as:** `sectors/health_admin.jsonl`

```
You are building Nepal AI for clinic/pharmacy ADMIN (billing, not medical advice). Generate realistic phrases.

TASK: Generate 40 phrases covering admin/billing ONLY:

ITEMS: medicine, ausadhi, tablet, capsule, syrup, injection, saline, bandage, cotton, syringe, gloves, mask, OPD ticket, lab test, X-ray, USG, consultation fee

TRANSACTIONS (non-medical):
- "OPD collection aaja 15000"
- "medicine stock kineko 50000"
- "Dr. fee payment 10000"
- "patient Ram Bahadur ko bill 2500"
- "lab test income 8000"
- "pharmacy sale 12000"
- "expired medicine write off 3000"
- "medical equipment EMI 5000"
- "nurse salary 20000"
- "clinic rent 30000"
- "electricity + water 4000"
- "supplier payment 25000"

IMPORTANT: No diagnosis, treatment advice, or medical recommendations. Admin/billing only.

For EACH provide:
{"input": "expired medicine 3000 ko waste", "intent": "khata_inventory_write_down", "entities": {"item": "expired medicine", "amount": 3000}, "sector": "health_admin", "risk_level": "low", "disclaimer_required": false, "note": "billing entry only, not medical"}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 16: Transport/Logistics Phrases
**Save as:** `sectors/transport_logistics.jsonl`

```
You are building Nepal AI for transport/logistics business. Generate realistic phrases.

TASK: Generate 40 phrases covering:

VEHICLES: truck, lorry, pickup, tempo, bike, scooter, car, bus, mini-bus, tipper, tanker, trailer
COSTS: diesel, petrol, mobil (engine oil), tyre, repair, servicing, insurance, bluebook, route permit, parking, toll

TRANSACTIONS:
- "KTM-Birgunj trip income 25000"
- "diesel bhareko 8000"
- "tyre puncture repair 500"
- "driver salary 18000"
- "helper bhatta 300"
- "truck servicing 15000"
- "insurance renew 12000"
- "police fine 2000" (chalani)
- "accident repair 50000"
- "party advance leko 20000"
- "bhada aako 30000"
- "loading/unloading kharcha 1500"
- "godam bhaada 5000"
- "GPS tracker monthly 500"

For EACH provide:
{"input": "diesel bhareko 8000 trip lagi", "intent": "khata_expense", "entities": {"item": "diesel/fuel", "amount": 8000, "purpose": "trip"}, "sector": "transport_logistics"}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 17: Agriculture/Farming Phrases
**Save as:** `sectors/agriculture.jsonl`

```
You are building Nepal AI for farmers and agri-business. Generate realistic phrases.

TASK: Generate 40 phrases covering:

ITEMS: mal (fertilizer), biu (seed), biruwa (seedling), dawai (pesticide), tractor, pump, pipe, jaal (net), kharko (fodder), dhan (paddy), makai (corn), gahu (wheat), tori (mustard), tarkari (vegetables), phal (fruits), dudh (milk), masu (meat), anda (egg), machha (fish)

TRANSACTIONS:
- "mal kineko 10 bag 8000"
- "biu aayo cooperative bata 5000"
- "tarkari becheko mandi ma 12000"
- "tractor bhaada 2000"
- "majdoor (labor) 5 jana 2500"
- "dudh collection aaja 500L 30000"
- "kukura dana kineko 4000"
- "anda becheko 500 piece 7500"
- "crop damage baadhile 20000 loss"
- "krishi rin EMI 5000"
- "seed subsidy aayo 2000"
- "bali bima premium 1500"
- "cooperative bachat 1000"

For EACH provide:
{"input": "baadhi le bali gayo 20000 noksan", "intent": "khata_loss_write_off", "entities": {"cause": "flood/baadhi", "item": "crop/bali", "amount": 20000}, "sector": "agriculture", "clarify_needed": false}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 18: Education/Coaching Phrases  
**Save as:** `sectors/education.jsonl`

```
You are building Nepal AI for schools, tuition centers, coaching institutes. Generate realistic phrases.

TASK: Generate 40 phrases covering:

INCOME: fee, shulka, monthly fee, admission fee, exam fee, registration, tuition, coaching fee
EXPENSES: teacher salary, rent, stationery, books, copy, electricity, internet, furniture, computer, printer, projector

TRANSACTIONS:
- "class 10 ka 30 student fee collection 45000"
- "admission fee 5 jana 25000"
- "teacher salary 4 jana 60000"
- "stationery kineko 5000"
- "projector kineko EMI 3000"
- "copy kitab becheko 8000"
- "exam form fee collection 10000"
- "student Ram ko fee baki 2 months"
- "scholarship student fee waive 5000"
- "building rent 20000"
- "internet bill 2000"
- "sports equipment 8000"
- "annual function kharcha 15000"

For EACH provide:
{"input": "10 class fee collection 45000", "intent": "khata_receipt", "entities": {"item": "student fee", "class": "10", "amount": 45000}, "sector": "education"}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 19: Professional Services (CA/Lawyer/Consultant)
**Save as:** `sectors/professional_services.jsonl`

```
You are building Nepal AI for CA firms, law firms, consultancies. Generate realistic phrases.

TASK: Generate 40 phrases covering:

INCOME: consultation fee, retainer, audit fee, tax filing fee, case fee, legal fee, advisory fee
EXPENSES: office rent, staff salary, registration, membership, CPE, travel, client entertainment

TRANSACTIONS:
- "XYZ Company audit fee 50000"
- "tax filing 20 clients 40000"
- "NCA membership fee 5000"
- "client meeting travel 2000"
- "junior staff salary 25000"
- "office rent 15000"
- "law library subscription 8000"
- "court fee stamp duty 3000"
- "client Ram Prasad fee baki 15000"
- "retainer monthly ABC Corp 20000"
- "VAT return filing 30 clients 15000"
- "company registration service 25000"
- "legal notice draft 5000"

For EACH provide:
{"input": "audit fee XYZ company 50000", "intent": "khata_receipt", "entities": {"service": "audit", "client": "XYZ company", "amount": 50000}, "sector": "professional_services"}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 20: Polysemy - Same Word Different Meaning by Sector
**Save as:** `language/polysemy.jsonl`

```
You are building Nepal AI. Document words that have DIFFERENT meanings in different professional contexts.

TASK: Generate 40 polysemous terms with their sector-specific meanings:

EXAMPLES:
- "case": legal (court case), medical (patient case), mobile repair (phone case/cover)
- "file": tax (tax file), legal (case file), computer (digital file)
- "return": tax (tax return), sales (sales return), investment (ROI)
- "bill": sales (invoice), parliament (law bill), restaurant (customer bill)
- "audit": accounting (financial audit), IT (security audit), quality (QA audit)
- "license": business (trade license), driving (driver license), software (software license)
- "registration": company (incorporation), vehicle (bluebook), land (lalpurja)
- "clearance": customs (import), medical (health clearance), security (police clearance)
- "deposit": bank (savings), advance (booking), legal (court deposit)
- "premium": insurance (premium), quality (premium product), finance (bond premium)

For EACH provide:
{"word": "case", "meanings": [{"sector": "legal", "meaning_en": "court case/lawsuit", "nepali_term": "mudda", "example": "case file gareko"}, {"sector": "medical", "meaning_en": "patient case", "nepali_term": "birami case", "example": "aaja 20 case aayo"}, {"sector": "mobile_repair", "meaning_en": "phone cover", "nepali_term": "mobile case", "example": "case kineko 200"}], "disambiguation_hint": "check sector context and surrounding words"}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 21: Nepal Tax Vocabulary (IRD/VAT/TDS/Income Tax)
**Save as:** `regulated/tax_vocabulary.jsonl`

```
You are building Nepal AI for tax-related queries. Document tax vocabulary - FACTUAL ONLY, no personalized advice.

TASK: Generate 40 tax terms with explanations:

VAT: VAT, mulya abhivriddhi kar, 13%, VAT bill, VAT return, input VAT, output VAT, zero rated, exempt, reverse charge
INCOME TAX: income tax, aayakar, tax slab, 1/25/30/36%, presumptive tax, TDS, withholding, advance tax, final withholding
COMPLIANCE: PAN, ETDS, annual return, VAT return, income tax return, audit threshold, filing deadline
FORMS: annex 7, annex 13, form 13, audit report, balance sheet submission, tax clearance
PENALTIES: fine, surcharge, interest, penalty, late filing fee

IMPORTANT: Factual definitions only. Always add "consult CA/tax professional for your specific case" for any rate/calculation.

For EACH provide:
{"term": "TDS", "nepali": "स्रोतमा कर कट्टी", "roman": "srot ma kar katti", "meaning_en": "Tax Deducted at Source - payer deducts tax before payment", "current_rates_general": "1.5% on goods, 10% on service, 15% on rent (verify with IRD)", "common_questions": ["TDS kati katne?", "TDS kati %?", "TDS refund kasari?"], "risk_level": "high", "disclaimer_required": true, "disclaimer": "Rates change. Consult CA or IRD for current applicable rates."}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 22: Nepal Legal Vocabulary (Courts/Contracts/Property)
**Save as:** `regulated/legal_vocabulary.jsonl`

```
You are building Nepal AI for legal awareness. Document legal vocabulary - FACTUAL ONLY, no legal advice.

TASK: Generate 40 legal terms:

COURTS: Supreme Court (sarbochcha), High Court (uchcha), District Court (jilla), quasi-judicial
CASES: civil (dewani), criminal (foujdari), writ (reet), appeal (punarabedan), revision
DOCUMENTS: lalpurja (land ownership), bluebook (vehicle), citizenship (nagarikta), contract (karar), MOU, agreement
PROPERTY: jagga (land), ghar (house), registration (rajistration), mutation (naamsari), partition (baandapatra)
FAMILY: marriage (bibaha), divorce (samparka biched), inheritance (ansha), will (bakaspatra)
BUSINESS: company registration, partnership deed, trademark, patent

IMPORTANT: Definitions and process overview only. Always recommend consulting lawyer for actual cases.

For EACH provide:
{"term": "lalpurja", "nepali": "लालपुर्जा", "meaning_en": "Land ownership certificate issued by Land Revenue Office", "process_overview": "Obtained after land registration at Malpot office", "common_questions": ["lalpurja kasari banune?", "lalpurja harayo k garne?"], "risk_level": "high", "disclaimer_required": true, "disclaimer": "Land matters are complex. Consult a lawyer for your specific case."}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 23: Nepal Labor/SSF/Payroll Vocabulary
**Save as:** `regulated/labor_ssf.jsonl`

```
You are building Nepal AI for HR/payroll queries. Document labor law and SSF vocabulary - FACTUAL ONLY.

TASK: Generate 40 labor/employment terms:

SALARY: talab, salary, basic, allowance, bhatta, grade, bonus, dashain bonus, gratuity
SSF: Social Security Fund, samajik suraksha kosh, employee contribution, employer contribution, 11% + 20%
LEAVE: bida, sick leave, annual leave, maternity, paternity, public holiday
COMPLIANCE: appointment letter, contract, probation, confirmation, termination, layoff, PF, CIT
STATUTORY: minimum wage, overtime, working hours, Labor Act, Labor Rules

For EACH provide:
{"term": "SSF contribution", "nepali": "सामाजिक सुरक्षा कोष योगदान", "meaning_en": "Social Security Fund - employee 11% + employer 20% of basic salary", "calculation_overview": "Based on basic salary, capped amounts apply", "common_questions": ["SSF kati katne?", "SSF kasari calculate garne?", "SSF benefit k k cha?"], "risk_level": "medium", "disclaimer_required": true, "disclaimer": "SSF rules updated periodically. Check ssf.gov.np for current rates."}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 24: Banking/Finance/Digital Payment Vocabulary
**Save as:** `regulated/banking_finance.jsonl`

```
You are building Nepal AI for banking queries. Document banking/finance vocabulary - FACTUAL ONLY.

TASK: Generate 40 banking/finance terms:

ACCOUNTS: bachat (savings), chalti (current), mudatti (fixed deposit), joint account, minor account
TRANSACTIONS: jamma (deposit), jhiknu (withdraw), transfer, RTGS, NCHL, connectIPS, mobile banking
LOANS: rin (loan), karja, EMI, interest rate, collateral, mortgage, dharauti, guarantee
DIGITAL: eSewa, Khalti, IME Pay, mobile wallet, QR payment, NPI, fonepay
KYC: KYC, customer identification, PAN, citizenship, photo, signature

For EACH provide:
{"term": "connectIPS", "nepali": "कनेक्ट आइपीएस", "meaning_en": "Interbank real-time fund transfer system by NCHL", "usage": "Bank-to-bank transfers, bill payments, government payments", "common_questions": ["connectIPS limit kati?", "connectIPS charge kati?"], "risk_level": "low", "disclaimer_required": false}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 25: Government Services/Public Admin Vocabulary
**Save as:** `regulated/government_services.jsonl`

```
You are building Nepal AI for government service queries. Document public administration vocabulary.

TASK: Generate 40 government/municipal terms:

LOCAL GOV: ward office, municipality (nagarpalika), rural municipality (gaunpalika), province, federal
DOCUMENTS: nagarikta (citizenship), passport, driving license, voter ID, birth certificate, death certificate, marriage certificate, migration (basaai sarai)
LAND: Malpot, land revenue, mutation, partition, survey, plotting
SERVICES: sifarish (recommendation letter), character certificate, tax clearance, no objection letter

For EACH provide:
{"term": "nagarikta", "nepali": "नागरिकता", "meaning_en": "Citizenship certificate - primary identity document in Nepal", "issuing_authority": "District Administration Office (DAO/CDO)", "requirements_overview": "Father/mother's citizenship, birth certificate, photos", "common_questions": ["nagarikta kasari banune?", "nagarikta harayo?", "citizenship correction kasari?"], "risk_level": "low"}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 26: Accounting Concepts (Journal/Ledger/Financial Statements)
**Save as:** `knowledge/accounting_concepts.jsonl`

```
You are building Nepal AI for accounting education. Document core accounting concepts - educational, not advice.

TASK: Generate 40 accounting concept explanations:

BASICS: debit, credit, journal, ledger, voucher, trial balance, double entry
STATEMENTS: balance sheet, profit & loss, cash flow, equity statement
ACCOUNTS: asset, liability, equity, income, expense, gain, loss
PRINCIPLES: accrual, matching, going concern, consistency, materiality, prudence
NEPAL SPECIFIC: NAS, NFRS, IFRS adoption, statutory audit threshold

Make explanations accessible to small business owners, not just accountants.

For EACH provide:
{"concept": "debit", "nepali": "डेबिट / नामे", "meaning_en": "Left side entry - increases assets/expenses, decreases liabilities/income", "simple_explanation": "Paisa kahaa gayo wa k aayo = debit side", "memory_trick": "Debit = Door - paisa door bata aaucha (asset), door bata jancha (expense)", "common_confusions": ["beginners think debit always means money going out"], "examples": ["Cash Dr 500 - cash aayo", "Expense Dr 100 - kharcha bhayo"]}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 27: Common Typos & Spelling Variants
**Save as:** `language/typos_variants.jsonl`

```
You are building Nepal AI spell-checker. Document common Nepali typing errors and variants.

TASK: Generate 50 common typo patterns:

KEYBOARD ERRORS: adjacent key hits, missing letters, double letters
PHONETIC CONFUSION: cha/chha, ta/tha/da/dha, sa/sha, ba/bha/va, na/ना
VOWEL VARIATIONS: a/aa, i/ee/e, u/oo, ai/ae/ay, au/ao/aw, o/ो
ROMANIZATION VARIANTS: same sound, different spelling (kharcha/kharca/kharxa)
COMMON WORDS MISSPELLED: receipt, payment, balance, voucher, invoice, amount

For EACH provide:
{"correct": "udhaar", "variants": ["udhar", "udharo", "udhari", "udhaar", "udhaaro", "udahar", "udar"], "type": "phonetic_and_length_variation", "frequency": "very_high", "context": "credit transaction"}

Also include English words commonly misspelled:
{"correct": "receipt", "variants": ["reciept", "receit", "recipt", "recpt"], "type": "english_common_misspelling"}

OUTPUT: 50 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 28: Multi-Turn Conversation Patterns
**Save as:** `behavior/multiturn_patterns.jsonl`

```
You are building Nepal AI conversation handler. Document multi-turn conversation patterns.

TASK: Generate 30 multi-turn conversation chains (3-4 turns each):

PATTERNS:
1. Entry → Confirm → Done
2. Entry → Amount missing → User provides → Confirm
3. Entry → Wrong → User corrects → New confirm
4. Entry → Cancel → Acknowledged
5. Entry → Related follow-up (sale then loss on same item)
6. Question → Answer → Follow-up question
7. Vague input → Clarify → Specific input → Entry

For EACH chain provide:
{"chain_id": "entry_clarify_confirm_01", "turns": [
  {"role": "user", "text": "sariya kineko"},
  {"role": "assistant", "text": "Sariya kati amount ma kineko? Number lekhnus.", "action": "clarify", "missing": "amount"},
  {"role": "user", "text": "50000"},
  {"role": "assistant", "text": "[Confirm card shown]", "action": "show_card", "intent": "khata_purchase", "amount": 50000, "item": "sariya"},
  {"role": "user", "text": "ho"},
  {"role": "assistant", "text": "Entry save bhayo ✓", "action": "confirm_entry"}
], "pattern_type": "clarify_then_confirm"}

OUTPUT: 30 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 29: Clarify Question Templates
**Save as:** `behavior/clarify_templates.jsonl`

```
You are building Nepal AI response generator. Create clarify question templates for missing information.

TASK: Generate 40 clarify question templates for these scenarios:

MISSING AMOUNT: rakam, price, total, cost
MISSING PARTY: customer name, supplier name, who
MISSING ITEM: k becheko, k kineko, what item
MISSING DIRECTION: diye ki liye, becheko ki kineko, paid or received
MISSING DATE: kahile, kun din, which date
AMBIGUOUS INTENT: expense or loss, sale or transfer, payment or advance

Templates should be:
- Natural Nepali (Roman)
- Include example format
- Not sound robotic

For EACH provide:
{"scenario": "missing_amount_purchase", "template_ne": "Kati ma kineko? Amount lekhnus (jastai: 5000, 50 hajar)", "template_en": "How much did you pay? Write the amount (e.g., 5000)", "example_trigger": "sariya kineko", "example_response": "Sariya kati ma kineko? Amount lekhnus (jastai: 50000)"}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 30: Domain Router Training Set
**Save as:** `behavior/router_training.jsonl`

```
You are building Nepal AI domain router. Generate training data to route messages to correct domain.

TASK: Generate 50 messages with correct routing labels:

DOMAINS:
- journal_entry: transaction to record
- accounting_qa: accounting concept question
- tax_qa: tax-related question
- legal_qa: legal question  
- general_qa: general knowledge question
- chat: casual conversation
- command: system command (delete, cancel, edit)
- clarify_response: answer to a clarify question (just a number, name, yes/no)

INCLUDE TRICKY CASES:
- "noksan k ho" → accounting_qa (question about loss)
- "noksan vo 400" → journal_entry (loss entry)
- "VAT kati" → tax_qa (question)
- "VAT 13% tireko" → journal_entry (entry)
- "ho" → clarify_response (confirmation)
- "delete" → command

For EACH provide:
{"input": "sariya kineye ghar banauna", "domain": "journal_entry", "confidence": 0.85, "reasoning": "contains purchase verb 'kineye' + item 'sariya' = transaction", "needs_clarify": true, "clarify_slot": "amount"}

OUTPUT: 50 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 31: Entity Extraction Training Set
**Save as:** `behavior/entity_extraction.jsonl`

```
You are building Nepal AI entity extractor. Generate training data for extracting entities from messages.

TASK: Generate 50 messages with entity labels:

ENTITIES TO EXTRACT:
- amount: numeric value (500, 5 hajar, 50k)
- party: person/company name (Ram, Shyam Store, ABC Company)
- item: product/service (sariya, cement, momo, repair)
- quantity: count/measure (5kg, 10 piece, 2 bag)
- unit_price: per-unit cost (50 eutako, 100 per kg)
- date: when (aaja, hijo, shrawan 15)
- direction: in/out indicator (lai, le, bata)

For EACH provide:
{"input": "Ram lai sariya 50kg 7500 ma becheko", "entities": {"party": {"value": "Ram", "start": 0, "end": 3}, "item": {"value": "sariya", "start": 8, "end": 14}, "quantity": {"value": "50kg", "start": 15, "end": 19}, "amount": {"value": 7500, "start": 20, "end": 24}, "direction": {"value": "lai", "role": "recipient"}}, "intent": "khata_credit_sale"}

OUTPUT: 50 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 32: Safety & Refusal Patterns
**Save as:** `behavior/safety_refusals.jsonl`

```
You are building Nepal AI safety layer. Generate patterns for when AI should refuse or add disclaimers.

TASK: Generate 40 safety scenarios:

MUST REFUSE:
- Illegal activity advice
- Tax evasion strategies  
- Fake document creation
- Harassment/threats
- Medical diagnosis
- Specific legal strategy for ongoing case

MUST ADD DISCLAIMER:
- Tax rate questions (rates change)
- Legal process questions (consult lawyer)
- Medical admin (not medical advice)
- Investment advice (consult financial advisor)

SHOULD REDIRECT:
- Suicidal/self-harm → helpline
- Emergency → call 100/102
- Fraud report → police

For EACH provide:
{"input_pattern": "tax kasari bachne", "category": "tax_evasion_request", "action": "refuse", "response_ne": "Tax compliance garera legally tax planning garna sakincha. Tax bachne (evasion) illegal ho. CA sanga lawful tax planning ko baare ma kura garnus.", "response_en": "Tax planning within law is possible. Tax evasion is illegal. Consult a CA for lawful tax planning.", "risk_level": "high"}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 33: Golden Evaluation Test Set (Core)
**Save as:** `eval/golden_core.jsonl`

```
You are building Nepal AI test suite. Generate golden test cases that must always pass.

TASK: Generate 50 test cases covering critical scenarios:

CATEGORIES:
- Must show entry card (clear transaction)
- Must ask clarify (missing amount/party)
- Must NOT show entry (questions)
- Must understand context (follow-up)
- Must refuse (unsafe request)

For EACH provide:
{"id": "golden_001", "input": "Ram lai 500 udhaar", "expected_action": "show_entry_card", "expected_intent": "khata_credit_sale", "expected_entities": {"party": "Ram", "amount": 500}, "must_not": ["generic_fallback", "question_answer"], "category": "clear_credit_sale"}

{"id": "golden_002", "input": "noksan k ho", "expected_action": "answer_question", "expected_not": "show_entry_card", "category": "question_not_entry"}

{"id": "golden_003", "input": "nokshan vo 400", "expected_action": "show_entry_card_or_clarify", "expected_intent": "khata_expense_or_loss", "category": "entry_with_colloquial_verb"}

{"id": "golden_004", "input": "sariya kineye ghar banauna", "expected_action": "clarify_amount", "must_not": ["generic_fallback", "chat_response"], "category": "purchase_missing_amount"}

OUTPUT: 50 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 34: Golden Evaluation Test Set (Edge Cases)
**Save as:** `eval/golden_edge.jsonl`

```
You are building Nepal AI test suite. Generate EDGE CASE test scenarios.

TASK: Generate 40 tricky/edge test cases:

EDGE CASES:
- Very short input: "500", "ho", "Ram"
- Mixed language: "sale 500 rupees gareko"
- Typos: "udharo" "kineye" "tireo"
- No amount but clear intent: "cement kineko"
- Amount but no intent: "5000"
- Same word different context: "case" in legal vs mobile
- Negation: "becheko hoina kineko ho"
- Past reference: "hijo ko tyo 500 wala"
- Correction: "500 hoina 600"
- Multiple entities: "Ram lai cement 10 bag 5000 eutako"

For EACH provide:
{"id": "edge_001", "input": "500", "context": "after system asked 'amount kati?'", "expected_action": "use_as_amount", "expected_entities": {"amount": 500}, "category": "bare_number_as_clarify_response"}

{"id": "edge_002", "input": "becheko hoina kineko ho", "expected_action": "correct_prior_intent", "corrected_intent": "khata_purchase", "category": "negation_correction"}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 35: Nepali Proverbs & Idioms in Business Context
**Save as:** `language/proverbs_idioms.jsonl`

```
You are building Nepal AI. Document Nepali proverbs/idioms used in business context.

TASK: Generate 30 proverbs/idioms with business interpretation:

EXAMPLES:
- "Paisa le paisa kamaucha" - Money makes money (investment context)
- "Haat ko maila" - Easy come easy go (petty cash context)
- "Rin ko bojh" - Burden of debt
- "Ghar ko bagh" - Domestic competitor
- "Aafno kharcha aafnai" - Self-funded, bootstrap

For EACH provide:
{"proverb_ne": "Paisa le paisa kamaucha", "proverb_roman": "paisa le paisa kamaucha", "literal_en": "Money earns money", "meaning_en": "Capital generates returns through investment", "business_context": "Used when discussing reinvestment, compound growth, or why working capital matters", "example_usage": "Business ma invest gara, paisa le paisa kamaucha", "related_concepts": ["ROI", "compound interest", "reinvestment"]}

OUTPUT: 30 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 36: Nepal Geographic & Administrative Knowledge
**Save as:** `knowledge/nepal_geography.jsonl`

```
You are building Nepal AI. Document Nepal geographic and administrative knowledge.

TASK: Generate 40 entries covering:

PROVINCES: all 7 provinces with capitals, major districts
MAJOR CITIES: Kathmandu, Pokhara, Biratnagar, Birgunj, Bharatpur, etc.
DISTRICTS: all 77 districts grouped by province
ZONES: old zone system (still used in some contexts)
REGIONS: Terai, Hill, Mountain
BORDERS: India (open), China (restricted)
DEVELOPMENT REGIONS: Eastern, Central, Western, Mid-Western, Far-Western (old system)

For EACH provide:
{"entity_type": "province", "name_en": "Bagmati Province", "name_ne": "बागमती प्रदेश", "capital": "Hetauda", "major_districts": ["Kathmandu", "Lalitpur", "Bhaktapur", "Kavrepalanchok", "Makwanpur", "Chitwan"], "area_km2": 20300, "common_references": ["Province 3", "Bagmati"]}

OUTPUT: 40 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 37: Nepal Festivals & Public Holidays
**Save as:** `knowledge/festivals_holidays.jsonl`

```
You are building Nepal AI. Document Nepal festivals and their business implications.

TASK: Generate 35 festival/holiday entries:

MAJOR: Dashain, Tihar, Holi, Teej, Chhath, Lhosar, Eid, Christmas, Buddha Jayanti
REGIONAL: Indra Jatra, Bisket Jatra, Gaura, Maghi, Udhauli, Ubhauli
PUBLIC HOLIDAYS: Republic Day, Constitution Day, Democracy Day, Martyrs Day
BUSINESS IMPACT: Dashain bonus, inventory stocking, closure periods, billing cycles

For EACH provide:
{"festival": "Dashain", "nepali": "दशैं", "timing": "Ashwin/Kartik (Sep-Oct)", "duration_days": 15, "public_holiday_days": 5, "business_impact": ["Dashain bonus mandatory (1 month salary)", "Inventory stocking before festival", "Reduced operations during main days", "Receivables collection before Dashain"], "accounting_notes": "Bonus provision, advance salary payments, gift expenses"}

OUTPUT: 35 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 38: Common Nepal Food & Restaurant Menu Items
**Save as:** `knowledge/food_menu.jsonl`

```
You are building Nepal AI for restaurant/food businesses. Document common menu items.

TASK: Generate 50 food item entries:

CATEGORIES:
- Nepali staples: dal bhat, momo, thukpa, chowmein, samosa, pakoda
- Meat: buff, chicken, mutton, pork, fish
- Drinks: tea, coffee, lassi, juice, soft drinks
- Fast food: burger, pizza, sandwich, roll
- Snacks: pani puri, chatpate, biscuit
- Sweets: mithai, jeri, laddu, barfi

For EACH provide:
{"item": "momo", "nepali": "मोमो", "category": "snack/main", "variants": ["buff momo", "chicken momo", "veg momo", "steam momo", "fried momo", "jhol momo"], "typical_price_range": "80-200", "common_phrases": ["momo 2 plate", "chicken momo steam", "momo kati?"], "units": ["plate", "piece", "order"]}

OUTPUT: 50 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 39: Construction Materials & Measurements
**Save as:** `knowledge/construction_materials.jsonl`

```
You are building Nepal AI for construction sector. Document materials and Nepal-specific measurements.

TASK: Generate 45 construction material entries:

MATERIALS: cement, rod/sariya, sand/balu, gravel/gitti, brick/ita, stone/dhungga, wood/kaath, ply, tile, paint, pipe, wire, fitting
MEASUREMENTS: bag (cement 50kg), quintal, kg, feet, inch, meter, sq ft, cft, brass, ropani, anna, paisa (land)
NEPAL SPECIFIC: Hetauda cement, Shivam cement, local rate variations

For EACH provide:
{"item": "cement", "nepali": "सिमेन्ट", "unit": "bag", "standard_weight": "50kg per bag", "common_brands": ["Hetauda", "Shivam", "Maruti", "Hongshi"], "typical_price_range": "850-950 per bag", "related_calculations": ["1 bag cement : 2 cft sand : 4 cft aggregate for M20"], "transaction_phrases": ["cement 10 bag kineko", "cement aayo 50 bag"]}

OUTPUT: 45 JSONL lines. No markdown. Start immediately.
```

---

## BATCH 40: Complete Intent Taxonomy
**Save as:** `ontology/intent_taxonomy.jsonl`

```
You are building Nepal AI intent classifier. Create comprehensive intent taxonomy.

TASK: Generate 60 intent definitions covering ALL transaction and query types:

TRANSACTION INTENTS:
- khata_cash_sale, khata_credit_sale, khata_cash_purchase, khata_credit_purchase
- khata_payment_in, khata_payment_out, khata_expense, khata_income
- khata_salary_payment, khata_rent_expense, khata_loan_received, khata_loan_repayment
- khata_capital_introduced, khata_drawings, khata_contra, khata_journal
- khata_sales_return, khata_purchase_return, khata_discount_allowed, khata_discount_received
- khata_bad_debt, khata_inventory_loss, khata_depreciation, khata_vat_payment
- khata_tds_deducted, khata_tds_paid, khata_ssf_payment, khata_gratuity

QUERY INTENTS:
- query_balance, query_outstanding, query_sales_report, query_purchase_report
- query_profit_loss, query_tax_due, query_definition, query_process

COMMAND INTENTS:
- cmd_cancel, cmd_edit, cmd_delete, cmd_repeat, cmd_reverse

For EACH provide:
{"intent": "khata_credit_sale", "description": "Sale made on credit - party owes money", "debit_account": "Sundry Debtors / Party", "credit_account": "Sales", "required_entities": ["amount"], "optional_entities": ["party", "item"], "trigger_phrases": ["udhaar becheko", "credit sale", "X lai udhaar", "baki ma diye"], "clarify_if_missing": ["party for tracking receivable"]}

OUTPUT: 60 JSONL lines. No markdown. Start immediately.
```

---

# COMPLETION CHECKLIST

After all 40 batches, you will have:

| Category | Files | Approx Lines |
|----------|-------|--------------|
| Language/Grammar | 10 | ~380 |
| Sector Phrases | 9 | ~360 |
| Regulated Domains | 5 | ~200 |
| Knowledge/Facts | 5 | ~220 |
| Behavior/Routing | 5 | ~230 |
| Evaluation | 2 | ~90 |
| **TOTAL** | **40** | **~1500** |

This provides foundation for:
- Roman Nepali parsing (verbs, particles, typos)
- Multi-sector transaction understanding
- Regulated domain awareness (tax, legal, labor)
- Router to separate entries from questions
- Safety policies
- Golden test suite for quality gates

---

# FOLDER STRUCTURE

Create these folders before starting:

```
data/nepal-ai/
├── ontology/
├── language/
├── sectors/
├── regulated/
├── knowledge/
├── behavior/
└── eval/
```

Each prompt tells you which folder and filename to use.

---

# NEXT STEPS AFTER COLLECTION

1. Merge all JSONL into unified knowledge chunks
2. Index for nearest-neighbor retrieval
3. Fine-tune small model OR build RAG pipeline
4. Wire to your existing e-KHATA parser
5. Run golden eval suite → target 95%+ pass
6. Deploy incremental improvements weekly
