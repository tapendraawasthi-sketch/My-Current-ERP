#!/usr/bin/env python3
"""Build complete nepali-grammar-reference.txt (33 sections) for e-Khata Ollama NLU."""

from __future__ import annotations

import json
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "data" / "ekhata" / "source" / "nepali-grammar-reference.txt"
INDEX = REPO / "data" / "ekhata" / "nepali-grammar-index.json"

DELIM = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"


def hdr(n: int, title_ne: str, title_en: str) -> str:
    return f"\n{DELIM}\nखण्ड {n}: {title_ne}\nSECTION {n}: {title_en}\n\n"


def section_1() -> str:
    return hdr(1, "देवनागरी लिपि र वर्णमाला", "Devanagari Script and Alphabet") + """OVERVIEW:
Nepali is written in Devanagari script (देवनागरी). AI must accept both Devanagari input
and Roman transliteration. Vowel signs (matra) attach to consonants; halant (्) removes
inherent 'a' sound.

SWAR (VOWELS) — स्वर:
अ=a  आ=aa  इ=i  ई=ee  उ=u  ऊ=oo  ऋ=ri  ए=e  ऐ=ai  ओ=o  औ=au

VYANJAN (CONSONANTS) — व्यञ्जन (sample):
क=ka  ख=kha  ग=ga  घ=gha  च=cha  छ=chha  ज=ja  ट=ta  त=ta  द=da  न=na
प=pa  फ=pha  ब=ba  भ=bha  म=ma  य=ya  र=ra  ल=la  व=wa/va  श=sha  स=sa  ह=ha

MATRA (VOWEL SIGNS):
ा=aa  ि=i  ी=ee  ु=u  ू=oo  े=e  ै=ai  ो=o  ौ=au  ृ=ri

DEVANAGARI DIGITS → Arabic:
०=0  १=1  २=2  ३=3  ४=4  ५=5  ६=6  ७=7  ८=8  ९=9

EXAMPLES (Devanagari → Roman):
राम le 500 diyo     → Ram le 500 diyo
उधार ma becheko    → udhaar ma becheko
आज ५००० ko bikri   → aaja 5000 ko bikri
श्याम lai 200 tiryo → Shyam lai 200 tiryo

ROMANIZATION RULES FOR AI:
→ ch/chh/chha all map to छ-family sounds; accept cha/chha interchangeably
→ v/w interchangeable: vayo/wayo, vannu/wannu
→ double vowels optional: aa/a, ee/i, oo/u
→ halant words may omit schwa: "Ramle" = "Ram le", "malai" = "ma lai"
"""


def section_2() -> str:
    return hdr(2, "सर्वनाम", "Pronouns — All Levels of Formality") + """FORMAL (आदरार्थी):
म/tapai (you formal) → tapai, tapain, tapainle, tapainlai
हामी (we) → hami, hamile, hamilai
उहाँ (he/she formal) → uha, uhale, uhalai
यो/त्यो (this/that) → yo, tyo

INFORMAL (अनौपचारिक):
म/timi (you informal) → timi, timile, timilai
त (very informal) → ta, tale, talai
म (I) → ma, maile, malai
उ (he/she informal) → u, ule, ulai
हामी → hami (same as formal we)

POSSESSIVE (सम्बन्धवाचक):
मेरो/merro → mero (my)
तिम्रो → timro (your informal)
तपाईंको/tapainko → tapainko (your formal)
हाम्रो → hamro (our)
उसको/उनको → usko/unko (his/her)

EXAMPLES:
Standard:    मैले रामलाई ५०० दिएँ     → maile Ram lai 500 diye
Roman:       maile ram lai 500 diye
Halkhabar:   ma le ram lai 500 diye / ma 500 diye ram lai
Formal:      तपाईंले कति तिर्नुभयो?    → tapainle kati tirnubhayo?
"""


def section_3() -> str:
    return hdr(3, "विभक्ति / कारक", "Postpositions / Case Markers") + """KEY POSTPOSITIONS (often written joined in chat):

ले (le) — ERGATIVE/AGENT (who did the action)
  Ram le 500 diyo = Ram gave 500
  Shyam le saman kinyo = Shyam bought goods
  Halkhabar: Ram 500 diyo (le dropped)

लाई (lai) — DATIVE/RECIPIENT (to whom)
  Ram lai 500 diyo = gave 500 to Ram
  Gita lai udhaar becheko = sold on credit to Gita
  Variants: lai, la, lay, ly

को (ko) — GENITIVE (of/belonging to)
  Ram ko udhaar = Ram's credit balance
  aaja ko bikri = today's sale
  Variants: ko, ka, ki, ke, gko

मा (ma) — LOCATIVE (in/at/on)
  pasal ma = in the shop
  nagad ma = in cash
  bank ma = in the bank

बाट (bata) — ABLATIVE (from)
  supplier bata saman aayo = goods came from supplier
  Ram bata 500 aayo = received 500 from Ram

सँग (sanga) — COMITATIVE (with)
  sathi sanga = with friend

का लागि (ka lagi / lagi) — PURPOSE (for)
  kharcha ko lagi = for expense

TABLE:
Postposition | Function        | Example              | Halkhabar (dropped)
le           | agent/doer      | Ram le kinyo         | Ram kinyo
lai          | recipient       | Ram lai diyo         | Ram lai diyo / Ram 500
ko           | possessive      | Ram ko udhaar        | Ram ko udhaar
ma           | location/mode   | nagad ma             | nagad ma
bata         | source          | Shyam bata aayo      | Shyam bata aayo
"""


def section_4() -> str:
    return hdr(4, "क्रिया", "Verbs — Tense, Aspect, Honorific Conjugation") + """COMMON VERB ROOTS (धातु):
garnu=to do    kinnu=to buy    bechnu=to sell    tirnu=to pay
dinu=to give   linu=to take    kharcha garnu=to spend   paunu=to get/receive
hunu=to be     jannu=to go     aunu=to come

PRESENT HABITUAL (ma/timi/tapai):
ma garchu / garchu     I do
timi garchau           you do (informal)
tapai garnuhuncha      you do (formal)
u garcha               he/she does

PAST (simple completed):
maile gare / garyo / gareko     I did
timile garyau                   you did
Ram le garyo / gyo / vayo       he did
Variants: garyo → gyo, gayo, gya, vayo, bhayo

NEGATIVE:
chha/cha/xa (is/exists) → xaina/chhaina/chaina (is not)
garchu → gardina (I don't do)
garyo → garyena (didn't do)

HONORIFIC (formal):
garnuhos / garnus / garnuhuncha — please do / does (respectful)
khanuhos — please eat (example pattern for -nu verbs)

KEY FINANCIAL VERBS (past forms AI must recognize):
kinnu → kinyo/kineko/kiniyo/kine     (bought)
bechnu → bechyo/becheko/beche/bikyo  (sold)
tirnu → tiryo/tireko/tire/jamayo     (paid/received payment)
dinu → diyo/diye/diyeko/diya         (gave)
linu → liyo/liyo/lineko              (took/received)
kharcha garnu → kharcha garyo        (spent)

EXAMPLES:
Standard:  रामले ५०० तिर्यो          → Ram le 500 tiryo
Roman:     ram le 500 tiryo / ram 500 tiryo
Halkhabar: ram 500 tiryo ta / 500 tiryo ram le
"""


def section_5() -> str:
    return hdr(5, "काल र समय अभिव्यक्ति", "Time Expressions") + """COMMON TIME WORDS:
आज/aaja/aja/ajha/ajj     = today
हिजो/hijo/kal/kaliko     = yesterday
भोलि/bholi/parsi         = tomorrow (tomorrow/day after — context)
अहिले/ahile/ahilei       = now
बिहान/bihana             = morning
दिउँसो/diuso             = afternoon
बेलुका/beluka/saaj       = evening
रात/raat                 = night

RELATIVE:
agadi = before    pachhi = after    ahile samma = until now
yahi mahina = this month    gata hapta = last week

EXAMPLES IN TRANSACTIONS:
aaja ko bikri 5000        = today's sale of 5000
hijo Ram le tiryo         = Ram paid yesterday
bholi tirna parcha        = must pay tomorrow
ahile 500 diyo            = just gave 500 now
"""


def section_6() -> str:
    return hdr(6, "प्रश्नवाचक शब्द", "Question Words") + """QUESTION WORDS:
के/ke/k/k cha     = what
को/ko/kun         = who/which
कहाँ/kaha/kahan   = where
कहिले/kahile      = when
कati/kati/kitna    = how much/how many (kitna = Hindi mix)
किन/kina/kyun     = why
कसरी/kasari/kaise = how
के हो/ke ho       = what is it

FINANCIAL QUESTIONS:
Ram ko udhaar kati cha?     = How much is Ram's credit?
kati tiryo?                 = How much was paid?
ke kinyo?                   = What was bought?
kaha bata aayo?             = Where did it come from?

HALKHABAR:
k xa? / k cha? / ke cha?    = what's up / what is it
kati ho? / kitna?           = how much?
thaha cha? / pata cha?      = do you know?
"""


def section_7() -> str:
    return hdr(7, "संज्ञा र लिङ्ग-वचन", "Nouns, Gender, and Number") + """GENDER:
Nepali has natural gender for animate nouns; many business nouns are neutral.
masculine: chora (son), dai (elder brother)
feminine: chori (daughter), didi (elder sister)
neutral/common: pasal, saman, khata, paisa, customer

PLURAL (वचन):
Add हरू/haru for plural: pasal → pasalharu, customer → customerharu
Also: -haru, -ru, -s (English plural in code-switch)

NUMBER MARKERS:
ek saman = one item    dui ota = two pieces    tin jana = three people

EXAMPLES:
pasal = shop          pasalharu = shops
saman/mal/goods = goods (mass noun, no plural needed usually)
grahak/customer → grahakharu
"""


def section_8() -> str:
    return hdr(8, "विशेषण", "Adjectives") + """COMMON ADJECTIVES:
ramro = good          naramro = bad
thulo = big/large     sano = small
dherai = many/much    thorai/thore = few/little
sasto = cheap         mahango = expensive
nayo = new            purano = old
thik = okay/fine      sanchai = healthy/fine

COMPARATIVE/SUPERLATIVE (colloquial):
... bhanda ramro = better than
sabai bhanda ramro = best

EXAMPLES:
ramro customer        = good customer
dherai kharcha        = a lot of expense
thulo amount          = large amount (code-switch)
500 sano paise chaina = 500 is not small money (colloquial)
"""


def section_9() -> str:
    return hdr(9, "क्रियाविशेषण", "Adverbs") + """PLACE:
yaha/yeta = here      tyaha/tyata = there      jaha = where

MANNER:
chhito/chito = quickly    bistarai = slowly    ekdam/dammi = very/really
ramrari = properly        thik/thik thik = okay

FREQUENCY:
sadhai = always     kahile pani = sometimes    dailai = daily
ek choti = once     dui choti = twice

EXAMPLES:
chhito tirnu paryo         = must pay quickly
ekdam dherai kharcha bhayo = really a lot of expense
tyaha kinna gaye           = went there to buy
"""


def section_10() -> str:
    return hdr(10, "समुच्चयबोधक", "Conjunctions") + """COMMON CONJUNCTIONS:
र/ra/ani = and
तर/tara/tar = but
किनभने/kinabhane/kyunki = because
यदि/yadi/bhane = if
भने/bhane/taba = then
वा/wa = or
तर pani = but also
ra pani = and also

EXAMPLES:
Ram ra Shyam le tiryo          = Ram and Shyam paid
udhaar ma becheko tar nagad chaina = sold on credit but no cash
yadi Ram le tiryo bhane thik   = if Ram paid then okay
"""


def section_11() -> str:
    return hdr(11, "वाक्य संरचना", "Sentence Structure (SOV)") + """STANDARD ORDER: Subject — Object — Verb (SOV)
Example: मैले रामलाई पाँच सय दिएँ
         maile Ram lai 500 diye
         (I) (to Ram) (500 gave)

AGENT-OBJECT-VERB with postpositions:
[Subject+le] [Object+lai] [Amount] [Verb]
Ram le Shyam lai 500 diyo

FLEXIBLE ORDER IN CHAT (critical for NLU):
WhatsApp/chat often drops postpositions and reorders:
500 diyo Ram lai          = gave 500 to Ram
Ram 500 tiryo             = Ram paid 500
tiryo 500 Ram le          = Ram paid 500
kinyo saman 2000 ko       = bought goods worth 2000

AI RULE: Do NOT require strict SOV. Identify subject/amount/verb by vocabulary + context.
Amount + financial verb = strong transaction signal regardless of position.
"""


def section_12() -> str:
    return hdr(12, "संख्या र मात्रा", "Numbers and Quantities") + """CARDINALS:
1 ek/one    2 dui/do/two    3 tin/teen    4 char/chaar    5 panch/paanch
6 chha/cha  7 saat/sat      8 aath/aat    9 nau/no        10 das/dus

TENS: bis=20, tis=30, chaalis=40, pachaas=50, saath=60, sattar=70, assi=80, nabbe=90

LARGE NUMBERS:
saya/sau = 100    hajar/hazar = 1,000    lakh/lac = 100,000    crore = 10,000,000

FRACTIONS/COLLOQUIAL:
dedh = 1.5    dui dedh = 2.5    sade = plus half (sade panch = 5.5)
arai/ara = quarter

AMOUNT EXPRESSIONS:
500 rupiya / Rs 500 / 500 rupees / 500 paisa (paisa = money, not 1 paisa coin)
5 hajar / 5K / 5000
2 lakh / dui lakh

EXAMPLES:
dui hajar ko saman kinyo     = bought goods worth 2000
saya rupiya tiryo            = paid 100 rupees
5 lakh ko udhaar             = 5 lakh credit
"""


def section_13() -> str:
    return hdr(13, "आदरणीय भाषा स्तर", "Honorific Language Levels") + """THREE LEVELS:
1. FORMAL (tapai/uha): business with elders, clients, official contexts
2. INFORMAL (timi/u): peers, friends, younger people
3. VERY INFORMAL (ta): close friends, family younger members

HONORIFIC VERB FORMS:
Standard: khanchu (I eat)    Honorific: khanuhuncha
Standard: garchu (I do)      Honorific: garnuhuncha/garnuhos
Standard: tiryo (paid)       Honorific: tirnubhayo

BUSINESS CONTEXT:
Shopkeepers often use timi/ta with regular customers (Halkhabar)
Formal accounting messages may use tapai: "Tapainle kati tirnubhayo?"

EXAMPLES:
Formal:   कृपया भुक्तान गर्नुहोस्     → kripaya bhugtan garnuhos
Informal: paisa tir ta               → pay the money (casual)
Mixed:    payment garnus ta           = please make payment (semi-formal)
"""


def section_14() -> str:
    return hdr(14, "हलखबर", "Halkhabar / Colloquial Language") + """DEFINITION:
Halkhabar = casual spoken/chat Nepali (WhatsApp, Messenger, voice notes).
Characterized by: dropped postpositions, particles (ni, ta, hai, yaar), flexible word order.

FEATURES:
→ le/lai often dropped: "Ram 500 kinyo" not "Ram le 500 kinyo"
→ xa/chha/cha interchangeable: "thik xa", "thik cha", "thik chha"
→ Particles at end: "tiryo ni", "kinyo ta", "thik xa hai"
→ Short forms: "k xa" = ke cha, "garchu ni" = I will do
→ Repetition for emphasis: "dherai dherai", "thik thik"

EXAMPLES:
Standard:  रामले पाँच सय किनyo
Halkhabar: ram le 500 kinyo ta / ram 500 kinyo / 500 kinyo ram le
Standard:  के छ?
Halkhabar: k xa / k cha ta / k cha hai
Standard:  मलाई थाहा छैन
Halkhabar: thaha xaina / thaha chaina / pata xaina
"""


def section_15() -> str:
    return hdr(15, "रोमनाइज्ड नेपाली", "Romanized Nepali — Spelling Variants") + """VOWEL VARIANTS:
a/aa/ah: aaja/aja/ajha    ma/maa    ta/taa
i/ee/ii: timi/timmi       kina/keena
u/oo/ou: tirnu/tirno      chu/chhu

CONSONANT VARIANTS:
ch/chh/chha/x: chha/cha/xa/xha    chhaina/xaina/chaina
sh/s: shubha/subha    pasal/pasaal
v/w/b: vayo/bhayo/wayo/bayo    vannu/bannu

DOUBLING/OMISSION:
kinyo/kineko/kiniyo/kine    tiryo/tireko/tire/tiryoo
becheko/bechyo/beche/bikyo  garyo/gyo/gayo/vayo/bhayo

COMMON NORMALIZATIONS FOR AI:
chha → cha → xa → xha (all equivalent copula)
xaina → chhaina → chaina (all equivalent negation)
udhaar → udhar → udharo → udaar → udhhar
nagad → nakad → nagat
"""


def section_16() -> str:
    return hdr(16, "अंग्रेजी-नेपाली मिश्रण", "Nepali-English Code-Switching") + """PATTERN: English noun/verb + Nepali grammar markers

COMMON MIXES:
payment garyo / payment gareko     = made payment
payment received / payment aayo      = payment received
cash sale garyo                      = did cash sale
credit diye / credit sale            = gave credit / credit sale
busy xu / busy chu                   = I am busy
stock kinyo / inventory kineko       = bought stock
expense record garyo                 = recorded expense
balance kati cha?                    = what is the balance?
entry garne / entry gareko           = make/made entry

EXAMPLES:
Ram le 500 payment garyo             = Ram made payment of 500
aaja ko cash sale 5000 vayo          = today's cash sale was 5000
supplier lai payment gareko          = paid supplier
VAT tiryo IRD lai                    = paid VAT to IRD
"""


def section_17() -> str:
    return hdr(17, "हिन्दी-नेपाली मिश्रण", "Hindi-Nepali Mixing") + """COMMON HINDI WORDS IN NEPALI CHAT:
kitna/kati = how much        kiya/kiyo = did (Hindi past)
pata = know                  dukaan = shop (dukaan/pasal)
paisa = money                jama = deposit/credit entry
karna/karne = to do          aaya/aaye = came (Hindi form)
accha/thik = okay            bahut/dherai = a lot

EXAMPLES:
kitna paisa tiryo?           = how much money paid? (Hindi kitna)
pata xaina                   = don't know (Hindi pata)
Ram ne 500 diya              = Ram gave 500 (Hindi ne/diya pattern)
dukaan ma saman aayo         = goods came to shop
kiya tha? → ke thiyo?        = what was it? (mixed tense)
"""


def section_18() -> str:
    return hdr(18, "व्यापारिक / वित्तीय भाषा", "Business and Financial Language") + """CORE FINANCIAL VOCABULARY:
paisa/rupiya/rs/npr = money/rupees (paisa = rupees in speech, NOT 1 paisa coin)
udhaar/udharo/credit/karz = credit (sale on account / amount owed)
nagad/nakad/cash = cash
hisab/kitab/khata/ledger = accounts
kharcha/karcha/expense = expense
aamdani/income = income
talab/salary = salary
kharid/purchase/kineko = purchase
bikri/sale/becheko = sale
tirnu/jama/bhugtan/payment = payment
baaki/baki = remaining/outstanding
naafa/profit = profit
ghaata/loss/noksan = loss
rasid/bill/invoice = receipt/bill
jamma/total = total

TRANSACTION VERBS:
kinyo/kineko = bought (cash or credit purchase)
becheko/bechyo/bikyo = sold
udhaar diye/becheko = sold on credit / gave on credit
tiryo/jamayo/aayo = received payment
diyo/diye = gave (payment out or credit given)
liyo/lineko = took/received

CRITICAL DISTINCTIONS FOR AI:
udhaar deko/becheko = CREDIT SALE (customer owes you) — NOT bad debt
udhaar tiryo = PAYMENT RECEIVED from debtor
udhaar liyo = took on credit (credit purchase)
bad debt / nasakne / write off = separate concept (NOT udhaar alone)
"""


def section_19() -> str:
    return hdr(19, "सामान्य दैनिक जीवनका अभिव्यक्तिहरू", "Common Daily Life Expressions") + """GREETINGS:
namaste/namaskar/hello/hi = greeting
ke cha/k xa/kasto cha = how are you / what's up
sanchai cha/thik xa = I'm fine
dhanyabad/thanks = thank you

COMMON PHRASES:
thaha xaina/thaha chaina = I don't know
hunchha/hunxa/ho = it will be / yes
hudaina/hudaina = won't happen / no
garchu/garchu ni = I will do
parkhanus/parkha = please wait
malai thaha xaina = I don't know (to me not known)
sab thik cha = everything is fine
k garne = what to do (resignation)
"""


def section_20() -> str:
    return hdr(20, "यौगिक शब्द र मुहावरा", "Compound Words and Idioms") + """COMPOUND VERBS (verb + garnu):
phone garnu = to call        khana khane = to eat (lit. eat food)
saman lyaunu = to bring goods   hisab garnu = to do accounts
entry garnu = to make entry   check garnu = to check

IDIOMS (relevant to chat):
pet bharyo = ate fully (I'm full)
man lagyo = felt like / enjoyed
bhok lagyo = hungry
thakyo = tired
samjhana aayo = remembered

BUSINESS COMPOUNDS:
nagad bikri = cash sale
udhaar bikri = credit sale
hisaab kitab = accounts books
paisa jamma = total money
"""


def section_21() -> str:
    return hdr(21, "वाक्य परिवर्तनका ढाँचा", "Sentence Transformation Triples") + """PATTERN: Same meaning in Standard / Roman / Halkhabar

CREDIT SALE (udhaar bikri):
Standard:  रामलाई पाँच सय उधारमा बेचेको
Roman:     Ram lai 500 udhaar ma becheko
Halkhabar: ram lai 500 udhaar diye / 500 udhaar ma becheko ram lai

PAYMENT RECEIVED (tiryo/jama):
Standard:  रामले पाँच सय तिर्यो
Roman:     Ram le 500 tiryo
Halkhabar: ram 500 tiryo / 500 tiryo ram bata / ram bata 500 aayo

CASH PURCHASE:
Standard:  पाँच सयको सामान किनेको
Roman:     500 ko saman kineko
Halkhabar: 500 ko saman kinyo / saman kinyo 500 ko

PAYMENT OUT:
Standard:  रामलाई पाँच सय तिरे
Roman:     Ram lai 500 tire / payment gareko Ram lai
Halkhabar: ram lai 500 diyo / 500 payment garyo

EXPENSE:
Standard:  बिजुली खर्च पाँच सय
Roman:     bijuli kharcha 500
Halkhabar: 500 kharcha bijuli ko / bijuli ko 500 kharcha garyo

SALARY:
Standard:  तलब पाँच हजार दिए
Roman:     talab 5000 diye
Halkhabar: 5000 talab diyo / talab diyo 5000
"""


def section_22() -> str:
    return hdr(22, "टाइपिङ त्रुटि", "Typing Mistakes and Spelling Variations") + """COMMON TYPOS IN ROMAN NEPALI:
Missing letters: tiryo→tiro, kinyo→kino, udhaar→udar/udhr
Doubled/wrong vowels: garyo→garyoo, diye→diyee
Phonetic: sh→s (saman/saman), ch→x (xito/chito)
Keyboard proximity: paisa→pais, rupiya→rupya
Autocorrect: sale→same, cash→case

PHONETIC VARIANTS (all valid):
udhaar/udhar/udharo/udaar/udhhar/credit
nagad/nakad/nagat/cash/kesh
becheko/bechyo/beche/bikyo/bikri
kineko/kinyo/kine/kiniyo/kharid
tiryo/tire/tireko/tira/jamayo/aayo

AI RULE: Use fuzzy matching — if 80% similar to known financial verb + amount, treat as transaction.
"""


def section_23() -> str:
    return hdr(23, "व्यापारिक मुहावरा", "Business Idioms and Vocabulary") + """SHOP/BUSINESS:
pasal/dukaan/shop = shop
saman/mal/goods/stock/inventory = goods/stock
grahak/customer/client = customer
supplier/supplier bata = from supplier
hisab/rasi/rasid = account/receipt
naafa = profit    ghaata/noksan = loss
jamma/total = total    baaki/baki = remaining
nagad = cash    udhaar = on credit
chalan = delivery note    bill/invoice = bill

MONEY FLOW IDIOMS:
paisa aayo = money came (received)
paisa gayo = money went (spent/paid out)
paisa fasyo = money stuck (locked in receivable)
hisaab milnu = accounts to match/reconcile
udhaar badhyo = credit increased
udhaar ghatayo = credit decreased (payment received)
"""


def section_24() -> str:
    return hdr(24, "व्याकरणिक अस्पष्टता", "Grammatical Ambiguity and Context") + """AMBIGUOUS VERBS — resolve by context:

diyo/diye (gave):
→ Ram le Shyam lai 500 diyo = Ram gave 500 to Shyam (payment OUT or credit given)
→ 500 diyo = gave 500 (direction needs party name)

liyo/lineko (took/received):
→ Ram le 500 liyo = Ram took/received 500 (payment IN?)
→ Shyam bata 500 liyo = received 500 from Shyam

pathayo/pathyo (sent):
→ Usually payment out or goods sent

500 paisa AMBIGUITY:
"500 paisa" = Rs 500 (NOT 500 paisa coins) in Nepal business speech
"500 ko saman" = goods worth 500
"500 tiryo" = paid 500 (need who/from whom from context)

RESOLUTION RULES FOR AI:
1. Party name + amount + verb → extract party, amount, verb
2. udhaar + becheko/diye = credit sale
3. udhaar + tiryo = payment received
4. kinyo/kineko without udhaar = likely cash purchase
5. kharcha/expense keyword → expense intent
6. talab/salary keyword → salary intent
"""


def section_25() -> str:
    return hdr(25, "क्षेत्रीय भाषिक भिन्नता", "Regional Dialects") + """EASTERN NEPAL:
More Hindi influence: dukaan, jama, kitna
"ge" suffix variants in some areas

WESTERN NEPAL (Gandaki/Lumbini):
"ho" instead of "cha": ramro ho = ramro cha
Local vocabulary for market items

KATHMANDU VALLEY:
Standard basis for this document; most Halkhabar norms
Heavy English code-switch in business

TERAI/MADHESH:
Strong Hindi mixing: kiya, pata, dukaan, accha
"lagta hai" type phrases mixed

AI RULE: Accept all regional variants; normalize to standard lemma before intent classification.
Do not reject Hindi-mixed input as invalid Nepali.
"""


def section_26() -> str:
    rules = hdr(26, "AI का लागि विशेष NLU नियमहरू", "Special NLU Rules for AI") + """NLU RULES FOR e-Khata / Ollama INTERPRETATION:

RULE 1 — COPULA EQUIVALENCE:
chha = cha = xa = xha = chhaa → all mean "is/exists"
xaina = chhaina = chaina = xain = chhain → all mean "is not"

RULE 2 — POSTPOSITION OPTIONAL:
"Ram le 500 kinyo" = "Ram 500 kinyo" = "500 kinyo Ram le"
Do not fail parse if le/lai/ko missing; use word proximity + verb

RULE 3 — WORD ORDER FLEXIBLE:
SOV is standard but chat uses: amount-first, verb-first, subject-last
Pattern: [Party]? [Amount] [FinancialVerb] [Context words]?

RULE 4 — PAISA = RUPEES:
"500 paisa" in business chat = Rs 500, NOT 0.05 rupees
"5 hajar", "2 lakh" = standard amount expressions

RULE 5 — UDHAAR SEMANTICS:
udhaar deko/becheko/diye = credit SALE (receivable created)
udhaar tiryo/jamayo = payment RECEIVED (receivable reduced)
udhaar liyo/kinyo = credit PURCHASE (payable created)
udhaar alone ≠ bad debt (needs "nasakne/write off/bad debt" keyword)

RULE 6 — AGENT vs RECIPIENT:
le = agent (doer): "Ram le tiryo" = Ram paid (Ram is payer)
lai = recipient: "Ram lai 500 diyo" = gave 500 to Ram
bata = source: "Ram bata 500 aayo" = 500 came from Ram (Ram paid you)

RULE 7 — FINANCIAL VERB → INTENT:
kinyo/kineko/kharid + amount → purchase
becheko/bechyo/bikyo/bikri + amount → sale
udhaar + becheko/diye → credit sale
tiryo/jamayo/aayo/milyo + amount + party → payment received
diyo/diye/payment garyo + party → payment out
kharcha/expense + amount → expense
talab/salary + amount → salary

RULE 8 — CODE-SWITCH ACCEPTANCE:
English verbs/nouns with Nepali markers are valid:
"payment garyo", "cash sale", "expense record garyo", "balance kati"

RULE 9 — HINDI MIX ACCEPTANCE:
kitna, pata, kiya, dukaan, jama — treat as Nepali chat input

RULE 10 — NORMALIZE BEFORE PARSE:
Lowercase → fold spelling aliases → transliterate Devanagari → extract numbers
Keep original for display; use normalized form for intent matching

RULE 11 — AMOUNT EXTRACTION:
Accept: 500, 5000, 5 hajar, saya, 2 lakh, Rs 500, रु ५००, ५००
Word numbers: ek=1, dui=2, ... saya=100, hajar=1000, lakh=100000

RULE 12 — PARTICLE STRIPPING:
Strip for parsing (keep meaning): ni, ta, hai, yaar, re, nai, bhane, hola
"500 tiryo ni ta" → core: "500 tiryo"

RULE 13 — CONTEXT OVER GRAMMAR:
Incomplete sentences valid: "500 tiryo", "Ram ko udhaar", "aaja ko bikri"
Use conversation history + ledger context for missing parties

RULE 14 — NEGATION:
"xaina/chaina" on financial verb ≠ transaction
"500 tiryo xaina" = did NOT pay 500

RULE 15 — MULTI-TRANSACTION:
"Ram le 500 tiryo ra Shyam le 300 tiryo" → two transactions; split on "ra/ani/and"
"""
    return rules


def section_27_examples() -> str:
    lines = [hdr(27, "५०० वटा वास्तविक-संसारका वाक्य", "500 Real-World Sentence Patterns")]
    lines.append("150 REAL-WORLD TRAINING EXAMPLES (categories A–M):\n")

    examples = [
        # [A] PURCHASE
        ("Ram le 500 ko saman kinyo", "purchase"),
        ("Ramle paach saya ko maal kine", "purchase"),
        ("500 ko stuff Ram le kinyo", "purchase"),
        ("Ram 500 ko saman kineko", "purchase"),
        ("Ramle kharid garyo 500 ko", "purchase"),
        ("Ram le dal chawal kinyo hajar ko", "purchase"),
        ("Ramle 2000 ko tarkari kine", "purchase"),
        ("Ram 2k ko groceries kine", "purchase"),
        ("hajar ko daal Ramle kinyo", "purchase"),
        ("Ram le 1000 rupaiyama daal kine", "purchase"),
        ("Ram bata 500 ko maal kinyo", "purchase"),
        ("Ramle 5 hajar ko maal aako xa", "purchase"),
        ("Ramle 500 ko kharid gareko xa", "purchase"),
        ("Ram ne 500 ka saman kharida kiya", "purchase"),
        ("Ram ko 500 ko kharid", "purchase"),
        # [B] CREDIT SALE / UDHAAR
        ("Ram lai udhaar ma 500 ko saman diye", "credit_sale"),
        ("Ram lai 500 udhaar diye", "credit_sale"),
        ("Ram udhaar 500 liyo", "credit_sale"),
        ("Ram lai credit ma 500 diyo", "credit_sale"),
        ("500 ko udhaar Ram lai diye", "credit_sale"),
        ("Ram lai 500 ko maal credit ma diye", "credit_sale"),
        ("Ram khasai 500 ko maal liyo", "credit_sale"),
        ("Ramko account ma 500 dhalne", "credit_sale"),
        ("Ram lai 500 bujhaaidiyou", "credit_sale"),
        ("Ram lai saman diye paisa pachhi tirncha vanera", "credit_sale"),
        ("Ram lai paisa nabujhai maal diye", "credit_sale"),
        ("Ram lai 500 ko maal udhaarma", "credit_sale"),
        ("Ram le 500 ko udhaar liye", "credit_sale"),
        ("Ram lai 500 credit diye", "credit_sale"),
        ("Ram lai 500 ko account ma rakhne", "credit_sale"),
        # [C] PAYMENT RECEIVED
        ("Ram le 500 tiryo", "payment_in"),
        ("Ramle 500 paisa diye", "payment_in"),
        ("Ram ko paisa aayo 500", "payment_in"),
        ("Ram le payment garyo 500", "payment_in"),
        ("Ram le 500 bujhayo", "payment_in"),
        ("Ram le paisa tireko xa", "payment_in"),
        ("Ram ko udhaar tiryo", "payment_in"),
        ("Ram le 500 settle garyo", "payment_in"),
        ("500 Ram le diye", "payment_in"),
        ("Ram le paisa pathaayo 500", "payment_in"),
        ("Ram bata 500 aayo", "payment_in"),
        ("Ram ko 500 paayo maile", "payment_in"),
        ("Ram le finally tiryo paisa", "payment_in"),
        ("Ram le 1k tiryo 500 baki xa", "payment_in"),
        ("Ram ko udhaar tiryo", "payment_in"),
        # [D] CASH SALE
        ("cash ma 500 ko chai bechein", "cash_sale"),
        ("500 ma chai becheko", "cash_sale"),
        ("500 ko tea sell garein", "cash_sale"),
        ("chai nakit ma bechein 500", "cash_sale"),
        ("500 ko chiiya cash ma bechyo", "cash_sale"),
        ("cash ma bechyo 500 ko saman", "cash_sale"),
        ("nagad 500 ma bechein", "cash_sale"),
        ("500 nakit liera chai diye", "cash_sale"),
        ("chai 500 ma bechyo nakit", "cash_sale"),
        ("500 chai nagi paisa liera", "cash_sale"),
        # [E] EXPENSE
        ("bijuli kharcha 300", "expense"),
        ("300 bijuli kharcha", "expense"),
        ("bijuli ko lagi 300 tiryo", "expense"),
        ("light bill 300 aayo", "expense"),
        ("300 electricity ko kharcha", "expense"),
        ("bijuli 300 ko bill tiryo", "expense"),
        ("300 bijuli kharcha vayo", "expense"),
        ("bijuli kharcha 300 diyo", "expense"),
        ("NEA bill 300 tiryo", "expense"),
        ("bijuli 300 paisa kharcha vayo", "expense"),
        ("petrol 500 ko kharcha garein", "expense"),
        ("500 ko petrol kharcha", "expense"),
        ("pasal bhada tiryo 5000", "expense"),
        ("bhada kharcha 5000", "expense"),
        ("rent tiryo 5000", "expense"),
        # [F] SALARY
        ("staff lai salary diye 25000", "salary"),
        ("25k talab diye karmachari lai", "salary"),
        ("staff ko salary 25 hajar tiryo", "salary"),
        ("talab diye sab lai 25 hajar", "salary"),
        ("25000 salary payment garein", "salary"),
        ("karmachari lai 25k pay garein", "salary"),
        ("staff payment 25000 ko", "salary"),
        ("talab tirein sabailai 25 hajar", "salary"),
        ("salary 25 hajar diye aaja", "salary"),
        ("karmachari talab 25000 settle garein", "salary"),
        # [G] LOAN
        ("Ram bata 10000 saapo liye", "loan"),
        ("10k loan liye Ram bata", "loan"),
        ("Ram le loan diye 10000", "loan"),
        ("10 hajar saapo liye", "loan"),
        ("loan liye Ram le diyeko", "loan"),
        ("bank bata 50000 loan liye", "loan"),
        ("50k loan bhayo bank bata", "loan"),
        ("Ram lai 10 hajar udhar diye", "loan_or_credit"),
        ("Ram ko 10k tiryo saapo", "loan_repayment"),
        ("saapo tiryo Ram lai 5000", "loan_repayment"),
        # [H] STOCK
        ("maal aayo 5000 ko", "stock_in"),
        ("5k ko stock aayo", "stock_in"),
        ("new stock aayo 50k ko", "stock_in"),
        ("maal saakiyo", "stock_out"),
        ("stock out vayo", "stock_out"),
        ("maal baraabar sakiyo", "stock_out"),
        ("inventory 5000 ko kinyo", "stock_purchase"),
        ("store ma maal bharna 5000 ko", "stock_in"),
        ("godam bhari maal aayo", "stock_in"),
        ("maal pharkayo", "stock_return"),
        # [I] VAT / TAX
        ("13% VAT sanga 500 ko maal", "vat"),
        ("VAT sametako 500 thiyo", "vat"),
        ("500 ma VAT jodda kati huncha?", "vat_query"),
        ("VAT nikaal 500 bata", "vat"),
        ("ex-VAT price 443 VAT 57 total 500", "vat"),
        ("TDS 15% kaatyo 1000 bata", "tds"),
        ("150 TDS kaatyo 1000 ko payment ma", "tds"),
        ("withholding tax 15% katyo", "tds"),
        ("TDS katyo pheri tirnu parcha IRD ma", "tds"),
        ("VAT return file garnu parcha", "vat"),
        # [J] ACCOUNTING QUESTIONS
        ("Ram ko kati baaki xa?", "balance_query"),
        ("Ram lai kati diyeko thiyo?", "balance_query"),
        ("Ram bata kati receivable xa?", "balance_query"),
        ("Ram ko udhaar kati xa?", "balance_query"),
        ("kati paisa baaki xa Ramko?", "balance_query"),
        ("aaj ko sales kati vayo?", "report_query"),
        ("total kharcha kati xa?", "report_query"),
        ("naafa kati vayo?", "report_query"),
        ("ghaata xa ki naafa xa?", "report_query"),
        ("balance sheet ma kati asset xa?", "report_query"),
        # [K] INFORMATION REQUESTS
        ("Ram ko account hera", "info_request"),
        ("Ram ko hisab dekhaunus", "info_request"),
        ("Ram ko ledger check garnus", "info_request"),
        ("Ram sanga kati lenden xa?", "info_request"),
        ("Ram bata kati receivable xa?", "info_request"),
        ("kati kasle diyeka xan?", "info_request"),
        ("kati kasle tireka xan?", "info_request"),
        ("aajko sales report dekhaunus", "info_request"),
        ("monthly kharcha kati xa?", "info_request"),
        ("profit loss dekhaunu", "info_request"),
        # [L] COMPLEX
        ("Ram lai 500 udhaar diye aaja ani tiryo 200 voli", "multi_transaction"),
        ("Ram le 500 ko maal kinyo aani 200 le return garyo", "multi_transaction"),
        ("Ram le ek hajar diye tin saya baaki xa", "partial_payment"),
        ("Ram ko total 2000 baaki thiyo 500 tiryo 1500 xu", "partial_payment"),
        ("pasal ma 5000 ko maal kinyo 3000 cash 2000 udhaar", "split_payment"),
        ("saman 10000 ko ayo 5000 nakit 5000 udhaar ma", "split_payment"),
        ("Ram lai 1000 diye 500 chai 500 momo ko", "itemized"),
        ("Ram 1000 le kinyo 500 sell garyo baaki 500 ko maal xa", "mixed"),
        ("aaj 5 jana customer aaye sabailai 2000 ko kharid garyo", "multi_customer"),
        ("total 10000 ko bikri aaj cash 7000 udhaar 3000", "split_sale"),
        # [M] INFORMAL GREETINGS + BUSINESS
        ("dai ke xa halkhaabar? paisa tirnu paryo hai", "informal_reminder"),
        ("bhai 500 ko kaam gareko thiyo tyo tiryo?", "informal_query"),
        ("yaar Ram ko 1000 baaki xa bhanideu", "informal_reminder"),
        ("sathi payment garyo ki xaina?", "informal_query"),
        ("yaar 5k ugauna parcha Ram bata", "informal_collect"),
        ("dai Ram lai bhanunu 500 tirnu parcha", "informal_reminder"),
        ("sathi Ram bata kati aaucha jasto lagcha?", "informal_query"),
        ("bhai aaj kaam kasto vayo kasai paisa aayo?", "informal_query"),
        ("dai aaj dherei bikri vayo 10k ko", "informal_report"),
        ("yaar naafa dherei bhayo aaj", "informal_report"),
    ]

    for i, (sent, hint) in enumerate(examples, 1):
        lines.append(f"[{i:03d}] {sent}  →  {hint}")

    return "\n".join(lines) + "\n"


def section_28() -> str:
    return hdr(28, "क्रिया संयुग्मन तालिका", "Complete Verb Conjugation Tables") + """VERB: garnu (to do)

PRESENT:
ma garchu | timi garchau | u garcha | tapai garnuhuncha | hami garchau

PAST:
maile gare/garyo | timile garyau | ule/garyo | tapaile garnubhayo

FUTURE:
ma garnechu | timi garnechau | u garnecha

NEGATIVE:
gardina (I don't) | garyena (didn't) | garne chaina (won't)

IMPERATIVE:
gara (do!) | garnus/garnuhos (please do - formal)

---

VERB: kinnu (to buy)
PRESENT: kinchhu/kinchau/kinchha
PAST: kinyo/kineko/kine
EXAMPLE: Ram le saman kinyo

VERB: bechnu (to sell)
PAST: bechyo/becheko/beche/bikyo
EXAMPLE: 500 ma becheko

VERB: tirnu (to pay)
PAST: tiryo/tireko/tire/jamayo
EXAMPLE: Ram le 500 tiryo

VERB: dinu (to give)
PAST: diyo/diye/diyeko
EXAMPLE: Ram lai 500 diyo

VERB: linu (to take/receive)
PAST: liyo/lineko
EXAMPLE: Ram bata 500 liyo

VERB: hunu (to be)
PRESENT: chhu/chhau/chha/hunuhuncha
PAST: thiye/hunu bhayo
NEGATIVE: xaina/chaina/chhaina
"""


def section_29() -> str:
    return hdr(29, "के छ? को जवाफहरू", "How Are You Exchange") + """QUESTION VARIANTS:
ke cha/ke chha/k cha/k xa/k ho = what is / how are you
kasto cha/kasto xa = how is it
sanchai cha? = are you well?

ANSWER VARIANTS:
thik xa/thik cha/thik chha/sab thik = I'm fine
ramro xa = good
sanchai xa = healthy/fine
thik nai xa = perfectly fine
khai thik xa = yeah fine (casual)
hajur thik = yes fine (respectful)

EXCHANGE EXAMPLES:
Q: k xa?          A: thik xa, tapai?
Q: kasto cha?     A: ramro, dhanyabad
Q: sanchai?       A: sanchai nai, timi?
Q: ke cha hola?   A: yahi hisab gardai, thik xa

AI: Greeting exchanges are NOT transactions. Do not extract amounts from "k xa" type messages.
"""


def section_30() -> str:
    return hdr(30, "संधि र शब्द-संयोजन", "Word Joining and Sandhi Rules") + """SPOKEN/CHAT JOINING (postposition merges with noun):

Ram + le → Ramle (agent)
ma + lai → malai (to me)
timi + lai → timilai
pasal + ma → pasalma (in shop)
Ram + ko → Ramko (Ram's)
aaja + ko → aajako (today's)
Shyam + bata → Shyambata (from Shyam)
sathi + sanga → sathisanga (with friend)

SPLIT FOR NLU:
Ramle 500 kinyo → Ram le 500 kinyo
pasalma saman cha → pasal ma saman cha
Ramko udhaar → Ram ko udhaar
malai 500 diyo → ma lai 500 diyo

AI RULE: Before parsing, attempt to split joined postposition forms:
-le, -lai, -ko, -ma, -bata, -sanga, -lagi attached to preceding word
"""


def section_31_equivalence() -> str:
    aliases = [
        ("chha", "cha", "xa", "xha", "copula 'is'"),
        ("xaina", "chhaina", "chaina", "chhain", "negation 'is not'"),
        ("vayo", "bhayo", "gyo", "gayo", "gya", "past 'happened/did'"),
        ("garyo", "gareko", "gare", "past 'did'"),
        ("kinyo", "kineko", "kine", "kiniyo", "bought"),
        ("becheko", "bechyo", "beche", "bikyo", "sold"),
        ("tiryo", "tireko", "tire", "jamayo", "paid/received"),
        ("diyo", "diye", "diyeko", "diya", "gave"),
        ("udhaar", "udhar", "udharo", "udaar", "udhhar", "credit"),
        ("nagad", "nakad", "nagat", "cash", "kesh", "cash"),
        ("kharcha", "kharcho", "karcha", "expense", "expense"),
        ("aaja", "aja", "ajha", "ajj", "today"),
        ("hijo", "kal", "kaliko", "yesterday"),
        ("bholi", "parsi", "tomorrow"),
        ("saya", "sau", "hundred"),
        ("hajar", "hazar", "thousand"),
        ("lakh", "lac", "hundred thousand"),
        ("thaha xaina", "thaha chaina", "pata xaina", "don't know"),
        ("namaste", "namaskar", "hello", "hi", "greeting"),
        ("dhanyabad", "dhanybaad", "thanks", "thank you", "thanks"),
        ("tapai", "tapain", "formal you"),
        ("timi", "ta", "informal you"),
        ("paisa", "rupiya", "rs", "npr", "rupees", "money"),
        ("pasal", "dukaan", "shop", "shop"),
        ("saman", "mal", "goods", "stock", "goods"),
        ("bikri", "becheko", "sale", "sale"),
        ("kineko", "kharid", "purchase", "purchase"),
        ("jama", "tiryo", "aayo", "payment received"),
        ("payment garyo", "bhugtan garyo", "paid out"),
    ]
    lines = [hdr(31, "MASTER EQUIVALENCE TABLE", "Master Equivalence Table")]
    lines.append("CANONICAL → ACCEPTED VARIANTS (normalize to first column):\n")
    lines.append(f"{'Canonical':<16} | {'Variants':<50} | Meaning")
    lines.append("-" * 90)
    for row in aliases:
        canonical = row[0]
        variants = ", ".join(row[1:-1])
        meaning = row[-1]
        lines.append(f"{canonical:<16} | {variants:<50} | {meaning}")
    lines.append("\nAI: Always normalize to canonical form before intent classification.")
    return "\n".join(lines) + "\n"


def section_32() -> str:
    return hdr(32, "पार्टिकल नि, त, है, नै, रे", "Sentence Particles") + """PARTICLES (emphasis/modality — strip for parsing, use for sentiment):

ni — softener/emphasis: "tiryo ni" = (yes) paid; "garchu ni" = I'll do it
ta — emphasis/contrast: "500 tiryo ta" = paid 500 (you know); "k xa ta"
hai — confirmation/tag: "thik xa hai" = it's fine, right?
nai — exactly/really: "sanchai nai" = perfectly fine
re — hearsay/emphasis: "Ram le tiryo re" = Ram paid (I heard / emphasis)
yaar/bhai/dai — friendly address (strip): "500 tiryo yaar"
bhane/hola — uncertainty: "tiryo hola" = probably paid
cha ta / xa ta — "isn't it" tag question

PARSING RULE:
"tiryo ni ta hai" → core verb: tiryo; particles: ni, ta, hai (all stripped)
Meaning unchanged: payment completed

EXAMPLES:
500 kinyo ni          = bought 500 (emphatic)
thik xa hai           = it's fine, right?
Ram le tiryo re       = Ram paid (emphasis)
garchu ni ma          = I'll do it (emphatic)
"""


def section_33() -> str:
    return hdr(33, "AI प्रशिक्षण सिफारिस", "AI Training Recommendations") + """RECOMMENDATIONS FOR e-Khata Ollama / LLM TRAINING:

1. NORMALIZATION LAYER: Always run input through Devanagari transliteration + spelling
   alias folding (Section 31) before intent classification.

2. EMBEDDING RETRIEVAL: Index this document in ChromaDB (nepali_grammar collection);
   retrieve Sections 18, 21, 24, 26, 27, 31 for transaction messages.

3. FEW-SHOT EXAMPLES: Use Section 27 patterns as few-shot examples in system prompt.

4. FUZZY MATCHING: Accept 80%+ phonetic similarity for financial verbs (Section 22).

5. DO NOT OVER-NORMALIZE: Keep le/lai/ko when present; only strip particles (Section 32).

6. CONTEXT WINDOW: Include last 3 messages for party/amount disambiguation (Section 24).

7. MULTILINGUAL OUTPUT: Reply in user's language style (Devanagari/Roman/English mix).

8. FINANCIAL PRIORITY: Amount + financial verb overrides greeting/help classification.

9. EVALUATION: Test with Halkhabar variants, Hindi mix, typos, and code-switch (Sections 14-17, 22).

10. FINE-TUNE DATA: Generate JSONL from Section 27 patterns paired with structured intents.

"""


def footer() -> str:
    return f"""
{DELIM}
दस्तावेज समाप्त — Document End
End of Complete Nepali Grammar Knowledge Reference (33 Sections)
e-Khata AI Training Document v1.0
{DELIM}
"""


BUILDERS = [
    section_1, section_2, section_3, section_4, section_5, section_6, section_7,
    section_8, section_9, section_10, section_11, section_12, section_13,
    section_14, section_15, section_16, section_17, section_18, section_19,
    section_20, section_21, section_22, section_23, section_24, section_25,
    section_26, section_27_examples, section_28, section_29, section_30,
    section_31_equivalence, section_32, section_33,
]


def main() -> None:
    import sys
    force = "--force" in sys.argv

    header_lines = []
    if OUT.exists():
        existing = OUT.read_text(encoding="utf-8")
        if force:
            # Keep only the document header block (before first section delimiter)
            cut = existing.find(DELIM)
            header_lines = [existing[:cut].rstrip()] if cut > 0 else [existing.split(DELIM)[0].rstrip()]
        elif "खण्ड 1:" in existing:
            print("Sections already present; use --force to rebuild.")
            return
        else:
            header_lines = [existing.rstrip()]
    else:
        raise SystemExit("Expected existing header in nepali-grammar-reference.txt")

    body = "".join(fn() for fn in BUILDERS) + footer()
    OUT.write_text(header_lines[0] + "\n" + body, encoding="utf-8")

    text = OUT.read_text(encoding="utf-8")
    size = OUT.stat().st_size
    lines = text.count("\n") + (0 if text.endswith("\n") else 1)
    sections = sum(1 for i in range(1, 34) if f"खण्ड {i}:" in text)

    print(f"Path: {OUT}")
    print(f"Size: {size} bytes")
    print(f"Lines: {lines}")
    print(f"Sections found: {sections}/33")
    print(f"Footer present: {'दस्तावेज समाप्त' in text}")
    print(f"Section 26 NLU: {'NLU RULES' in text}")
    print(f"Section 27 examples: {text.count('[0') >= 150}")
    print(f"Section 31 table: {'MASTER EQUIVALENCE TABLE' in text}")


if __name__ == "__main__":
    main()
