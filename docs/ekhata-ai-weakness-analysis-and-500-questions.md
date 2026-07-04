# e-KHATA AI — Weakness Analysis, 500+ Failure Questions & Training Recommendations

**Date:** 4 July 2026  
**Scope:** `src/lib/ekhata/*`, `erp_bot/src/khata/*`, live panel routing via `eKhataStore.ts`

---

## Part 1 — Executive Summary

Your screenshot (`what is sampati` → Wikipedia result about Hindu demigod **Sampati**) is not a random bug. It is the **designed failure mode** of the current architecture when:

1. Ollama is **offline** (built-in brains run), or
2. Ollama is **online** but the LLM also lacks domain grounding and answers generically, or
3. The query matches `FACTUAL_QUESTION` regex (`what is`, `k ho`, `define`) and is routed to **English Wikipedia** instead of the accounting lexicon.

The system is **not one intelligence**. It is a **stack of regex routers** with ~28 journal templates, ~25 lexicon entries, static canned replies, and an optional 7B coder model. It cannot "generate from knowledge" in the way you want — it **retrieves** (Wikipedia, static JSON, keyword tables) or **matches patterns** (40+ intent regexes, work verbs).

---

## Part 2 — Complete Weakness Inventory

### A. Architecture & Routing Weaknesses

| # | Weakness | Impact |
|---|----------|--------|
| A1 | **Two divergent pipelines** — sync `processEKhataMessage` has framework brain; async live panel (`processEKhataMessageAsync`) skips it | IFRS questions fail in production |
| A2 | **Ollama short-circuits everything** when online — local Wikipedia + framework brain never run | Single point of failure; coder model not ideal for Nepali |
| A3 | **No true agent/tools** — LLM cannot search web, read ledger, or verify accounts | "Autonomous AI" is marketing, not capability |
| A4 | **Triple parser** (TS + Python + backend mock) can drift | Same sentence → different entries on different paths |
| A5 | **Random canned replies** (`pick()`) in conversational/emotional layers | Non-deterministic, untrustworthy for accounting |
| A6 | **Confidence thresholds are arbitrary** (0.6 accounting, 0.55 framework) | Borderline questions flip between engines unpredictably |
| A7 | **No conversation memory for entry context** beyond last 10 turns | Multi-step clarification breaks |
| A8 | **No ledger-aware reasoning** — balance passed but rarely used in Q&A | Cannot answer "what is my total debtors?" |
| A9 | **No disambiguation layer** before web search | Any `what is X` goes to Wikipedia first |
| A10 | **Session state in Python memory only** | Server restart = lost context |

### B. Web Search Weaknesses

| # | Weakness | Impact |
|---|----------|--------|
| B1 | **Wikipedia-only** (English) — UI claims "web search" | Nepali/Devanagari queries fail or return irrelevant English articles |
| B2 | **`FACTUAL_QUESTION` regex** triggers on `what is`, `define`, `explain`, `k ho` | Accounting definitions hijacked by general web |
| B3 | **Question mark + length > 10** also triggers search | `"sampatti k ho?"` → Wikipedia, not CA brain |
| B4 | **No domain classifier** before search | `sampati`, `capital`, `provision`, `goodwill`, `reserves` → wrong articles |
| B5 | **Naive snippet extraction** (first 1–2 sentences) | Incomplete/misleading answers even when article is right |
| B6 | **Static KNOWLEDGE base** in `nepaliBrain.ts` with keyword overlap scoring | Partial keyword match → wrong static fact |
| B7 | **Stale hardcoded facts** (tax slabs, PM name, population) | Contradicts "real-time" claims |

### C. Natural Language Entry Parsing Weaknesses

| # | Weakness | Impact |
|---|----------|--------|
| C1 | **Regex-first NLU** — 40+ ordered patterns in `CA_INTENT_PATTERNS` | Paraphrases outside patterns fail |
| C2 | **`shouldTryWorkParse` gate** skips questions even with numbers | `"500 ko saman kineko entry k ho?"` → no parse attempt |
| C3 | **Broad `hasPaymentInCue`** — `\b(aayo\|aayeko\|aaye)\b` matches non-payment text | `"byaj aayo"` may misroute; `"hawa aayo"` false positive risk |
| C4 | **Default sold → cash sale** without explicit udhaar/credit cue | Credit sales posted as cash |
| C5 | **Party extraction** — English capitalized names only; weak Devanagari | `"राम ले 500..."` loses party |
| C6 | **Amount heuristics** — "largest number wins" | Unit price picked over total in complex sentences |
| C7 | **Nepali number words** partially supported | `"pach hajar"`, `"dus lakh"` often missed |
| C8 | **No multi-entry in one message** | Compound transactions ignored |
| C9 | **No partial payments, instalments, advance adjustments** | Real business entries fail |
| C10 | **COGS/stock only via explicit keywords** | Selling inventory without saying "cogs" skips stock effect |
| C11 | **VAT/TDS/SSF splits are template-fixed** | Multi-rate, exempt, zero-rated fail |
| C12 | **Clarifying question hardcoded** — `"Aaple diye ki unle diye?"` | Wrong language register; doesn't fit all contexts |
| C13 | **`normalize()` strips filler words** including `le`, `lai`, `ko` | Breaks Nepali grammar signals |
| C14 | **No credit note / debit note / sales return** as first-class intents | Returns misclassified as purchase or expense |
| C15 | **Work verb list is English-heavy** | `"सामान बेचियो"`, `"किन्न लागyo"` missed |

### D. Accounting Language / Q&A Weaknesses

| # | Weakness | Impact |
|---|----------|--------|
| D1 | **Only ~25 concepts in ACCOUNTING_LEXICON** | Vast accounting vocabulary uncovered |
| D2 | **Definition answers hardcoded for ~15 terms** in `answerDefinition()` | Anything else → null → fallback |
| D3 | **Comparison answers only for 3 pairs** (accrual/cash, receivable/payable, income/expense/gain/loss) | Other comparisons fail |
| D4 | **Classification uses lexicon match, not reasoning** | `"Is bank overdraft an asset?"` → generic class list |
| D5 | **No NAS/Company Act / IRD circular knowledge** beyond VAT/SSF rates in prompt | Nepal-specific compliance gaps |
| D6 | **Conceptual framework brain disabled in live async path** | `"faithful representation k ho?"` fails offline |
| D7 | **Chroma RAG only injected in Python LLM path** | Offline users get zero framework retrieval |
| D8 | **No worked examples with user's chart of accounts** | Generic templates only |

### E. Language & Multilingual Weaknesses

| # | Weakness | Impact |
|---|----------|--------|
| E1 | **Language detection = regex word counting** | Mixed Nepali-English misclassified |
| E2 | **Devanagari transliteration inconsistent** across modules | Same word, different normal forms |
| E3 | **SPELLING_ALIASES finite** — dialect variants (`udhar`, `udhaar`, `udharo`) partially covered | New spellings fail |
| E4 | **No understanding of Nepali postpositions** (`le`, `lai`, `bata`, `ko`) as semantic roles | `"Ram bata 500 ayo"` vs `"Ram lai 500 diyo"` confused |
| E5 | **Emotional layer prepended to factual answers** | `"Hajur dukhi hunuhunchha..."` + Wikipedia snippet = unprofessional |
| E6 | **Replies randomly selected from template pools** | Same question → different quality each time |
| E7 | **Coder model (qwen2.5-coder:7b)** for Nepali CA chat | Weak Nepali fluency, weak reasoning vs CA models |
| E8 | **No code-switching strategy** | User mixes languages mid-conversation inconsistently |

### F. LLM Integration Weaknesses

| # | Weakness | Impact |
|---|----------|--------|
| F1 | **Hybrid entry: rules parse, LLM only narrates** | LLM cannot fix parser mistakes |
| F2 | **LLM told "DO NOT change amounts"** on parsed card | Wrong parse → wrong entry confirmed |
| F3 | **Silent catch on LLM failure** | User doesn't know which brain answered |
| F4 | **No fine-tuning** — prompt-only | Cannot learn Nepali accounting phrasing |
| F5 | **No reinforcement from confirmed/cancelled entries** | No learning loop |
| F6 | **Max 24 turns Python session** | Long conversations truncated |
| F7 | **No structured output schema** for entries | Free-text → parse errors |

---

## Part 3 — 520 Questions e-KHATA Will Fail (With Predicted Wrong Answers)

**Legend for predicted wrong answer types:**
- **WIKI** = English Wikipedia snippet (irrelevant entity/article)
- **GENERIC** = Conversational canned reply ("I'm e-Khata...", "Tell me more...")
- **WRONG-ENTRY** = Confirmation card with wrong Dr/Cr, wrong amount, or wrong intent
- **PARTIAL** = Superficially related but incomplete/wrong accounting answer
- **CLARIFY** = Asks irrelevant clarifying question or `"Aaple diye ki unle diye?"`
- **STATIC** = Wrong answer from hardcoded KNOWLEDGE keyword match
- **TEMPLATE** = Returns sample journal with NPR 10,000 example unrelated to question
- **NONE** = "Could not find" / falls through to useless reply

---

### Category 1 — Wikipedia Hijack of Accounting Terms (Questions 1–60)

Accounting terms that are also common English/Nepali words or Wikipedia article titles.

| # | Question | Predicted Wrong Answer |
|---|----------|---------------------|
| 1 | what is sampati | **WIKI** — Hindu demigod Sampati, brother of Jatayu (your screenshot) |
| 2 | sampati k ho | **WIKI** or **PARTIAL** — mythological figure, not asset definition |
| 3 | ke ho sampatti | **WIKI** — random Wikipedia title match |
| 4 | what is capital | **WIKI** — city Capital, Capital (economics) generic, or Capital punishment |
| 5 | capital k ho accounting ma | **WIKI** — may hit geography before accounting if Ollama offline |
| 6 | what is provision | **WIKI** — legal provision, not accounting provision |
| 7 | provision k ho | **WIKI/PARTIAL** — general definition, not bad debt provision |
| 8 | what is stock | **WIKI** — stock market, livestock, not inventory |
| 9 | stock k ho khata ma | **WIKI** — Stock (disambiguation page) |
| 10 | what is goodwill | **WIKI** — "goodwill" charity meaning, not intangible asset |
| 11 | what is reserve | **WIKI** — nature reserve, reserve army |
| 12 | what is accrual | **WIKI** — generic accrual concept without Nepal IRD context |
| 13 | what is depreciation | **PARTIAL** — if lexicon hits, OK; if Ollama offline + phrasing variant → **WIKI** physics depreciation |
| 14 | what is equity | **WIKI** — equity finance generic or social equity |
| 15 | what is liability | **WIKI** — legal liability, not accounting |
| 16 | rin k ho | **WIKI/PARTIAL** — may confuse with generic "debt" Wikipedia, not creditor vs loan |
| 17 | what is turnover | **WIKI** — employee turnover, not sales turnover |
| 18 | what is gross | **WIKI** — gross (unit), gross anatomy |
| 19 | what is net | **WIKI** — internet .net or fishing net |
| 20 | what is audit | **WIKI** — general audit article without Nepal CA context |
| 21 | what is reconciliation | **WIKI** — political reconciliation |
| 22 | what is consolidation | **WIKI** — debt consolidation generic |
| 23 | what is impairment | **WIKI** — medical impairment |
| 24 | what is amortization | **WIKI** — generic, no NAS/IFRS Para reference |
| 25 | what is materiality | **WIKI** — philosophy materialism |
| 26 | what is substance over form | **WIKI** — legal philosophy |
| 27 | what is going concern | **PARTIAL/WIKI** — may get business article, not Para 3.x framework |
| 28 | what is fair value | **WIKI** — generic economics |
| 29 | nyaya mulya k ho | **NONE/GENERIC** — Nepali term not in Wikipedia search |
| 30 | what is a debit note | **WIKI** — unrelated "debit" card article |
| 31 | what is a credit note | **WIKI** — credit card/credit score |
| 32 | what is WIP | **WIKI** — Work in progress disambiguation |
| 33 | what is COGS | **PARTIAL** — only if keyword hits; else **WIKI** |
| 34 | what is EBITDA | **WIKI** — formula without Nepal tax adjustment context |
| 35 | what is deferred tax | **WIKI** — generic IFRS without Nepal IRD alignment |
| 36 | what is contingent liability | **WIKI** — legal contingent |
| 37 | what is operating lease | **WIKI** — IFRS 16 summary without entry guidance |
| 38 | what is finance lease | **WIKI** — generic lease article |
| 39 | what is petty cash | **PARTIAL** — may work via lexicon miss → **GENERIC** |
| 40 | what is imprest | **WIKI** — unrelated imprest system article |
| 41 | what is float | **WIKI** — computer float, parade float |
| 42 | what is a journal | **WIKI** — academic journal, not book of original entry |
| 43 | what is ledger | **WIKI** — blockchain ledger or ledger stone |
| 44 | what is trial balance | **PARTIAL/TEMPLATE** — generic if lucky; else **WIKI** |
| 45 | what is balance sheet | **PARTIAL** — static KB may hit; phrasing variant → **WIKI** |
| 46 | what is P&L | **WIKI** — Profit and loss disambiguation |
| 47 | what is cash flow | **WIKI** — generic statement article |
| 48 | what is working capital | **WIKI** — formula only, no Nepal example |
| 49 | what is bank reconciliation | **PARTIAL** — not in lexicon → **WIKI** banking |
| 50 | what is a voucher | **WIKI** — travel voucher |
| 51 | what is narration | **WIKI** — storytelling narration |
| 52 | what is cost center | **WIKI** — management accounting generic |
| 53 | what is profit center | **WIKI** — generic |
| 54 | what is mark to market | **WIKI** — trading term without entry |
| 55 | what is convention of conservatism | **WIKI** — historical accounting convention article |
| 56 | what is matching concept | **WIKI** — generic matching principle |
| 57 | what is realization concept | **WIKI** — philosophy realization |
| 58 | biswasilo pratinidhitwo k ho | **NONE** — framework term; async path skips framework brain |
| 59 | manyata ko criteria k ho | **NONE/GENERIC** — recognition criteria in Nepali |
| 60 | sambandhitata k ho accounting ma | **NONE** — relevance characteristic not in lexicon |

---

### Category 2 — Nepali/Roman Entry Parsing Failures (Questions 61–160)

Natural transaction sentences the parser will miss or misclassify.

| # | Question | Predicted Wrong Answer |
|---|----------|---------------------|
| 61 | ram le 500 ko saman kinyo | **WRONG-ENTRY** — may parse as cash purchase not credit; party "Ram" may be lost |
| 62 | Ram le 500 ko saman kinyo udhaar ma | **WRONG-ENTRY** — party extraction fails without `lai`; amount OK intent maybe |
| 63 | राम ले ५०० को सामान किनyo | **WRONG-ENTRY/NONE** — Devanagari party not extracted |
| 64 | 500 ma saman kine | **WRONG-ENTRY** — classified as generic purchase; cash assumed |
| 65 | aaja 1200 ko chiya beche | **WRONG-ENTRY** — cash sale OK but item "chiya" lost; no VAT |
| 66 | 200 cup 50 ma beche | **PARTIAL** — qty×rate may work IF pattern matches |
| 67 | 200 cup @ 50 | **WRONG-ENTRY** — may miss if no verb |
| 68 | becheko 200 cup 50 prati | **WRONG-ENTRY** — Nepali unit phrasing often missed |
| 69 | Shyam lai 5000 ko mal udhaar ma diye | **WRONG-ENTRY** — credit sale; party may work with `lai` |
| 70 | Shyam bata 5000 ayo | **WRONG-ENTRY** — payment received vs income confused |
| 71 | Shyam le 5000 tiryo | **WRONG-ENTRY** — payment in OK if party found |
| 72 | Shyam le 5000 diyo | **CLARIFY** — `"Aaple diye ki unle diye?"` instead of payment in |
| 73 | maile Shyam lai 5000 diye | **WRONG-ENTRY** — payment OUT not IN |
| 74 | Shyam ko udhaar 3000 make off gare | **NONE** — "make off" not in bad debt patterns |
| 75 | 3000 ko receivable write off | **WRONG-ENTRY** — may work if exact keywords |
| 76 | nasakne 4500 | **WRONG-ENTRY** — bad debt if keyword hits; else **NONE** |
| 77 | 4500 furta lagaunu paryo | **NONE** — Nepali "write off" phrasing not in regex |
| 78 | pach hajar ko rent tiryo | **WRONG-ENTRY** — Nepali number word may fail → wrong amount |
| 79 | dus hajar talab accrue gare | **WRONG-ENTRY** — `accrue` not `accrual` keyword |
| 80 | mahina ko talab 85000 book gara | **NONE** — "book gara" not in work verbs |
| 81 | salary 85000 month end | **WRONG-ENTRY** — needs exact `salary accrual` pattern |
| 82 | 85000 talab diyo bank bata | **WRONG-ENTRY** — salary payment if pattern matches |
| 83 | SSF kata 8500 | **WRONG-ENTRY** — may hit SSF employee at 10% wrong base |
| 84 | karmachari SSF 7800 | **PARTIAL** — if keywords align |
| 85 | employer SSF 9570 | **WRONG-ENTRY** — may work |
| 86 | 9570 employer contribution SSF | **WRONG-ENTRY** — order sensitivity |
| 87 | gratuity ko andaaja 120000 | **WRONG-ENTRY** — needs `gratuity provision` exact |
| 88 | 120000 gratuity tiryo | **WRONG-ENTRY** — gratuity payment |
| 89 | VAT sanga becheko 11300 | **WRONG-ENTRY** — gross vs net VAT split often wrong |
| 90 | 10000 ko bikri ma VAT | **WRONG-ENTRY** — may treat 10000 as net not gross |
| 91 | 11300 gross sale vat included | **WRONG-ENTRY** — inclusive VAT calculation error |
| 92 | input VAT 1300 | **NONE** — no purchase context |
| 93 | VAT tiryo 5000 | **WRONG-ENTRY** — VAT payment if keyword |
| 94 | IRD lai VAT 5000 | **PARTIAL** — may miss IRD alias |
| 95 | TDS kateko 1500 | **WRONG-ENTRY** — if `tds kateko` matches |
| 96 | 1500 withholding tax kata | **PARTIAL** |
| 97 | TDS remittance 15000 | **WRONG-ENTRY** — TDS paid |
| 98 | 15000 TDS bank ma jama | **WRONG-ENTRY** |
| 99 | byaj aayo 2500 | **WRONG-ENTRY** — other income OR false payment-in via `aayo` |
| 100 | interest aayo 2500 | **WRONG-ENTRY** — excluded from payment-in cue; other income |
| 101 | bhada aayo 15000 | **WRONG-ENTRY** — rent received |
| 102 | bank charge 500 kata | **WRONG-ENTRY** — bank charges |
| 103 | 500 bank fee | **WRONG-ENTRY** |
| 104 | chhut diye 200 | **WRONG-ENTRY** — discount allowed |
| 105 | 200 discount paayo | **WRONG-ENTRY** — discount received |
| 106 | supplier lai 8000 tiryo | **WRONG-ENTRY** — payment out |
| 107 | 8000 payment gareko supplier lai | **WRONG-ENTRY** |
| 108 | udhaar ma saman 12000 | **WRONG-ENTRY** — credit purchase; party missing → **CLARIFY** |
| 109 | 12000 ko saman udhaar ma | **WRONG-ENTRY** — party missing |
| 110 | stock kineko 45000 cash | **WRONG-ENTRY** — stock purchase |
| 111 | inventory 45000 | **WRONG-ENTRY** — may classify as expense not stock |
| 112 | saman kineko 45000 | **WRONG-ENTRY** — generic purchase not stock |
| 113 | cogs 22000 | **WRONG-ENTRY** — only if explicit cogs keyword |
| 114 | becheko saman ko lagat 22000 | **NONE** — Nepali COGS phrasing missing |
| 115 | depreciation 180000 | **WRONG-ENTRY** — if keyword matches |
| 116 | mulya ghata 180000 | **WRONG-ENTRY** — Nepali depreciation |
| 117 | capital lagaayo 500000 | **WRONG-ENTRY** — capital introduced |
| 118 | malik le 500000 hale | **NONE** — "hale" not in patterns |
| 119 | drawings 25000 | **WRONG-ENTRY** |
| 120 | nikasne 25000 | **WRONG-ENTRY** — Nepali drawings |
| 121 | rin liyo 1000000 | **WRONG-ENTRY** — loan received |
| 122 | bank bata loan 1000000 | **PARTIAL** |
| 123 | rin tiryo 50000 | **WRONG-ENTRY** — loan repayment |
| 124 | 50000 loan installment | **WRONG-ENTRY** — may miss installment logic |
| 125 | cash bank ma jama 100000 | **WRONG-ENTRY** — contra entry |
| 126 | 100000 deposit to bank | **WRONG-ENTRY** |
| 127 | bank bata cash nikalyo 5000 | **NONE** — withdrawal not contra template |
| 128 | advance rent 36000 diyo | **WRONG-ENTRY** — prepaid expense |
| 129 | agadi tiryo rent 36000 | **WRONG-ENTRY** |
| 130 | bill aayo 8500 tara tirna baki | **WRONG-ENTRY** — outstanding expense |
| 131 | 8500 ko bill aayo | **WRONG-ENTRY** — `bill aayo` pattern |
| 132 | hijo 3000 ko kharcha | **WRONG-ENTRY** — expense; date may parse |
| 133 | parsi ko bikri 5000 | **WRONG-ENTRY** — future date sale misposted today |
| 134 | aaja ra hijo ko bikri 5000 ra 3000 | **NONE** — multi-entry |
| 135 | 5000 bikri ra 2000 kharcha | **NONE** — multi-entry |
| 136 | refund 1500 customer lai | **NONE** — no refund intent |
| 137 | 1500 return gare customer lai | **NONE** — sales return missing |
| 138 | sales return 1500 | **NONE** |
| 139 | purchase return 800 | **NONE** |
| 140 | credit note 2000 | **NONE** |
| 141 | debit note 1500 | **NONE** |
| 142 | partial payment 3000 out of 5000 | **NONE** — partial settlement |
| 143 | 5000 ma bata 3000 matra ayo | **NONE** |
| 144 | advance 10000 liyo customer bata | **NONE** — customer advance liability |
| 145 | 10000 advance diye supplier lai | **WRONG-ENTRY** — may be prepaid not payment |
| 146 | exchange rate gain 500 | **NONE** |
| 147 | forex loss 700 | **NONE** |
| 148 | stock count difference 400 | **NONE** — shrinkage |
| 149 | 400 ko saman bigryo | **NONE** — Nepali spoilage |
| 150 | free sample diye 500 worth | **NONE** |
| 151 | donation 1000 | **WRONG-ENTRY** — likely generic expense |
| 152 | sponsorship 50000 | **WRONG-ENTRY** — expense without classification |
| 153 | penalty 5000 tiryo | **WRONG-ENTRY** — expense not distinguished |
| 154 | insurance premium 12000 | **WRONG-ENTRY** — expense; prepaid if annual missed |
| 155 | 12000 ko annual insurance agadi | **WRONG-ENTRY** — should be prepaid |
| 156 | commission aayo 8000 | **WRONG-ENTRY** — other income vs payment in |
| 157 | 8000 commission income | **WRONG-ENTRY** |
| 158 | closing stock adjustment 25000 | **NONE** |
| 159 | opening balance 100000 capital | **NONE** — opening entry |
| 160 | purano khata bata transfer 50000 | **NONE** |

---

### Category 3 — English Entry Parsing Failures (Questions 161–240)

| # | Question | Predicted Wrong Answer |
|---|----------|---------------------|
| 161 | sold goods worth 5000 on credit to ABC Traders | **WRONG-ENTRY** — party may work; credit sale cue needed |
| 162 | made a credit sale of 5000 | **WRONG-ENTRY** — party missing → **CLARIFY** |
| 163 | invoiced XYZ Ltd 12000 for services | **NONE** — "invoiced" weakly supported |
| 164 | raised invoice 12000 | **NONE** |
| 165 | collected 5000 from debtor | **WRONG-ENTRY** — payment in; party generic |
| 166 | received cheque 5000 from Ram | **WRONG-ENTRY** — payment in |
| 167 | deposited cheque 5000 | **WRONG-ENTRY** — may be contra not collection |
| 168 | purchased inventory on account 45000 | **WRONG-ENTRY** — credit purchase phrasing |
| 169 | bought goods on account from Supplier Co | **WRONG-ENTRY** |
| 170 | paid supplier 8000 | **WRONG-ENTRY** — payment out |
| 171 | settled creditor 8000 | **PARTIAL** — "settled" not in patterns |
| 172 | incurred electricity expense 3500 | **WRONG-ENTRY** — expense |
| 173 | paid electricity bill 3500 | **WRONG-ENTRY** — payment not accrual distinction lost |
| 174 | electricity bill received 3500 unpaid | **WRONG-ENTRY** — outstanding expense if pattern hits |
| 175 | recorded salary expense 85000 for March | **WRONG-ENTRY** — accrual phrasing variant |
| 176 | processed payroll 85000 | **NONE** — "processed payroll" not matched |
| 177 | remitted SSF 9570 employer share | **PARTIAL** |
| 178 | deducted SSF from employees 7800 | **WRONG-ENTRY** |
| 179 | accrued gratuity 120000 | **WRONG-ENTRY** — if `gratuity accrual` exact |
| 180 | paid gratuity 120000 to staff | **WRONG-ENTRY** |
| 181 | recorded output VAT on sale 1300 | **NONE** — awkward phrasing |
| 182 | sale 11300 inclusive of VAT | **WRONG-ENTRY** — gross/net error |
| 183 | claimed input VAT 1300 | **NONE** |
| 184 | paid VAT liability 5000 to tax office | **WRONG-ENTRY** |
| 185 | withheld TDS 1500 on professional fees | **WRONG-ENTRY** |
| 186 | remitted TDS 15000 to IRD | **WRONG-ENTRY** |
| 187 | wrote off irrecoverable debt 4500 | **WRONG-ENTRY** |
| 188 | created provision for doubtful debts 3000 | **WRONG-ENTRY** |
| 189 | recovered previously written off debt 2000 | **WRONG-ENTRY** — if recovery pattern |
| 190 | charged depreciation 180000 | **WRONG-ENTRY** |
| 191 | owner introduced capital 500000 | **WRONG-ENTRY** |
| 192 | withdrew cash for personal use 25000 | **WRONG-ENTRY** — drawings phrasing |
| 193 | obtained bank loan 1000000 | **WRONG-ENTRY** — loan received |
| 194 | repaid loan instalment 50000 | **WRONG-ENTRY** |
| 195 | transferred cash to bank 100000 | **WRONG-ENTRY** — contra |
| 196 | bank charges deducted 500 | **WRONG-ENTRY** |
| 197 | allowed cash discount 200 | **WRONG-ENTRY** |
| 198 | received discount from supplier 200 | **WRONG-ENTRY** |
| 199 | sold 200 units at 50 each | **WRONG-ENTRY** — qty×rate |
| 200 | sold 200 @50 | **WRONG-ENTRY** — may miss without noun |
| 201 | sold two hundred cups at fifty rupees | **NONE** — word numbers in English |
| 202 | purchase 200 units at 40 each on credit | **WRONG-ENTRY** — complex |
| 203 | issued credit note 1500 to customer | **NONE** |
| 204 | received debit note 800 from supplier | **NONE** |
| 205 | customer paid advance 10000 | **NONE** |
| 206 | paid advance to landlord 36000 | **WRONG-ENTRY** — prepaid maybe |
| 207 | adjusted for stock take variance 400 | **NONE** |
| 208 | recorded unrealized forex gain 500 | **NONE** |
| 209 | petty cash expenses 700 | **WRONG-ENTRY** — generic expense |
| 210 | replenished imprest 5000 | **NONE** |
| 211 | accrual rent 15000 | **WRONG-ENTRY** — outstanding expense |
| 212 | prepaid insurance 12000 for year | **WRONG-ENTRY** — prepaid |
| 213 | split payment 3000 cash 2000 credit | **NONE** |
| 214 | barter exchange goods 5000 | **NONE** |
| 215 | consignment sale 8000 | **NONE** |
| 216 | commission income received 8000 | **WRONG-ENTRY** |
| 217 | dividend received 5000 | **WRONG-ENTRY** — other income |
| 218 | interest on FD 2500 | **WRONG-ENTRY** |
| 219 | penalty paid to government 5000 | **WRONG-ENTRY** — expense |
| 220 | donation given 1000 | **WRONG-ENTRY** |
| 221 | fixed asset purchased 250000 | **WRONG-ENTRY** — likely stock/expense misclass |
| 222 | computer kharejo 85000 | **NONE** — Nepali-English mix |
| 223 | sold old vehicle gain 50000 | **NONE** — disposal gain |
| 224 | asset disposal loss 20000 | **NONE** |
| 225 | revaluation surplus 100000 | **NONE** |
| 226 | impairment charge 30000 | **NONE** |
| 227 | amortization patent 5000 | **NONE** |
| 228 | lease payment 15000 | **NONE** |
| 229 | employee reimbursement 2500 | **NONE** |
| 230 | customer overpayment 500 refund | **NONE** |
| 231 | opening journal entry capital 100000 | **NONE** |
| 232 | closing entry transfer P&L | **NONE** |
| 233 | recorded COGS on sale 22000 | **WRONG-ENTRY** — if cogs explicit |
| 234 | inventory shrinkage 400 | **NONE** |
| 235 | production wages 30000 | **WRONG-ENTRY** — salary/expense generic |
| 236 | bill of exchange 50000 | **NONE** |
| 237 | post-dated cheque received 5000 | **NONE** |
| 238 | dishonoured cheque 5000 | **NONE** |
| 239 | contra entry bank to cash 2000 | **NONE** — only cash to bank template |
| 240 | journal voucher JV-001 salary 85000 | **NONE** — voucher reference ignored |

---

### Category 4 — "What Entry?" / Journal Logic Questions (Questions 241–320)

| # | Question | Predicted Wrong Answer |
|---|----------|---------------------|
| 241 | udhaar bikri ko entry k ho | **TEMPLATE** — sample NPR 10,000 credit sale |
| 242 | cash sale ko entry | **TEMPLATE** |
| 243 | payment received entry k ho | **TEMPLATE** |
| 244 | salary accrual ko entry kasari | **TEMPLATE** |
| 245 | SSF employer ko entry | **TEMPLATE** |
| 246 | VAT sale ma entry k hunchha | **TEMPLATE** — may miss gross/net explanation |
| 247 | bad debt write off entry | **TEMPLATE** |
| 248 | provision for bad debt entry | **TEMPLATE** |
| 249 | bank reconciliation mismatch entry k ho | **NONE/GENERIC** — not in templates |
| 250 | customer advance entry k ho | **NONE** |
| 251 | sales return entry | **NONE** |
| 252 | purchase return entry | **NONE** |
| 253 | credit note entry | **NONE** |
| 254 | debit note entry | **NONE** |
| 255 | petty cash imprest entry | **NONE** |
| 256 | FX revaluation entry | **NONE** |
| 257 | stock adjustment entry | **NONE** |
| 258 | GR/IR clearing entry | **NONE** |
| 259 | WIP to finished goods entry | **NONE** |
| 260 | depreciation straight line entry | **TEMPLATE** — no method reasoning |
| 261 | diminishing balance depreciation entry | **NONE** — method not supported |
| 262 | revaluation of building entry | **NONE** |
| 263 | impairment of inventory entry | **NONE** |
| 264 | lease liability recognition IFRS 16 | **NONE/WIKI** |
| 265 | operating vs finance lease entry farak | **NONE** |
| 266 | consignment inventory entry | **NONE** |
| 267 | bill discounting entry | **NONE** |
| 268 | factoring receivables entry | **NONE** |
| 269 | employee loan recovery entry | **NONE** |
| 270 | director remuneration entry | **PARTIAL** — salary template generic |
| 271 | bonus provision entry | **NONE** |
| 272 | leave encashment provision | **NONE** |
| 273 | overtime accrual entry | **NONE** |
| 274 | festival allowance entry Nepal | **NONE** |
| 275 | ex-gratia payment entry | **NONE** |
| 276 | insurance claim received entry | **NONE** |
| 277 | asset insurance total loss entry | **NONE** |
| 278 | capital work in progress capitalization | **NONE** |
| 279 | pre-operative expenses capitalization | **NONE** |
| 280 | borrowing cost capitalization entry | **NONE** |
| 281 | related party loan entry | **NONE** |
| 282 | shareholder loan to company entry | **PARTIAL** — loan received generic |
| 283 | company loan to director entry | **NONE** |
| 284 | dividend declared entry | **NONE** |
| 285 | dividend paid entry | **NONE** |
| 286 | prior period adjustment entry | **NONE** |
| 287 | error correction entry | **NONE** |
| 288 | change in accounting policy retrospective entry | **NONE** |
| 289 | deferred tax asset recognition entry | **NONE** |
| 290 | current tax provision entry | **NONE** |
| 291 | TDS on rent entry Nepal | **PARTIAL** — TDS template without rent rate 10% |
| 292 | TDS on professional services 15% entry | **PARTIAL** |
| 293 | TDS on commission entry | **NONE** |
| 294 | VAT on import entry | **NONE** |
| 295 | excise duty entry | **NONE** |
| 296 | customs duty capitalized entry | **NONE** |
| 297 | reverse charge VAT entry | **NONE** |
| 298 | zero rated export sale entry | **NONE** |
| 299 | exempt supply entry | **NONE** |
| 300 | mixed supply VAT entry | **NONE** |
| 301 | credit sale with freight charged entry | **NONE** |
| 302 | sale with trade discount entry | **PARTIAL** — discount allowed separate |
| 303 | sale with cash discount terms entry | **NONE** |
| 304 | purchase with trade discount entry | **NONE** |
| 305 | FOB vs CIF purchase entry | **NONE** |
| 306 | landed cost capitalization entry | **NONE** |
| 307 | multi-location stock transfer entry | **NONE** |
| 308 | branch accounting head office entry | **NONE** |
| 309 | intercompany elimination entry | **NONE** |
| 310 | consolidation adjustment entry | **NONE** |
| 311 | NCI adjustment entry | **NONE** |
| 312 | goodwill impairment entry | **NONE** |
| 313 | bargain purchase gain entry | **NONE** |
| 314 | joint venture equity method entry | **NONE** |
| 315 | associate investment entry | **NONE** |
| 316 | fair value through P&L investment entry | **NONE** |
| 317 | AFS investment reclassification entry | **NONE** |
| 318 | hedge accounting entry | **NONE** |
| 319 | revenue recognition over time entry | **NONE** |
| 320 | contract liability deferred revenue entry | **NONE** |

---

### Category 5 — Account Classification Questions (Questions 321–380)

| # | Question | Predicted Wrong Answer |
|---|----------|---------------------|
| 321 | bank overdraft asset ho ki liability | **PARTIAL/GENERIC** — generic class list |
| 322 | prepaid rent kun khata | **PARTIAL** — may miss prepaid lexicon |
| 323 | accrued expense asset ho ki liability | **PARTIAL** — wrong class risk |
| 324 | customer deposit liability ho? | **NONE** |
| 325 | unearned revenue k ho | **WIKI/PARTIAL** |
| 326 | deferred revenue classification | **WIKI** |
| 327 | input VAT asset ho? | **PARTIAL** — VAT lexicon liability-focused |
| 328 | output VAT kun khata | **PARTIAL** |
| 329 | TDS receivable asset ho? | **NONE** |
| 330 | TDS payable liability? | **PARTIAL** |
| 331 | SSF payable classification | **PARTIAL** |
| 332 | gratuity provision liability? | **PARTIAL** |
| 333 | provision for bad debts | **PARTIAL** |
| 334 | accumulated depreciation | **NONE** — contra asset not explained |
| 335 | drawings asset ho ki equity | **PARTIAL** |
| 336 | capital account classification | **PARTIAL** |
| 337 | retained earnings equity? | **NONE** |
| 338 | reserve fund classification | **WIKI** |
| 339 | general reserve | **WIKI** |
| 340 | revaluation reserve | **WIKI** |
| 341 | securities premium | **NONE** |
| 342 | share capital | **WIKI** — stock market |
| 343 | investment in subsidiary | **NONE** |
| 344 | long term loan | **PARTIAL** |
| 345 | current portion of long term loan | **NONE** |
| 346 | bank guarantee | **NONE** |
| 347 | contingent liability balance sheet ma? | **WIKI** |
| 348 | operating lease ROU asset | **NONE** |
| 349 | finance lease liability | **NONE** |
| 350 | inventory obsolescence provision | **NONE** |
| 351 | WIP classification | **WIKI** — disambiguation |
| 352 | raw material stock | **PARTIAL** — stock lexicon |
| 353 | finished goods | **PARTIAL** |
| 354 | consumable stores | **NONE** |
| 355 | loose tools | **NONE** |
| 356 | spare parts capital vs expense | **NONE** |
| 357 | repairs vs improvement | **NONE** |
| 358 | revenue vs capital expenditure | **NONE** |
| 359 | deferred tax asset | **WIKI** |
| 360 | deferred tax liability | **WIKI** |
| 361 | MAT credit entitlement | **NONE** |
| 362 | CSR expenditure | **NONE** |
| 363 | advertisement expense vs asset | **NONE** |
| 364 | software development cost capitalize? | **NONE** |
| 365 | website cost classification | **NONE** |
| 366 | patent amortization asset | **NONE** |
| 367 | trademark indefinite life | **NONE** |
| 368 | goodwill intangible | **WIKI** |
| 369 | negative goodwill | **NONE** |
| 370 | investment property | **WIKI** |
| 371 | bearer plants agriculture | **NONE** |
| 372 | biological assets | **WIKI** |
| 373 | government grant deferred income | **NONE** |
| 374 | subsidy received classification | **NONE** |
| 375 | commission payable | **NONE** |
| 376 | audit fees outstanding | **PARTIAL** |
| 377 | legal provision | **WIKI** — legal |
| 378 | warranty provision | **NONE** |
| 379 | onerous contract provision | **NONE** |
| 380 | restructuring provision | **WIKI** — corporate |

---

### Category 6 — IFRS/NAS Conceptual Framework (Questions 381–430)

| # | Question | Predicted Wrong Answer |
|---|----------|---------------------|
| 381 | faithful representation k ho | **NONE** — framework brain skipped in async |
| 382 | relevance in accounting | **WIKI/PARTIAL** |
| 383 | accrual basis definition IFRS | **PARTIAL** — comparison answer only |
| 384 | going concern assumption | **WIKI** |
| 385 | recognition criteria IFRS Para 5 | **NONE** — no Para citation offline |
| 386 | derecognition when | **NONE** |
| 387 | measurement historical cost vs fair value | **WIKI** |
| 388 | current value measurement | **NONE** |
| 389 | capital maintenance concept | **WIKI** |
| 390 | financial vs physical capital maintenance | **NONE** |
| 391 | qualitative characteristics enhancing | **NONE** |
| 392 | cost constraint in financial reporting | **NONE** |
| 393 | reporting entity concept | **WIKI** |
| 394 | asset definition IFRS Para 4.3 | **PARTIAL** — LLM may cite if online; offline **NONE** |
| 395 | liability definition Para 4.26 | **PARTIAL** |
| 396 | equity residual definition | **PARTIAL** |
| 397 | income vs gain IFRS | **PARTIAL** — comparison limited |
| 398 | expense vs loss IFRS | **PARTIAL** |
| 399 | pratiiphalan ko adhar k ho | **NONE** — Nepali framework |
| 400 | chalirakhne aadhar | **NONE** |
| 401 | NAS vs IFRS farak Nepal | **NONE/GENERIC** |
| 402 | Nepal financial reporting standard list | **NONE** |
| 403 | true and fair view Nepal | **NONE** |
| 404 | materiality threshold how determine | **WIKI** |
| 405 | substance over form example | **WIKI** |
| 406 | prudence vs neutrality IFRS | **NONE** |
| 407 | IAS 1 presentation requirements | **WIKI** |
| 408 | IAS 7 cash flow classification | **WIKI** |
| 409 | IAS 8 accounting policy change | **WIKI** |
| 410 | IAS 12 income taxes deferred | **WIKI** |
| 411 | IAS 16 subsequent expenditure | **WIKI** |
| 412 | IAS 36 impairment indicators | **WIKI** |
| 413 | IAS 37 provision recognition | **WIKI** |
| 414 | IFRS 15 five step model | **WIKI** — no entry linkage |
| 415 | IFRS 9 financial assets classification | **WIKI** |
| 416 | IFRS 16 lease recognition lessee | **WIKI** |
| 417 | revenue recognition over time vs point | **NONE** |
| 418 | contract asset vs receivable | **NONE** |
| 419 | onerous contract IAS 37 entry | **NONE** |
| 420 | ECL model IFRS 9 | **WIKI** |
| 421 | expected credit loss provision entry | **NONE** |
| 422 | hedge effectiveness testing | **WIKI** |
| 423 | cash generating unit impairment | **WIKI** |
| 424 | value in use calculation | **WIKI** |
| 425 | fair value hierarchy Level 1 2 3 | **WIKI** |
| 426 | related party disclosure NAS | **NONE** |
| 427 | events after reporting period | **WIKI** |
| 428 | prior period error IAS 8 correction | **NONE** |
| 429 | change in estimate vs policy | **NONE** |
| 430 | component accounting IFRS | **WIKI** |

---

### Category 7 — Nepal Tax & Compliance (Questions 431–480)

| # | Question | Predicted Wrong Answer |
|---|----------|---------------------|
| 431 | Nepal VAT 13% kasari calculate gross ma | **PARTIAL** — formula without worked example |
| 432 | VAT exempt items list Nepal | **STATIC/WIKI** — incomplete |
| 433 | zero rated export VAT entry | **NONE** |
| 434 | VAT credit note IRD procedure | **NONE** |
| 435 | anna 13 form VAT | **NONE** |
| 436 | TDS rate rent Nepal 2026 | **STATIC** — may be stale |
| 437 | TDS professional 15% entry example | **PARTIAL** |
| 438 | TDS on transport 2.5% | **NONE** — rate not in system |
| 439 | TDS on interest | **NONE** |
| 440 | advance tax instalment entry | **NONE** |
| 441 | income tax provision entry Nepal | **NONE** |
| 442 | PAN registered vs unregistered VAT | **NONE** |
| 443 | simplified VAT scheme Nepal | **NONE** |
| 444 | excise on alcohol entry | **NONE** |
| 445 | customs duty import VAT input | **NONE** |
| 446 | reverse charge on import services | **NONE** |
| 447 | SSF contribution ceiling 2026 | **STATIC** — hardcoded may be wrong |
| 448 | SSF on allowance and overtime | **NONE** |
| 449 | gratuity act minimum Nepal calculation | **PARTIAL** — generic gratuity |
| 450 | labour act festival allowance accounting | **NONE** |
| 451 | IRD transfer pricing documentation | **NONE** |
| 452 | tax invoice requirements Nepal | **NONE** |
| 453 | credit note VAT adjustment IRD | **NONE** |
| 454 | debit note purchase VAT | **NONE** |
| 455 | consolidated VAT return branch | **NONE** |
| 456 | blacklist supplier VAT input denial | **NONE** |
| 457 | capital gain tax property Nepal entry | **NONE** |
| 458 | real estate transaction fee accounting | **NONE** |
| 459 | WHT on dividend Nepal | **NONE** |
| 460 | royalty TDS Nepal | **NONE** |
| 461 | permanent establishment tax | **NONE** |
| 462 | Nepal company act 2063 reserve requirements | **NONE** |
| 463 | audit threshold Nepal private company | **NONE** |
| 464 | NFRS applicability SME | **NONE** |
| 465 | cash basis election small taxpayer | **NONE** |
| 466 | bill of supply non-VAT | **NONE** |
| 467 | mixed supply composite supply VAT | **NONE** |
| 468 | discount before vs after VAT | **NONE** |
| 469 | bad debt VAT adjustment IRD | **NONE** |
| 470 | stock transfer branch VAT | **NONE** |
| 471 | export documentation VAT zero | **NONE** |
| 472 | DEPB or incentive export Nepal | **NONE** |
| 473 | OCR invoice IRD compliance | **NONE** |
| 474 | e-invoicing Nepal timeline | **WIKI** — stale |
| 475 | tax audit adjustment entry | **NONE** |
| 476 | penalty interest IRD entry | **NONE** |
| 477 | social security inclusion casual worker | **NONE** |
| 478 | contract worker SSF applicability | **NONE** |
| 479 | foreign employee SSF | **NONE** |
| 480 | double tax treaty withholding Nepal India | **NONE** |

---

### Category 8 — Scenario, Judgment & Conversation (Questions 481–520)

| # | Question | Predicted Wrong Answer |
|---|----------|---------------------|
| 481 | customer will probably not pay should I provision | **GENERIC** — no quantitative judgment |
| 482 | immaterial expense capitalize or expense | **WIKI** |
| 483 | capital vs revenue expenditure this repair | **NONE** |
| 484 | which depreciation method for vehicle Nepal | **NONE** |
| 485 | can I recognize revenue before delivery | **WIKI/PARTIAL** |
| 486 | bill received 31 Ashad unpaid fiscal year | **NONE** — Nepal fiscal context |
| 487 | opening TB imbalance 500 how fix | **NONE** |
| 488 | trial balance does not match what to check | **GENERIC** |
| 489 | bank balance 5000 books 4800 why | **PARTIAL** — no reconciliation steps |
| 490 | customer paid extra 200 what entry | **NONE** |
| 491 | supplier undercharged do I accrue | **NONE** |
| 492 | related party loan zero interest tax implication | **NONE** |
| 493 | personal expense through company books | **PARTIAL** — drawings maybe |
| 494 | cash sale not recorded how correct | **NONE** |
| 495 | duplicate payment posted reverse how | **NONE** |
| 496 | wrong party posted how fix | **NONE** |
| 497 | transposition error 54 vs 45 detect | **NONE** |
| 498 | stock undervalued in books adjust | **NONE** |
| 499 | obsolete inventory write down | **NONE** |
| 500 | customer insolvency proceeding bad debt | **PARTIAL** |
| 501 | merge two customer ledgers | **NONE** |
| 502 | foreign currency invoice NPR booking | **NONE** |
| 503 | year end cut off sales shipped not invoiced | **NONE** |
| 504 | consignment goods at customer warehouse | **NONE** |
| 505 | goods sent on approval | **NONE** |
| 506 | bill and hold arrangement | **NONE** |
| 507 | principal vs agent revenue gross net | **NONE** |
| 508 | marketplace seller accounting | **NONE** |
| 509 | gift card sold accounting | **NONE** |
| 510 | loyalty points provision | **NONE** |
| 511 | warranty estimated cost provision | **NONE** |
| 512 | lawsuit pending provision recognize? | **WIKI** |
| 513 | insurance premium prepaid 6 months | **WRONG-ENTRY** — may be expense not prepaid |
| 514 | annual maintenance contract prepaid | **WRONG-ENTRY** |
| 515 | revenue earned but collection doubtful | **PARTIAL** |
| 516 | related party sale at non-market price | **NONE** |
| 517 | reclassify expense to asset error year ago | **NONE** |
| 518 | how to close books at year end Nepal | **GENERIC** |
| 519 | what is my profit this month | **NONE** — not ledger-aware |
| 520 | kitna debtor baki cha | **NONE** — cannot read live ledger |

---

## Part 4 — Why Current Approach Cannot Reach Your Goal

You said you do **not** want: *"tracks words or phrases or sentence and matches and then answers."*

That is **exactly** what e-KHATA does today:

```
User text
  → regex gates (shouldTryWorkParse, FACTUAL_QUESTION, QUESTION_PATTERNS)
  → keyword lexicon scoring (ACCOUNTING_LEXICON, KNOWLEDGE, TOPIC_SIGNALS)
  → ordered regex intent patterns (CA_INTENT_PATTERNS)
  → template journal builder (caEntryTemplates.buildLines)
  → OR Wikipedia opensearch
  → OR canned reply pool (pick random)
  → OR LLM with frozen system prompt (no learning, no tools)
```

This is **retrieval + pattern matching**, not **comprehension + reasoning**. The LLM layer adds fluency but does not replace the router — and when Ollama is online, it bypasses the only structured accounting brains entirely.

---

## Part 5 — Recommended Training & Architecture Approach

### Your Target Capability

> An intelligence that **understands** Nepali, English, and Roman Nepali accounting language, **reasons** about double-entry and Nepal compliance, **generates** correct journal entries from meaning — not from phrase templates.

This requires a **fundamental redesign**, not more regex rows.

---

### Phase 1 — Fix Routing Before Training (1–2 weeks engineering)

**Do not train a model into a broken router — it will still send "sampati" to Wikipedia.**

1. **Domain classifier first (mandatory gate)**
   - Small fine-tuned classifier OR LLM structured output: `{ domain: "accounting_qa" | "journal_entry" | "general_chat" | "external_fact" }`
   - Accounting terms (`sampatti`, `dayitwo`, `udhaar`, `lekha`) → **never Wikipedia**
   - Only `external_fact` may search web — and use accounting-aware search queries

2. **Unify pipelines**
   - One router for sync/async
   - Framework brain + accounting brain always run before web search

3. **Ledger-aware context**
   - Pass chart of accounts, recent vouchers, balances into every LLM call
   - Enable: "what is my debtor balance?" — requires data, not training

4. **Structured entry output**
   - LLM returns JSON schema:
   ```json
   {
     "intent": "credit_sale",
     "amount": 5000,
     "party": "Ram",
     "lines": [{"account":"Sundry Debtors","dr":5000},{"account":"Sales","cr":5000}],
     "confidence": 0.92,
     "clarifications": []
   }
   ```
   - Rules validate balance — LLM proposes, validator confirms

---

### Phase 2 — Knowledge Foundation (Not Pattern Matching)

Instead of `if text.includes("sampatti")`, build **structured knowledge** the model retrieves and **reasons over**:

| Layer | Content | Format |
|-------|---------|--------|
| **K1 — Concept graph** | Asset, liability, equity, recognition, measurement | Nodes + edges + IFRS Para refs + Nepali aliases |
| **K2 — Entry ontology** | 150+ transaction types with Dr/Cr rules, conditions, exceptions | YAML/JSON with semantic fields, not regex |
| **K3 — Nepal compliance** | VAT, TDS rates, SSF, IRD forms, worked examples | Versioned, dated knowledge base |
| **K4 — Chart of accounts** | User's actual accounts | Live from ERP store |
| **K5 — Worked examples** | 2000+ NL → journal pairs | Training + RAG, not trigger phrases |

**Retrieval should be semantic (embeddings on concepts), not keyword overlap** (`matchCount >= keywords.length * 0.6`).

Use **GraphRAG** or **typed retrieval**:
- Query: "sampati k ho" → retrieve `Concept:Asset` node + Nepali alias `sampatti` + IFRS Para 4.3
- Model **composes answer** from retrieved facts — not Wikipedia

---

### Phase 3 — Model Training Strategy (Knowledge-Based Generation)

#### 3A. Do NOT do this
- ❌ Adding more regex to `CA_INTENT_PATTERNS`
- ❌ Expanding `ACCOUNTING_LEXICON` with 500 more keywords
- ❌ More canned replies in `conversationalBrain.ts`
- ❌ Bigger static `KNOWLEDGE` object with keyword matching
- ❌ Prompt-only changes to qwen2.5-coder without fine-tuning

#### 3B. Do this — three-model architecture

**Model 1: Domain Router (small, fast)**
- Fine-tune `Llama-3.2-3B` or similar on 5K labeled queries
- Labels: entry / accounting_qa / compliance / chitchat / external
- Input: user message + short history
- Output: structured JSON route

**Model 2: Accounting Reasoner (main brain)**
- Base: **Qwen2.5-14B-Instruct** or **Llama-3.1-8B-Instruct** (not coder variant)
- Fine-tune with **LoRA/QLoRA** on:
  - 3,000 journal entry generations (Nepali + English + mixed)
  - 2,000 accounting Q&A with IFRS/NAS citations
  - 1,000 classification scenarios
  - 500 Nepal tax worked examples
- Training format (instruction tuning):
  ```
  ### Instruction: Parse transaction to balanced journal entry.
  ### Input: ram le 500 ko saman kinyo udhaar ma
  ### Output: { "party": "Ram", "intent": "credit_purchase", "lines": [...], "reasoning": "..." }
  ```

**Model 3: Entry Validator (rules, not ML)**
- Hard constraints: debits = credits, account exists, VAT math, SSF percentages
- Rejects model output that violates rules → ask clarification

#### 3C. Training data sources (generate, don't hand-write regex)

1. **Synthetic data generation**
   - Use CA rules engine to generate 10K valid entries
   - Paraphrase each with LLM into 5 Nepali + 5 English + 3 mixed variants
   - Include dialect spellings: udhaar/udhar/udharo, tiryo/tireko/diyo

2. **Real user logs (after privacy scrubbing)**
   - Every confirmed entry = gold label
   - Every cancelled entry = negative example
   - Fine-tune monthly on new data (**RLHF-lite**: prefer confirmed over rejected)

3. **CA curriculum**
   - ICAN/NFRS modules, IFRS Conceptual Framework paragraphs
   - Convert to Q&A with Para citations — train reasoning, not memorization

4. **Nepali accounting corpus**
   - Nepal company act excerpts, IRD circulars (versioned)
   - Bilingual term dictionary as **metadata**, not lookup triggers

#### 3D. Inference pipeline (generation-based)

```
User message
    ↓
Domain Router → accounting?
    ↓
Retrieve: concept graph + similar examples + user COA + compliance rules
    ↓
Accounting Reasoner generates:
  - Natural language explanation (user's language)
  - Structured journal JSON
    ↓
Validator checks balance + accounts + tax math
    ↓
If fail → targeted clarification question (generated, not canned)
If pass → show confirmation card
    ↓
User confirms → store as training feedback
```

**Key difference:** The model **generates** `"Sampatti (asset) bhane present economic resource..."` from retrieved IFRS Para 4.3 — it does not match `"sampatti"` to a 2-line static def or Wikipedia title.

---

### Phase 4 — Multilingual Strategy

1. **Single multilingual model** (Qwen2.5 handles Nepali reasonably) — do not maintain separate Nepali/English brains
2. **Normalize input** with transliteration as preprocessing only — not as the decision engine
3. **Train explicitly on:**
   - Devanagari transactions
   - Roman Nepali (`le`, `lai`, `ko`, `ma` postpositions)
   - Code-mixed (`customer lai 5000 udhaar ma becheko`)
4. **Evaluate** with held-out set of 500 questions from Part 3 — target >90% on entries, >85% on Q&A

---

### Phase 5 — Replace Wikipedia with Accounting-Aware Search

If external facts needed:
- Search **IRD site**, **Nepal Rastra Bank**, **ICAN**, not English Wikipedia
- Prefix queries: `"Nepal accounting"` + user term
- Never search for bare terms: `sampati`, `capital`, `goodwill`

---

### Phase 6 — Evaluation Harness (Use Part 3 as Benchmark)

Turn the 520 questions in this document into **`scripts/eval-ekhata-benchmark.ts`**:
- Run nightly against staging model
- Score: route accuracy, entry balance, account correctness, language match
- Block deploy if score drops

---

### Recommended Model Stack (Practical for Nepal SME ERP)

| Component | Recommendation |
|-----------|----------------|
| Router | Fine-tuned 3B classifier |
| Reasoner | Qwen2.5-14B-Instruct + LoRA on your entry/Q&A data |
| Embeddings | `multilingual-e5-large` or `nomic-embed-text` |
| Vector store | Chroma/Pgvector with **concept metadata**, not raw chunks |
| Validator | TypeScript rules engine (keep `validateJournalBalance`) |
| Runtime | Ollama local OR vLLM server — drop coder model |
| Training | Axolotl/LLaMA-Factory for LoRA fine-tune |

---

### Minimum Viable "Intelligent" Upgrade Path

If full fine-tuning is not immediate:

1. **Week 1:** Domain gate — block Wikipedia for accounting terms (fixes sampati bug immediately)
2. **Week 2:** Unified router + structured JSON output from LLM + validator
3. **Week 3:** Expand RAG to concept graph (500 concepts, not 25 keywords)
4. **Week 4–8:** Collect confirmed entries → 1st LoRA fine-tune on Qwen2.5-7B-Instruct
5. **Ongoing:** RL from confirm/cancel buttons

Even step 1 fixes your screenshot failure. Steps 2–5 move you from **uploaded useless answers** to **generated knowledgeable answers**.

---

## Part 6 — Immediate Fix for "sampati" Bug (Without Full Retraining)

Until rearchitecture:

```typescript
// Before shouldAutonomousWebSearch():
const ACCOUNTING_DOMAIN = /\b(sampati|sampatti|asset|liability|dayitwo|rin|equity|puni|aamdani|kharcha|debit|credit|vat|tds|ssf|gratuity|depreciation|udhaar|receivable|payable|ledger|journal|hisab|lekha|khata|trial\s*balance|balance\s*sheet|provision|accrual|goodwill|inventory|stock|cogs|turnover|reconciliation|amortization|impairment|ifrs|nas|nfrs)\b|[\u0900-\u097F]/i;

if (ACCOUNTING_DOMAIN.test(text)) {
  // Route to understandAccountingLanguage() or conceptualFrameworkBrain — NEVER Wikipedia
}
```

This is still regex — but a **guard rail**, not your intelligence. The real solution remains Phase 2–3 above.

---

## Appendix — Files Reviewed

| File | Role |
|------|------|
| `src/lib/ekhata/processMessage.ts` | Main async router |
| `src/lib/ekhata/autonomousBrain.ts` | Wikipedia fallback |
| `src/lib/ekhata/parseKhata.ts` | Regex intent parser |
| `src/lib/ekhata/accountingLanguageBrain.ts` | 25-term lexicon Q&A |
| `src/lib/ekhata/smartWorkBrain.ts` | Work verb gate |
| `src/lib/ekhata/caEntryTemplates.ts` | 28 journal templates |
| `src/lib/ekhata/ekhataWebSearch.ts` | Wikipedia only |
| `src/lib/ekhata/nepaliBrain.ts` | Static KNOWLEDGE keyword match |
| `erp_bot/src/khata/khata_chat.py` | Ollama hybrid path |
| `erp_bot/src/khata/system_prompt.py` | LLM system prompt |

---

*End of document — 520 failure questions catalogued with predicted wrong-answer types.*
