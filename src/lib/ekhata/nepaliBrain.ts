/**
 * Self-contained Nepali conversational AI brain for e-Khata.
 * No external APIs, no downloads, no Ollama — runs in the browser.
 * Handles: greetings, food, weather, identity, help, accounting, business,
 * Nepal culture, jokes, and more — plus routes transactions to the parser.
 */

import { normalizeNepaliText } from "./normalizeNepali";
import type { LedgerBalanceSnapshot } from "./conversationEngine";
import { replyBalance } from "./conversationEngine";

// ─── Message analysis ────────────────────────────────────────────────────────

export interface MessageAnalysis {
  topics: string[];
  sentiment: "positive" | "negative" | "neutral" | "question";
  isGreeting: boolean;
  isFarewell: boolean;
  isThanks: boolean;
  isQuestion: boolean;
  isIdentityQuestion: boolean;
  isHelpRequest: boolean;
  isAffirmation: boolean;
  isNegation: boolean;
  isAboutAccounting: boolean;
  isAboutWeather: boolean;
  isAboutFood: boolean;
  isAboutHealth: boolean;
  isAboutTime: boolean;
  isAboutFamily: boolean;
  isAboutBusiness: boolean;
  isAboutMoney: boolean;
  isAboutNepal: boolean;
  isSmallTalk: boolean;
  isCompliment: boolean;
  isComplaint: boolean;
  isJoke: boolean;
  detectedLanguage: "nepali" | "english" | "mixed";
}

const GREETING_PATTERNS =
  /\b(namaste|namaskar|hello|hi|hey|yo|k\s*cha|k\s*xa|kasto|hajur|dai|didi|bhai|bahini|sathi|kta|kti|sup|wassup|good\s*morning|good\s*evening|good\s*night|shubha|subha|prabhat|sandhya|raatri)\b/i;
const FAREWELL_PATTERNS =
  /\b(bye|goodbye|alvida|pheri\s*bhetaula|basnu|jaanu|good\s*night|see\s*you|ta\s*ta|tata|cya|later|ram\s*ram)\b/i;
const THANKS_PATTERNS = /\b(dhanyabad|dhanyabaad|thanks|thank\s*you|shukriya|aabhari|thx|ty)\b/i;
const IDENTITY_PATTERNS =
  /\b(timi\s*ko|timi\s*kun|ko\s*ho|who\s*are|what\s*are\s*you|your\s*name|timro\s*naam|tapaiko\s*naam|about\s*you|introduce|e-khata|ekhata)\b/i;
const HELP_PATTERNS =
  /\b(help|madat|sahayog|sahayata|kasari|how\s*to|k\s*garne|ke\s*garne|sikaunu|bataunu|explain|guide|what\s*can\s*you|ke\s*garna\s*sakchau|udaharan|example)\b/i;
const QUESTION_WORDS =
  /\b(k[aei]|kina|kasari|kahile|kaha|kati|kun|who|what|when|where|why|how|which|does|is|are|can|could|would|should|do)\b/i;
const AFFIRMATION = /\b(ho|hunchha|huncha|thik|sahi|okay|ok|yes|huss|ramro|babal|maja|chalcha|aaja)\b/i;
const NEGATION = /\b(hoina|chaina|chhaina|xaina|no|nope|nah|na|pardaina|nahuncha|sakdina)\b/i;

const FOOD_PATTERNS =
  /\b(khana|khaana|khayeu|khayo|khanu|bhat|dal|masu|tarkari|momo|chiya|chai|tea|doodh|dudh|paani|pani|breakfast|lunch|dinner|snack|fruit|phal|saag|roti|bhuja|chatpate|samosa|sekuwa|thukpa|chowmein|noodle|biryani|pulau|bhaat|cook|pakau|recipe|kheer|mithai|sweet|icecream|juice|bhok|bhoko)\b/i;
const WEATHER_PATTERNS =
  /\b(mausam|weather|garmi|jado|thandi|paani\s*par|rain|dhoop|sunny|cloudy|fog|hiu|snow|hawaa|wind|tato|chiso|barsha|monsoon)\b/i;
const HEALTH_PATTERNS =
  /\b(biram|biraami|bimar|birami|health|sancho|sanchai|doctor|hospital|ausadhi|medicine|tabiyet|tabiyat|headache|fever|tauko\s*dukh|pet\s*dukh|cold|flu|covid|exercise|yoga|gym|stress|tired|thakyo|nidra|sleep|rest|aram)\b/i;
const TIME_PATTERNS =
  /\b(samay|time|baje|ghanta|minute|aaja|today|hijo|yesterday|bholi|tomorrow|hapta|week|mahina|month|barsha|year|bihanaa|morning|diuso|afternoon|beluka|evening|rati|night|kati\s*baj)\b/i;
const FAMILY_PATTERNS =
  /\b(baba|ama|buwa|aama|didi|dai|bhai|bahini|family|pariwar|ghar|home|wife|husband|srimati|sriman|chora|chori|son|daughter|babu|nani|hajur\s*ba|hajur\s*ama|mama|maiju|kaka|kaki|fupu|nanu)\b/i;
const BUSINESS_PATTERNS =
  /\b(byapar|business|pasal|shop|dokan|dukan|customer|grahak|supplier|maal|saman|goods|stock|profit|loss|nafa|noksan|invest|loan|rin|bank|saving|bachat|tax|kar|vat|gst|audit|budget|plan|market|bazaar|price|mol|bhau|rate|dar)\b/i;
const MONEY_PATTERNS =
  /\b(paisa|rupiya|rupees|rs|npr|money|dhan|sampatti|wealth|income|amdani|expense|kharcha|salary|tallab|bonus|loan|rin|debt|udhaar|savings|bachat|cost|lagat|price|mol|bhau)\b/i;
const NEPAL_PATTERNS =
  /\b(nepal|kathmandu|pokhara|chitwan|lumbini|everest|sagarmatha|himalaya|terai|pahad|himal|district|jilla|pradesh|province|festival|dashain|tihar|holi|chhath|teej|maghe|losar|bisket|culture|sanskriti|tradition|parampara|temple|mandir|pagoda|stupa|buddha|pashupatinath|swayambhu|boudha)\b/i;
const ACCOUNTING_PATTERNS =
  /\b(accounting|hisab|kitab|lekha|ledger|khata|journal|voucher|debit|credit|balance|sheet|profit|loss|trial|receivable|payable|asset|liability|equity|income|revenue|expense|depreciation|amortization|audit|fiscal|financial|statement|report|tax|vat|tds|pan|invoice|bill|receipt|payment|bank\s*reconciliation|cost\s*center|budget)\b/i;
const JOKE_PATTERNS = /\b(joke|hasau|funny|mazak|hahaha|lol|lmao|rofl|comedy|humor|hasi)\b/i;
const COMPLIMENT_PATTERNS =
  /\b(ramro|nice|great|good|best|wonderful|amazing|awesome|excellent|brilliant|smart|clever|talented|beautiful|sundara|babal|jhakkas|dami|mast|ekdam)\b/i;
const COMPLAINT_PATTERNS =
  /\b(naramro|bad|worst|terrible|horrible|useless|stupid|slow|problem|issue|error|bug|wrong|galat|kharab|bigriyo|chal\s*na)\b/i;
const SMALL_TALK_PATTERNS =
  /\b(kasto\s*cha|k\s*gardai|busy|free|bored|interesting|news|khabar|suneko|dekheko|padhai|study|job|kaam|office|plan|travel|ghumna|movie|film|music|gaana|song|game|khel|cricket|football|book|kitab)\b/i;
const BALANCE_PATTERNS = /\b(balance|kati\s*udhaar|udhaar\s*kati|kitna|baki|total\s*udhaar|hisab\s*kati)\b/i;

function detectTopics(t: string): string[] {
  const topics: string[] = [];
  if (FOOD_PATTERNS.test(t)) topics.push("food");
  if (WEATHER_PATTERNS.test(t)) topics.push("weather");
  if (HEALTH_PATTERNS.test(t)) topics.push("health");
  if (TIME_PATTERNS.test(t)) topics.push("time");
  if (FAMILY_PATTERNS.test(t)) topics.push("family");
  if (BUSINESS_PATTERNS.test(t)) topics.push("business");
  if (MONEY_PATTERNS.test(t)) topics.push("money");
  if (NEPAL_PATTERNS.test(t)) topics.push("nepal");
  if (ACCOUNTING_PATTERNS.test(t)) topics.push("accounting");
  if (SMALL_TALK_PATTERNS.test(t)) topics.push("smalltalk");
  if (BALANCE_PATTERNS.test(t)) topics.push("balance");
  return topics;
}

function detectSentiment(t: string): MessageAnalysis["sentiment"] {
  if (t.includes("?") || QUESTION_WORDS.test(t)) return "question";
  if (COMPLIMENT_PATTERNS.test(t) || /\b(khushi|happy|ramro|maja|ramailo)\b/.test(t)) return "positive";
  if (COMPLAINT_PATTERNS.test(t) || /\b(dukhi|sad|risa|angry|naramro)\b/.test(t)) return "negative";
  return "neutral";
}

export function analyzeNepaliMessage(text: string): MessageAnalysis {
  const normalized = normalizeNepaliText(text);
  const t = normalized || text.toLowerCase().trim();
  const hasNepaliChars = /[\u0900-\u097F]/.test(text);
  const hasEnglishWords = /\b(the|is|are|was|were|have|has|do|does|will|would|can|could|should|may|might)\b/i.test(
    t,
  );

  return {
    topics: detectTopics(t),
    sentiment: detectSentiment(t),
    isGreeting: GREETING_PATTERNS.test(t),
    isFarewell: FAREWELL_PATTERNS.test(t),
    isThanks: THANKS_PATTERNS.test(t),
    isQuestion: QUESTION_WORDS.test(t) || text.includes("?"),
    isIdentityQuestion: IDENTITY_PATTERNS.test(t),
    isHelpRequest: HELP_PATTERNS.test(t),
    isAffirmation: AFFIRMATION.test(t),
    isNegation: NEGATION.test(t),
    isAboutAccounting: ACCOUNTING_PATTERNS.test(t),
    isAboutWeather: WEATHER_PATTERNS.test(t),
    isAboutFood: FOOD_PATTERNS.test(t),
    isAboutHealth: HEALTH_PATTERNS.test(t),
    isAboutTime: TIME_PATTERNS.test(t),
    isAboutFamily: FAMILY_PATTERNS.test(t),
    isAboutBusiness: BUSINESS_PATTERNS.test(t),
    isAboutMoney: MONEY_PATTERNS.test(t),
    isAboutNepal: NEPAL_PATTERNS.test(t),
    isSmallTalk: SMALL_TALK_PATTERNS.test(t),
    isCompliment: COMPLIMENT_PATTERNS.test(t),
    isComplaint: COMPLAINT_PATTERNS.test(t),
    isJoke: JOKE_PATTERNS.test(t),
    detectedLanguage: hasNepaliChars ? "nepali" : hasEnglishWords ? "english" : "mixed",
  };
}

// ─── Response bank ───────────────────────────────────────────────────────────

const RESPONSE_BANK: Record<string, string[]> = {
  greeting: [
    "Namaste! Kasto hunuhunchha? e-Khata ma tapailai swagat chha!",
    "Namaste hajur! Ma e-Khata, tapaaiko digital khata sahayogi. K garna sakchhu?",
    "Namaste! Aaja ko din ramro hos. Khata ma kei record garne ho?",
    "Hey! e-Khata yaha chha. Kura garnu hos, khata lekhnu hos, duitai garchhu!",
    "Namaskar! Ma tapaaiko personal khata assistant. Kei help chahiyo?",
  ],
  greeting_morning: [
    "Subha prabhat! Bihanai ko din ramro hos. Aaja ko khata suru garnu hos.",
    "Good morning! Aja ko bechbikhan kasari chha? Khata update garne?",
  ],
  greeting_evening: [
    "Subha sandhya! Din kaisa bityo? Aaja ko hisab milau.",
    "Good evening! Aaja ko kaam sakiyo? Khata check garne?",
  ],
  farewell: [
    "Dhanyabad! Pheri bhetaula. Tapaaiko khata safe chha.",
    "Bye! Kei help chahiyema pheri aaunus. Ma sadhai yaha chhu.",
    "Alvida! Ramro din hos. Khata ma kei lekhnu bhayo bhane yaha aaunus.",
    "Ta ta! Take care. e-Khata sadhai tayar chha.",
  ],
  thanks: [
    "Kei pardaina! Yo ta mero kaam ho. Aru kei help?",
    "Swagat chha! Tapailai help garna pauda khushi lagchha.",
    "Dhanyabad timro pani! Kei aru chahiyo bhane bhannus.",
    "Welcome! Sadhai tapaaiko sewa ma chhu.",
  ],
  identity: [
    "Ma e-Khata ho — tapaaiko personal digital khata assistant! Ma tapaaiko pasal/byapar ko hisab-kitab rakhchhu. Udhaar, bikri, kharid, kharcha — sabai ma record garchhu. Nepali, English duitai bhasha bujhchhu. Tapaaiko data kahilei baahira jaadaina — yo tapaaiko niji khata ho!",
    "Ma e-Khata — tapaaiko digital khata pustika! Ma Nepali ma kura garchhu, tapaaiko byapar ko entry rakhchhu, ani balance dekhauchu. Kei external app chaahidaina — ma app bhitra nai chhu!",
  ],
  help: [
    "Ma yesto kaam garna sakchhu:\n\n• Udhaar record: \"Ram lai 500 udhaar diye\"\n• Nagad bikri: \"cash ma 200 becheko\"\n• Payment aayo: \"Shyam le 300 tiryo\"\n• Kharid: \"1000 ko sabji kineko\"\n• Kharcha: \"bijuli kharcha 500\"\n• Payment gareko: \"Gita lai 2000 payment gareko\"\n\nAni tapai sanga kura pani garna sakchhu — mausam, khana, Nepal, accounting — j sodhnu bhayo!",
    "e-Khata le garne kaam:\n\n1. Byapar ko entry rakhne (udhaar, nagad, kharid, kharcha)\n2. Balance dekhaaune\n3. Accounting ko sawal ko jawaf dine\n4. Nepali/English ma kura garne\n\nJastai: \"Ram lai 500 udhaar\" lekhnuhos, confirm card aaucha!",
  ],
  affirmation: [
    "Thik chha! Aru kei chahiyo?",
    "Ramro! Kei aru help garna sakchhu?",
    "Huss, bujhe. Aru kura?",
    "OK! Ready chhu. K garne?",
  ],
  negation: [
    "Thik chha, kei pardaina. Kei chahiye bela pheri bhannus.",
    "OK, kei gardina. Aru kei?",
    "Huncha, chhoddim. Aru kura garnu chha?",
  ],
  food: [
    "Khana ko kura — daal bhaat tarkari ta Nepali ko jaan ho! Tapai le k khaanu bhayo aaja?",
    "Momo khanu bhayo? Nepal ko momo ta world famous! Buff momo ki chicken?",
    "Chiya ta piunu bhayo hola? Nepali masala chiya ta jhan ramro!",
    "Khana ramro khaanus — sehat nai dhan ho byapar ma pani!",
    "Hajur, khana khaye! Tapai le khannu bhayo? Khata entry chaincha bhane bhannus.",
    "Khaye hai — dhanyabad sodhnu bhayo. Timi le ni khayo?",
  ],
  weather: [
    "Mausam ko kura — Nepal ma ta char mahina paani, char mahina jado, char mahina garmi! Aja bahira kaisa chha?",
    "Jado lagyo? Chiya piunu hos ani khata update garnu hos — duitai garam kaam!",
    "Paani pareko chha? Ghar mai basera khata milaaunu hos!",
    "Nepal ko mausam ta unpredictable chha — tara khata chai consistent rakhnu parcha!",
  ],
  health: [
    "Health nai sabai bhanda thulo dhan ho! Birammi feel bhayo bhane doctor jaanus.",
    "Aram garnu hos, paani dherai piunu hos. Stress kam garnu — khata ma hunchha!",
    "Exercise garnu ramro — dimag sharp rahanchha, hisab pani ramro hunchha!",
    "Sanchai hunuhunchha? Birammi bhaye aram garnu, khata ta ma sambhalchhu!",
  ],
  time: [
    "Samay ta jhandai udchha — tyasaile khata niyamit rakhnu ramro!",
    "Aja ko kaam aja nai — bholi ko laagi nathopnus. Khata update?",
    "Time management nai business ko key ho. Entry samaymai garnu!",
  ],
  family: [
    "Pariwar ta sabai bhanda thulo sampatti ho! Ghar pariwar lai samay dinus.",
    "Family business ho? Sabai ko record rakhnu important — udhaar pani clear hunchha!",
    "Ghar ko kharcha pani track garna sakchhu — bijuli, paani, bhada sabai!",
  ],
  business: [
    "Byapar kasari chaldai chha? Niyamit khata rakhnu ramro practice ho!",
    "Customer satisfaction nai business ko jaan ho. Udhaar record clear rakhnus!",
    "Profit badhauna — kharcha kam garnu ani bikri badhaunu. Simple!",
    "Stock management important chha — k kinnu, kati kinnu, kahile kinnu!",
    "Byapar ma patience chahiyo. Dherai din lagchha tara niyamit hisab le help garchha.",
    "New business tip: pahila customer banau, paisa afai aaucha!",
  ],
  money: [
    "Paisa ko management nai sab bhanda important skill ho!",
    "Bachat garnu — aamdani bhanda kharcha kam hunu parcha. Khata le track garchha!",
    "Udhaar dinu bhanda pahila party ko history heros — khata ma sabai chha!",
    "Cash flow nai business ko lifeline ho. Niyamit track garnu!",
  ],
  nepal: [
    "Nepal — hamro pyaro desh! Sagarmatha dekhi Lumbini samma, sabai ramro!",
    "Nepal ma byapar garna jhyap chha — customer lai relationship le chinchha!",
    "Dashain tihar ma byapar badchha — tyasaile stock ready rakhnu!",
    "Nepal ko economy ma small business ko thulo contribution chha. Ramro garnu hos!",
    "Kathmandu, Pokhara, Chitwan — jaha pani byapar chaldai chha Nepal ma!",
  ],
  accounting: [
    "Accounting bhanya — paisa aayo kaha, gayo kaha, baki kati — yo track garne system ho!",
    "Double entry: har ek transaction ma debit ra credit barabar hunu parchha.",
    "Debit bhanya — paisa aayo wa sampatti badyo. Credit bhanya — paisa gayo wa rin badyo.",
    "Trial balance — sabai debit ra credit ko total milaunu. Milena bhane galti chha!",
    "VAT bhanya — Nepal ma 13% Value Added Tax lagchha. NPR 50 lakh bhanda badi turnover ma mandatory.",
    "TDS — Tax Deducted at Source. Bhuktani garda nai tax katera government lai tirnu parne.",
    "Balance Sheet — company ko sampatti (assets), rin (liabilities), ra malik ko paisa (equity) dekhaucha.",
    "Profit & Loss — kati kamaayo (income) ra kati kharchayo (expense) — net profit nikaalcha.",
    "Fiscal Year — Nepal ma Shrawan 1 dekhi Ashadh masanta samma (mid-July to mid-July).",
    "Cash vs Accrual: Cash basis ma paisa aayeko/gayeko bela record. Accrual ma bill aayeko bela nai.",
    "Depreciation — fixed asset ko value time sanga ghatdai janchha. Building, gaadi, machine sabai.",
    "Inventory valuation: FIFO (pahila aayeko pahila jaanchha), LIFO, wa Average cost method.",
  ],
  smalltalk: [
    "Kaam kura kasari chaldai chha? Ramro hunchha!",
    "Kei interesting news sunnu bhayo aaja?",
    "Free time ma k garnu hunchha? Cricket hernu huncha?",
    "Nepal ma ta festivals dherai — kati ramailo!",
    "Movie hernu bhayo kei naya? Nepali film industry pani badhdai chha!",
  ],
  joke: [
    "Haha! Thik chha ek joke sunuchu: Accountant lai kasari hasaune? Audit announce gara!",
    "Nepali joke: Customer le sodhyo 'Udhaar dinu huncha?' Pasal le bhanyo 'Kina, cash le k bigaaryo?'",
    "Ek joke: Balance sheet balance bhayena. Accountant le bhanyo — calculator ko battery sakiyo!",
    "Fun fact: Nepal ko paisa lai Rupiya bhancha — 'rupya' Sanskrit shabd ho!",
  ],
  compliment: [
    "Dhanyabad! Tapai pani ramro! Milera kaam garau!",
    "Thank you! Tapaaiko appreciation le motivation dinhcha!",
    "Tapai jasto user pauda khushi laaghchha!",
  ],
  complaint: [
    "Sorry sunera! K problem bhayo bataunu hos, ma help garna koshish garchhu.",
    "Maafi chaahanchhu. K galat bhayo? Fix garna prayaas garchhu.",
    "Feedback ko laagi dhanyabad. Problem k ho bhannu bhayo bhane ramro help garna sakchhu.",
  ],
  unknown: [
    "Hmm, bujhina purai. Thora clear bhannu hos?",
    "Yopar ma aafulai confident chhaina. Arko tarika le sodhnu hos?",
    "Interesting kura! Tara maile purai bujhina. Ke bhannu khojnu bhako?",
    "Yo bisaya ma malai dherai thaahaa chhaina. Khata sambandhi kura ho bhane help garna sakchhu!",
  ],
};

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function hashPick(seed: string, arr: string[]): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
}

export function generateNepaliReply(text: string, balance?: LedgerBalanceSnapshot): string {
  const analysis = analyzeNepaliMessage(text);
  const pick = (key: string) => hashPick(text + key, RESPONSE_BANK[key] ?? RESPONSE_BANK.unknown);

  if (analysis.topics.includes("balance") && balance) {
    return replyBalance(balance);
  }

  if (analysis.isIdentityQuestion) return pick("identity");
  if (analysis.isHelpRequest) return pick("help");

  if (analysis.isGreeting) {
    const hour = new Date().getHours();
    if (hour < 12) return pick("greeting_morning");
    if (hour >= 17) return pick("greeting_evening");
    return pick("greeting");
  }

  if (analysis.isFarewell) return pick("farewell");
  if (analysis.isThanks) return pick("thanks");
  if (analysis.isJoke) return pick("joke");
  if (analysis.isCompliment) return pick("compliment");
  if (analysis.isComplaint) return pick("complaint");

  if (analysis.isAboutAccounting) return pick("accounting");
  if (analysis.isAboutFood) return pick("food");
  if (analysis.isAboutWeather) return pick("weather");
  if (analysis.isAboutHealth) return pick("health");
  if (analysis.isAboutFamily) return pick("family");
  if (analysis.isAboutBusiness) return pick("business");
  if (analysis.isAboutMoney) return pick("money");
  if (analysis.isAboutNepal) return pick("nepal");
  if (analysis.isAboutTime) return pick("time");
  if (analysis.isSmallTalk) return pick("smalltalk");

  if (analysis.isAffirmation) return pick("affirmation");
  if (analysis.isNegation) return pick("negation");

  return pick("unknown");
}

/** Transaction signal words — if present, try parser before chat brain */
export const TRANSACTION_SIGNALS =
  /\b(udhaar|udhar|udharo|credit|diye|diya|tiryo|tireko|kineko|becheko|bikri|kharcha|expense|purchase|sold|cash\s+ma|nagad|payment\s+gareko|paisa|rupiya|rs|npr|\d{2,})\b/i;

export function isConversationalMessage(raw: string): boolean {
  const analysis = analyzeNepaliMessage(raw);
  if (TRANSACTION_SIGNALS.test(normalizeNepaliText(raw))) return false;
  if (analysis.isGreeting || analysis.isHelpRequest || analysis.isIdentityQuestion) return true;
  if (analysis.topics.length > 0) return true;
  if (analysis.isQuestion) return true;
  return analysis.sentiment !== "neutral" || raw.trim().split(/\s+/).length <= 8;
}

export function shouldTryTransactionParse(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const normalized = normalizeNepaliText(trimmed);
  if (!TRANSACTION_SIGNALS.test(normalized)) return false;

  const analysis = analyzeNepaliMessage(trimmed);
  const hasStrongEntry =
    /\d/.test(normalized) &&
    /\b(udhaar|udhar|udharo|diye|diya|tiryo|kineko|becheko|bikri|kharcha|nagad|payment)\b/.test(normalized);

  if (hasStrongEntry) return true;
  if (analysis.isGreeting || analysis.isIdentityQuestion || analysis.isHelpRequest) return false;
  return true;
}
