/**
 * e-Khata Nepali Conversational AI Brain — v2 (Deep Context)
 * Self-contained. No API. No downloads. No Ollama.
 *
 * Architecture:
 * 1. Multi-signal analysis (not single-keyword)
 * 2. Context scoring per topic (weighted multi-match)
 * 3. Deep response banks with varied, human-like replies
 * 4. Follow-up awareness via conversation memory
 * 5. Knowledge base for accounting, Nepal, general topics
 */

import type { LedgerBalanceSnapshot } from "./conversationEngine";
import { replyBalance } from "./conversationEngine";

// ─── Multi-signal topic scoring ──────────────────────────────────────────────

interface TopicScore {
  topic: string;
  score: number;
  confidence: "high" | "medium" | "low";
}

export interface MessageAnalysis {
  topScores: TopicScore[];
  /** Back-compat alias for callers expecting topic strings */
  topics: string[];
  primaryTopic: string;
  sentiment: "positive" | "negative" | "neutral" | "question";
  isGreeting: boolean;
  isFarewell: boolean;
  isThanks: boolean;
  isQuestion: boolean;
  isIdentityQuestion: boolean;
  isCapabilityQuestion: boolean;
  isKnowledgeQuestion: boolean;
  isHelpRequest: boolean;
  isAffirmation: boolean;
  isNegation: boolean;
  isAbuse: boolean;
  detectedLanguage: "nepali" | "english" | "mixed";
  questionTarget: string | null;
}

// Each pattern set has weight — heavier = stronger signal
const TOPIC_SIGNALS: Record<string, Array<{ pattern: RegExp; weight: number }>> = {
  greeting: [
    { pattern: /\b(namaste|namaskar|hello|hi|hey)\b/i, weight: 10 },
    { pattern: /\b(k\s*cha|k\s*xa|kasto)\b/i, weight: 8 },
    { pattern: /\bgood\s*(morning|evening|night|afternoon)\b/i, weight: 10 },
    { pattern: /\b(subha|shubha)\s*(prabhat|sandhya|raatri)\b/i, weight: 10 },
    { pattern: /\b(yo|sup|wassup)\b/i, weight: 5 },
    { pattern: /\b(hajur|dai|didi|bhai|bahini|sathi)\b/i, weight: 3 },
  ],
  farewell: [
    { pattern: /\b(bye|goodbye|alvida|ta\s*ta|tata|cya|later)\b/i, weight: 10 },
    { pattern: /\bpheri\s*bhetaula\b/i, weight: 10 },
    { pattern: /\bgood\s*night\b/i, weight: 8 },
    { pattern: /\bsee\s*you\b/i, weight: 8 },
  ],
  thanks: [
    { pattern: /\b(dhanyabad|dhanyabaad|thanks|thank\s*you|shukriya|thx|ty)\b/i, weight: 10 },
  ],
  identity: [
    { pattern: /\b(timi|tapai)\s*(ko|kun)\s*(ho|hau)\b/i, weight: 10 },
    { pattern: /\bwho\s*are\s*you\b/i, weight: 10 },
    { pattern: /\bma\s*ko\s*ho\b/i, weight: 10 },
    { pattern: /\byour\s*name\b/i, weight: 10 },
    { pattern: /\btimro\s*naam\b/i, weight: 10 },
    { pattern: /\babout\s*you\b/i, weight: 8 },
    { pattern: /\bintroduce\b/i, weight: 8 },
  ],
  capability: [
    { pattern: /\b(timi|tapai)\s*sanga\s*(brain|dimag|buddhi)\b/i, weight: 10 },
    { pattern: /\btim(i|lai)\s*(k\s*k|ke\s*ke|kk)\s*(thaha|tha|janch|bujhch)\b/i, weight: 10 },
    { pattern: /\bwhat\s*(can|do)\s*you\s*(do|know)\b/i, weight: 10 },
    { pattern: /\b(k\s*k|ke\s*ke)\s*(garna|bujhna)\s*sakch\b/i, weight: 10 },
    { pattern: /\btimi\s*smart\b/i, weight: 8 },
    { pattern: /\bAI\b/i, weight: 5 },
    { pattern: /\b(intelligent|clever|budhi)\b/i, weight: 5 },
  ],
  help: [
    { pattern: /\b(help|madat|sahayog|sahara)\b/i, weight: 10 },
    { pattern: /\b(kasari|how\s*to)\b/i, weight: 5 },
    { pattern: /\bk\s*garne\b/i, weight: 7 },
    { pattern: /\b(sikaunu|bataunu|dekhau)\b/i, weight: 8 },
    { pattern: /\bwhat\s*can\s*you\b/i, weight: 7 },
  ],
  food: [
    { pattern: /\b(khana|khaana|khayeu|khayo|khanu)\b/i, weight: 10 },
    { pattern: /\b(bhat|dal|masu|tarkari|momo|chowmein|noodle)\b/i, weight: 10 },
    { pattern: /\b(chiya|chai|tea|coffee|doodh|dudh)\b/i, weight: 8 },
    { pattern: /\b(breakfast|lunch|dinner|snack|tiffin)\b/i, weight: 8 },
    { pattern: /\b(mithai|sweet|cake|biscuit|puri|roti)\b/i, weight: 8 },
    { pattern: /\b(sekuwa|thukpa|chatpate|samosa|pakoda)\b/i, weight: 10 },
    { pattern: /\b(cook|pakau|recipe|banaunu)\b/i, weight: 7 },
    { pattern: /\b(kasto\s*lag|taste|swad|mitho)\b/i, weight: 6 },
    { pattern: /\b(bhok|hunger|pet|stomach)\b/i, weight: 6 },
    { pattern: /\b(restaurant|hotel|bhojanalaya)\b/i, weight: 7 },
  ],
  weather: [
    { pattern: /\b(mausam|weather|mausam)\b/i, weight: 10 },
    { pattern: /\b(garmi|jado|thandi|tato|chiso)\b/i, weight: 8 },
    { pattern: /\b(paani\s*par|rain|barsha|barsaat)\b/i, weight: 9 },
    { pattern: /\b(dhoop|sunny|cloudy|fog|kuiro)\b/i, weight: 9 },
    { pattern: /\b(hiu|snow|hawaa|wind|tsunami|storm)\b/i, weight: 9 },
  ],
  health: [
    { pattern: /\b(biram|biraami|health|sancho|doctor|hospital)\b/i, weight: 10 },
    { pattern: /\b(ausadhi|medicine|tabiyet|tabiyat)\b/i, weight: 9 },
    { pattern: /\b(headache|fever|tauko\s*dukh|pet\s*dukh)\b/i, weight: 10 },
    { pattern: /\b(exercise|yoga|gym|fitness)\b/i, weight: 7 },
    { pattern: /\b(stress|tired|thakyo|nidra|sleep|aram)\b/i, weight: 7 },
    { pattern: /\b(covid|flu|cold|cough|khohi)\b/i, weight: 9 },
  ],
  time: [
    { pattern: /\b(samay|time|baje|ghanta|minute)\b/i, weight: 8 },
    { pattern: /\bkati\s*baj\b/i, weight: 10 },
    { pattern: /\b(aaja|today|hijo|yesterday|bholi|tomorrow)\b/i, weight: 5 },
    { pattern: /\b(hapta|week|mahina|month|barsha|year)\b/i, weight: 5 },
  ],
  family: [
    { pattern: /\b(baba|ama|buwa|aama|family|pariwar)\b/i, weight: 10 },
    { pattern: /\b(didi|dai|bhai|bahini|wife|husband)\b/i, weight: 6 },
    { pattern: /\b(chora|chori|son|daughter|babu|nani)\b/i, weight: 8 },
    { pattern: /\b(ghar|home|bihe|marriage|wedding)\b/i, weight: 6 },
  ],
  business: [
    { pattern: /\b(byapar|business|pasal|shop|dokan)\b/i, weight: 10 },
    { pattern: /\b(customer|grahak|supplier|maal|saman)\b/i, weight: 8 },
    { pattern: /\b(profit|loss|nafa|noksan|invest)\b/i, weight: 8 },
    { pattern: /\b(market|bazaar|price|mol|bhau|rate|dar)\b/i, weight: 7 },
    { pattern: /\b(startup|company|firm|enterprise)\b/i, weight: 7 },
  ],
  money: [
    { pattern: /\b(paisa|rupiya|rupees|rs|npr|money)\b/i, weight: 8 },
    { pattern: /\b(loan|rin|debt|udhaar|savings|bachat)\b/i, weight: 8 },
    { pattern: /\b(salary|tallab|income|amdani)\b/i, weight: 8 },
    { pattern: /\b(bank|atm|cheque|transfer)\b/i, weight: 6 },
  ],
  nepal: [
    { pattern: /\b(nepal|kathmandu|pokhara|chitwan|lumbini)\b/i, weight: 10 },
    { pattern: /\b(everest|sagarmatha|himalaya|terai|pahad)\b/i, weight: 10 },
    { pattern: /\b(dashain|tihar|holi|chhath|teej|losar)\b/i, weight: 9 },
    { pattern: /\b(temple|mandir|pagoda|stupa|buddha)\b/i, weight: 7 },
    { pattern: /\b(culture|sanskriti|tradition|parampara)\b/i, weight: 7 },
    { pattern: /\b(district|jilla|pradesh|province)\b/i, weight: 7 },
  ],
  accounting: [
    { pattern: /\b(accounting|hisab|kitab|lekha|ledger|khata)\b/i, weight: 8 },
    { pattern: /\b(balance\s*sheet|profit\s*.*loss|trial\s*balance)\b/i, weight: 10 },
    { pattern: /\b(debit|credit|journal|voucher)\b/i, weight: 9 },
    { pattern: /\b(asset|liability|equity|capital)\b/i, weight: 9 },
    { pattern: /\b(depreciation|amortization|provision)\b/i, weight: 10 },
    { pattern: /\b(receivable|payable|outstanding)\b/i, weight: 8 },
    { pattern: /\b(fiscal\s*year|financial\s*statement)\b/i, weight: 10 },
    { pattern: /\b(audit|auditing|auditor)\b/i, weight: 9 },
    { pattern: /\b(GAAP|IFRS|NAS|accounting\s*standard)\b/i, weight: 10 },
  ],
  tax: [
    { pattern: /\b(tax|kar|vat|gst)\b/i, weight: 10 },
    { pattern: /\b(tds|pan|tax\s*rate|income\s*tax)\b/i, weight: 10 },
    { pattern: /\b(IRD|inland\s*revenue)\b/i, weight: 10 },
    { pattern: /\b(exemption|deduction|rebate|slab)\b/i, weight: 9 },
    { pattern: /\b(filing|return|assessment)\b/i, weight: 8 },
    { pattern: /\b(13\s*%|vat\s*rate)\b/i, weight: 10 },
    { pattern: /\b(single|married|couple|natural\s*person)\b/i, weight: 7 },
  ],
  technology: [
    { pattern: /\b(computer|laptop|mobile|phone|internet)\b/i, weight: 8 },
    { pattern: /\b(software|app|website|program)\b/i, weight: 7 },
    { pattern: /\b(AI|artificial\s*intelligence|machine\s*learning)\b/i, weight: 8 },
    { pattern: /\b(coding|programming|developer)\b/i, weight: 7 },
  ],
  education: [
    { pattern: /\b(padhai|study|school|college|university)\b/i, weight: 9 },
    { pattern: /\b(exam|pariksha|result|grade|marks)\b/i, weight: 9 },
    { pattern: /\b(teacher|guru|sir|miss|student)\b/i, weight: 7 },
    { pattern: /\b(book|kitab|library|pustkalaya)\b/i, weight: 6 },
  ],
  entertainment: [
    { pattern: /\b(movie|film|cinema|nepali\s*film)\b/i, weight: 8 },
    { pattern: /\b(music|gaana|song|sangeet)\b/i, weight: 8 },
    { pattern: /\b(cricket|football|khel|game|sport)\b/i, weight: 8 },
    { pattern: /\b(tiktok|youtube|facebook|instagram|social\s*media)\b/i, weight: 7 },
  ],
  politics: [
    { pattern: /\b(sarkar|government|politics|rajniti)\b/i, weight: 9 },
    { pattern: /\b(prime\s*minister|pradhan\s*mantri|PM)\b/i, weight: 9 },
    { pattern: /\b(election|chunaav|nirvachan|vote)\b/i, weight: 9 },
    { pattern: /\b(party|congress|maoist|UML|democrat)\b/i, weight: 7 },
    { pattern: /\b(constitution|sambidhan|parliament|sansad)\b/i, weight: 9 },
  ],
  joke: [
    { pattern: /\b(joke|hasau|funny|mazak|hahaha|lol|lmao)\b/i, weight: 10 },
    { pattern: /\b(comedy|humor|hasi)\b/i, weight: 8 },
  ],
  math: [
    { pattern: /\b(\d+\s*[\+\-\*\/x]\s*\d+)\b/i, weight: 10 },
    { pattern: /\b(calculate|ganana|jod|ghata|guna|bhaag)\b/i, weight: 9 },
    { pattern: /\b(kati\s*huncha|total|sum|average)\b/i, weight: 6 },
  ],
};

function scoreTopic(text: string, signals: Array<{ pattern: RegExp; weight: number }>): number {
  let score = 0;
  for (const { pattern, weight } of signals) {
    if (pattern.test(text)) score += weight;
  }
  return score;
}

export function analyzeNepaliMessage(text: string): MessageAnalysis {
  const t = text.toLowerCase().trim();
  const hasNepali = /[\u0900-\u097F]/.test(text);

  const scores: TopicScore[] = [];
  for (const [topic, signals] of Object.entries(TOPIC_SIGNALS)) {
    const score = scoreTopic(t, signals);
    if (score > 0) {
      scores.push({
        topic,
        score,
        confidence: score >= 10 ? "high" : score >= 5 ? "medium" : "low",
      });
    }
  }
  scores.sort((a, b) => b.score - a.score);

  const primaryTopic = scores[0]?.topic || "unknown";
  const isQuestion =
    /[?？]/.test(t) ||
    /\b(k[aei]|kina|kasari|kahile|kaha|kati|kun|who|what|when|where|why|how|which|does|is|are|can|could)\b/i.test(
      t,
    );

  let questionTarget: string | null = null;
  const aboutMatch = t.match(/\b(k[aeo]?\s+ho|what\s+is|what\s+are)\s+(.+?)[\?]?$/i);
  if (aboutMatch) questionTarget = aboutMatch[2].trim();

  return {
    topScores: scores,
    topics: scores.map((s) => s.topic),
    primaryTopic,
    sentiment: isQuestion
      ? "question"
      : /\b(khushi|happy|ramro|maja)\b/i.test(t)
        ? "positive"
        : /\b(dukhi|sad|naramro|risa)\b/i.test(t)
          ? "negative"
          : "neutral",
    isGreeting: scoreTopic(t, TOPIC_SIGNALS.greeting) >= 8,
    isFarewell: scoreTopic(t, TOPIC_SIGNALS.farewell) >= 8,
    isThanks: scoreTopic(t, TOPIC_SIGNALS.thanks) >= 8,
    isQuestion,
    isIdentityQuestion: scoreTopic(t, TOPIC_SIGNALS.identity) >= 8,
    isCapabilityQuestion: scoreTopic(t, TOPIC_SIGNALS.capability) >= 8,
    isKnowledgeQuestion:
      /\b(timlai|timilai|tapailai|timi|tapai)\s*(k\s*k|ke\s*ke|kk)\s*(thaha|tha|janch|aaucha)\b/i.test(t),
    isHelpRequest: scoreTopic(t, TOPIC_SIGNALS.help) >= 7,
    isAffirmation: /\b(ho|hunchha|thik|sahi|okay|ok|yes|huss|huncha)\b/i.test(t) && t.length < 20,
    isNegation: /\b(hoina|chaina|chhaina|xaina|no|nope|nah|na|pardaina)\b/i.test(t) && t.length < 20,
    isAbuse: /\b(muji|randi|lado|chikne|machikne|fuck|shit|bastard)\b/i.test(t),
    detectedLanguage: hasNepali ? "nepali" : /\b(the|is|are|was|have|has|do|does|will|can)\b/i.test(t) ? "english" : "mixed",
    questionTarget,
  };
}

// ─── Knowledge Base (for factual answers) ────────────────────────────────────

const KNOWLEDGE: Record<string, Record<string, string>> = {
  accounting: {
    "balance sheet":
      "Balance Sheet (Sthiti Vivaran) le company ko kun samay ma kati sampatti (assets), kati rin (liabilities), ra kati malik ko lagaani (equity) chha bhanera dekhaucha. Yo accounting ko sabse important report ho — Assets = Liabilities + Equity formula follow garchha.",
    "profit loss":
      "Profit & Loss Statement (Nafa Noksan Vivaran) le ek fiscal year ma kati income aayo ra kati expense bhayo bhanera dekhaucha. Income - Expenses = Net Profit/Loss.",
    "trial balance":
      "Trial Balance le sabai ledger accounts ko debit ra credit totals ek thau ma dekhaucha. Debit total = Credit total hunu parchha — natra galti chha.",
    "debit credit":
      "Accounting ma Debit (Dr) = baaya taraf, Credit (Cr) = daaya taraf. Asset badhe ma debit, Income badhe ma credit. Double entry: har ek transaction ma debit = credit.",
    "journal voucher":
      "Journal Voucher general-purpose double-entry voucher ho — manual adjustments, provisions, accruals, ra aru voucher types le cover nagarne entries ko laagi prayog hunchha.",
    depreciation:
      "Depreciation le fixed assets ko value samay sanga ghatdai jaane dekhaucha. Methods: Straight Line (barabar), Written Down Value (ghatdai jaaney), ra Units of Production.",
    "fiscal year":
      "Nepal ko fiscal year Shrawan 1 dekhi Ashadh masanta samma hunchha (mid-July to mid-July). Bikram Sambat calendar follow garchha.",
    gaap: "GAAP (Generally Accepted Accounting Principles) le accounting kasari garne bhanera niyam banaucha. Nepal ma NAS (Nepal Accounting Standards) follow garchha.",
    "cash accrual":
      "Cash basis ma paisa aayeko/gayeko bela record. Accrual basis ma bill aayeko bela nai record — paisa aayeko chhaina bhane pani.",
    inventory:
      "Inventory valuation methods: FIFO (pahila aayeko pahila jaanchha), LIFO (pachhi aayeko pahila jaanchha), Weighted Average Cost.",
    "bank reconciliation":
      "Bank reconciliation ma company ko book balance ra bank statement balance milaauchha. Cheque pending, bank charges, interest — yinihar ko difference check garchha.",
  },
  tax: {
    "vat nepal":
      "Nepal ma VAT (Value Added Tax) rate 13% ho. NPR 50 lakh bhanda badi annual turnover bhaye mandatory VAT registration garna parcha. IRD (Inland Revenue Department) le administer garchha.",
    "income tax single":
      "Nepal ma single natural person ko laagi income tax slabs:\n• NPR 5,00,000 samma: 1% (social security tax)\n• NPR 5,00,001 - 7,00,000: 10%\n• NPR 7,00,001 - 10,00,000: 20%\n• NPR 10,00,001 - 20,00,000: 30%\n• NPR 20,00,000 bhanda mathi: 36%",
    "income tax couple":
      "Married couple ko laagi income tax slabs thora higher exemption hunchha:\n• NPR 6,00,000 samma: 1%\n• NPR 6,00,001 - 8,00,000: 10%\n• Ra tespachhi single jastai rates lagchha.",
    "tds nepal":
      "TDS (Tax Deducted at Source) Nepal ma: Service contract 1.5%, House rent 10%, Consultancy/professional 15%, Interest 5-15%, Dividend 5%.",
    "pan nepal":
      "PAN (Permanent Account Number) Nepal ma sabai taxpayer lai mandatory 9-digit number ho. IRD bata issue hunchha. Tax return file garna, bank account kholna, property kinbech garna chahinchha.",
    "tax filing":
      "Nepal ma income tax return file garne deadline: Poush masanta (mid-January). Late filing ma penalty ra interest lagchha.",
  },
  nepal: {
    capital:
      "Nepal ko rajdhani Kathmandu ho. Yo Kathmandu Valley ma parchha jasma Kathmandu, Lalitpur, ra Bhaktapur — 3 ota jilla chhan.",
    population: "Nepal ko janasankhya lagbhag 3 crore (30 million) chha. 7 ota Pradesh chhan.",
    currency:
      "Nepal ko mudra Nepali Rupiya (NPR/Rs.) ho. India Rupee sanga fixed exchange rate: 1 INR = 1.6 NPR.",
    "mount everest":
      "Sagarmatha (Mount Everest) sansar ko sabse aglo himal ho — 8,848.86 meter. Nepal ra China (Tibet) ko border ma parchha.",
    languages:
      "Nepal ma 123+ bhasha bolinchha. Official language: Nepali (Khas bhasha). Maithili, Bhojpuri, Tharu, Tamang, Newar — aru pani dherai chhan.",
    provinces: "Nepal ka 7 Pradesh: Koshi, Madhesh, Bagmati, Gandaki, Lumbini, Karnali, Sudurpashchim.",
    festivals:
      "Nepal ka pramukh chaadhpar: Dashain (sabse thulo), Tihar (Diwali), Chhath, Holi, Teej, Maghe Sankranti, Losar, Bisket Jatra.",
    constitution:
      "Nepal ko sambidhan 2072 BS (2015 AD) ma jari bhayo. Nepal lai federal democratic republic ghoshana gareko ho.",
  },
  general: {
    gravity:
      "Gravity (gurutwakarshan) le sabai vastulai prithi tira tanccha. Newton le apple khaseko dekhera yo discover gareka thiyo. g = 9.8 m/s².",
    "water formula":
      "Paani ko chemical formula H₂O ho — 2 hydrogen atoms ra 1 oxygen atom milera banchha.",
    "sun distance":
      "Surya prithvi bata lagbhag 15 crore km (150 million km) tada chha. Sunlight lai prithvi auna lagbhag 8 minute 20 second lagchha.",
    "pi value":
      "Pi (π) ko value approximately 3.14159 ho. Circle ko circumference ÷ diameter = π.",
  },
};

function searchKnowledge(text: string): string | null {
  const t = text.toLowerCase();
  for (const [, entries] of Object.entries(KNOWLEDGE)) {
    for (const [key, answer] of Object.entries(entries)) {
      const keywords = key.split(/\s+/);
      const matchCount = keywords.filter((kw) => t.includes(kw)).length;
      if (matchCount >= Math.max(1, keywords.length * 0.6)) {
        return answer;
      }
    }
  }
  if (/\b(tax\s*rate|income\s*tax|kar\s*dar)\b/i.test(t) && /\b(single|natural\s*person|byakti)\b/i.test(t)) {
    return KNOWLEDGE.tax["income tax single"];
  }
  if (/\b(tax\s*rate|income\s*tax|kar\s*dar)\b/i.test(t) && /\b(married|couple|dampati)\b/i.test(t)) {
    return KNOWLEDGE.tax["income tax couple"];
  }
  if (/\b(balance\s*sheet)\b/i.test(t) && /\b(k[aeo]?\s*ho|what\s*is|explain|bhannu)\b/i.test(t)) {
    return KNOWLEDGE.accounting["balance sheet"];
  }
  if (/\b(vat|value\s*added\s*tax)\b/i.test(t)) {
    return KNOWLEDGE.tax["vat nepal"];
  }
  if (/\b(tds)\b/i.test(t)) {
    return KNOWLEDGE.tax["tds nepal"];
  }
  return null;
}

// ─── Response Banks ──────────────────────────────────────────────────────────

const R: Record<string, string[]> = {
  greeting: [
    "Namaste! Kasto hunuhunchha? e-Khata ma swagat chha! Aaja k garna sakchhu?",
    "Namaste hajur! Ma e-Khata — tapaaiko khata sahayogi. Kura garau!",
    "Hey! Aaja ko din ramro hos! Khata lekhne ho ki kura garne?",
  ],
  greeting_morning: [
    "Subha prabhat! Bihanai ko energy ramro! Aaja ko khata suru garau?",
    "Good morning! Aja ramro din huncha. K kaam chha?",
  ],
  greeting_evening: [
    "Subha sandhya! Din ramro bityo? Hisab milaaune bela bhayo hola.",
    "Good evening! Beluka ko aram kaisi? Kei help?",
  ],
  farewell: [
    "Bye! Pheri bhetaula. Khata safe chha — chinta nagarnus!",
    "Alvida! Kei chahiye bela pheri aaunus.",
    "Ta ta! Ramro din/raat hos!",
  ],
  thanks: [
    "Kei pardaina! Yo ta mero kaam ho. Aru kei?",
    "Swagat chha! Help garna paauda khushi lagchha.",
    "Dhanyabad tapaaiko pani! Milera kaam garau!",
  ],
  identity: [
    "Ma e-Khata (इ-खाता) ho — tapaaiko personal digital khata assistant!\n\nMa garna sakne kaam:\n• Khata entries: udhaar, bikri, kharid, kharcha record\n• Nepali/English/Roman Nepali bujhchhu\n• Accounting concepts explain garchhu\n• Nepal ko tax, VAT, TDS ko info dinchhu\n• General knowledge — Nepal, mausam, khana, j sodhnu bhayo\n• Business tips ra advice\n\nKunai external app, API, wa download chaahidaina — ma purai self-contained chhu!",
  ],
  capability: [
    "Hajur, mero brain chha! Ma yesto kaam garna sakchhu:\n\n📒 **Khata kaam:** Udhaar, bikri, kharid, kharcha — sabai record\n📚 **Accounting gyan:** Balance sheet, P&L, journal, debit-credit\n💰 **Tax info:** VAT 13%, income tax slabs, TDS rates\n🇳🇵 **Nepal knowledge:** Rajdhani, janasankhya, festivals, provinces\n🍛 **Saamaanya gyan:** Khana, mausam, health, entertainment\n🧮 **Calculation:** Simple math\n\nMa sabai kura jandina — tara dherai kura janchhu! Sodhnus!",
  ],
  knowledge_question: [
    "Malai dherai kura thaaha chha! Accounting, Nepal, tax rules, general knowledge, khana-pina, mausam, health — yinihar ma help garna sakchhu. Tara kei naya news wa real-time data chai maile dinchhu bhanna sakdina. Sodhnus — jati sakchhu batauchhu!",
  ],
  help: [
    "Ma yesari help garchhu:\n\n**Khata entry:**\n• `Ram lai 500 udhaar diye`\n• `cash ma 200 becheko`\n• `Shyam le 300 tiryo`\n• `1000 ko sabji kineko`\n• `bijuli kharcha 500`\n\n**Sawal sodhnus:**\n• `Balance sheet k ho?`\n• `Nepal ma VAT kati %?`\n• `TDS rate kati?`\n• Wa kunai pani sawal!\n\nNepali, English, duitai chalchha!",
  ],
  food: [
    "Khana ko kura! Nepal ko momo ta world famous! Tapai lai k man parchha — buff momo, chicken momo, ki veg? Chutney bina momo ta adhuro!",
    "Chowmein kasto lagchha bhannu bhayo? Nepal ko thela chowmein ta iconic ho! Spicy sauce, cabbage, onion — garam garam khaanu parchha!",
    "Dal bhaat tarkari — Nepali ko power meal! Twice a day khane bani le strength dinchha. Tapai le aaja k khaanu bhayo?",
    "Nepali khana ta mitho! Sel roti, yomari, dhido, gundruk, kinema — sabai unique. K try garnu bhayo?",
    "Khana khayeu? Bihaan ko khana ta important — energy ko source ho. Skip nagarnos!",
  ],
  weather: [
    "Nepal ko mausam ta diverse chha — Terai ma garmi, pahad ma thanda, Himalaya ma hiu! Tapai kaha hunuhunchha?",
    "Barsha lagyo bhane ghar mai basera khata update garnu — productive time!",
    "Jado lagyo? Chiya piunu hos ani warm rahanus. Nepal ko jado ta ekdam chiso hunchha!",
  ],
  health: [
    "Sehat nai sabse thulo dhan ho! Birammi feel bhayo bhane please doctor kaha jaanus. Self-medication nagarnus.",
    "Exercise daily garnu ramro — 30 minute walk pani pugchha. Mind ra body duitai fit rahos!",
    "Paani dherai piunu, ramro khana khaanu, nidra puraa garnu — yinai 3 rule health ko!",
  ],
  business: [
    "Byapar ma cash flow nai king ho — paisa aayo-gayo track garnu sabse important! e-Khata le yahi help garchha.",
    "Customer happy chha bhane byapar chalchha. Relationship build garnus — trust nai capital ho!",
    "Tip: Kharcha kam garnu profit badhaune sabse sajilo tarika ho. Daily expenses track garnus!",
    "Small business ko laagi niyamit hisab rakhnu mandatory — naramro din ma pani thaaha hunchha kaha chha paisa.",
  ],
  nepal: [
    "Nepal — hamro pyaaro desh! 8 ota 8,000m+ peaks, Lumbini (Buddha janmasthan), diverse culture — gauravpurna!",
    "Nepal ma 125+ jaati ra 123+ bhasha — diversity nai hamro strength ho!",
    "Dashain-Tihar ma ta sabai lai ramailo! Tika, jamara, deusi-bhailo — yehi Nepal!",
  ],
  accounting_general: [
    "Accounting bhanya — paisa aayo kaha, gayo kaha, baki kati — systematic tarikale track garne system ho. Double entry principle ma har ek transaction ma debit = credit hunu parchha.",
  ],
  affirmation: [
    "Ramro! Aru kei chahiyo?",
    "Thik chha! K garne aba?",
    "OK! Ready chhu — bhannus!",
  ],
  negation: [
    "Huncha, kei pardaina. Chahiye bela pheri aaunus!",
    "OK, choddim. Aru kura?",
  ],
  abuse: [
    "Yesto shabda prayog nagarnus hajur. Ma tapailai help garna chahanchu — ramro tarikale sodhnus na!",
    "Maafi, tara yesto language ma reply gardina. Ramrosanga kura garau!",
  ],
  joke: [
    "😄 Ek joke: Accountant lai kasari hasaaune? 'Audit aauchha' bhanna! Haha!",
    "Joke: Client le sodhyo — 'Mero paisa kaha gayo?' Accountant le bhanyo — 'Balance sheet hernus, sabai tya chha... paper ma!' 😂",
    "Fun fact: Nepal ko currency 'Rupiya' shabd Sanskrit ko 'rupya' bata aako ho — artha 'chandi' (silver)!",
  ],
  unknown: [
    "Yo barema malai detail thaaha chhaina, tara ma koshish garchhu! Thora aru describe garnu hos?",
    "Hmm, yo specific topic ma malai limited knowledge chha. Accounting, tax, wa Nepal barema sodhnu bhayo bhane better help garna sakchhu!",
    "Interesting sawal! Tara exact answer dina sakdina. Kei accounting wa khata sambandhi ho bhane zaroor help garchhu!",
  ],
  math_error: [
    "Math calculation garna try gare tara exact answer nikalna sakina. Calculator prayog garnu better hunchha!",
  ],
};

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Simple math evaluator ───────────────────────────────────────────────────

function tryMath(text: string): string | null {
  const mathMatch = text.match(/(\d+(?:\.\d+)?)\s*([\+\-\*\/x])\s*(\d+(?:\.\d+)?)/);
  if (!mathMatch) return null;
  const a = parseFloat(mathMatch[1]);
  const op = mathMatch[2] === "x" ? "*" : mathMatch[2];
  const b = parseFloat(mathMatch[3]);
  let result: number;
  switch (op) {
    case "+":
      result = a + b;
      break;
    case "-":
      result = a - b;
      break;
    case "*":
      result = a * b;
      break;
    case "/":
      result = b === 0 ? NaN : a / b;
      break;
    default:
      return null;
  }
  if (isNaN(result)) return "Zero le divide garna mildaina!";
  return `${a} ${mathMatch[2]} ${b} = ${result.toLocaleString()}`;
}

// ─── Main Response Generator ─────────────────────────────────────────────────

export function generateNepaliReply(
  text: string,
  balance?: LedgerBalanceSnapshot,
  preferredLang?: "nepali" | "english" | "mixed",
): string {
  const analysis = analyzeNepaliMessage(text);
  const lang = preferredLang ?? analysis.detectedLanguage;

  // Khata balance queries only — not "balance sheet" definitions
  if (
    balance &&
    /\b(kati\s*udhaar|udhaar\s*kati|kitna|baki|total\s*udhaar|hisab\s*kati)\b/i.test(text) &&
    !/\bbalance\s*sheet\b/i.test(text)
  ) {
    return replyBalance(balance);
  }

  if (analysis.isAbuse) return pick(R.abuse);

  if (analysis.isIdentityQuestion) {
    return lang === "english"
      ? "I'm **e-Khata** — your CA-level accounting language assistant.\n\nI understand accounting in Nepali and English:\n• Post journal entries from natural language\n• Explain debit/credit, classifications, VAT, SSF, gratuity\n• Answer 'what entry for X?' questions\n• Works offline with built-in brain; Ollama LLM when available"
      : pick(R.identity);
  }
  if (analysis.isCapabilityQuestion) {
    return lang === "english"
      ? "I speak **accounting language** in Nepali and English:\n\n📒 Journal entries: receivables, payables, bad debts, salary, SSF, VAT, TDS\n📚 Accounting Q&A: debit/credit, asset/liability classification\n💬 Reply in your language — Nepali, English, or mixed\n\nTry: 'what entry for bad debt?' or 'Ram lai 500 udhaar becheko'"
      : pick(R.capability);
  }
  if (analysis.isKnowledgeQuestion) return pick(R.knowledge_question);

  if (analysis.isHelpRequest && analysis.topScores.length <= 1) return pick(R.help);

  if (
    analysis.isGreeting &&
    analysis.primaryTopic === "greeting" &&
    analysis.topScores[0]?.score >= 8
  ) {
    const hour = new Date().getHours();
    if (hour < 12) return pick(R.greeting_morning);
    if (hour >= 17) return pick(R.greeting_evening);
    return pick(R.greeting);
  }
  if (analysis.isFarewell) return pick(R.farewell);
  if (analysis.isThanks) return pick(R.thanks);

  const knowledgeAnswer = searchKnowledge(text);
  if (knowledgeAnswer) return knowledgeAnswer;

  const mathAnswer = tryMath(text);
  if (mathAnswer) return mathAnswer;

  if (analysis.topScores.length > 0) {
    const top = analysis.topScores[0];
    if (top.score >= 7) {
      const topicKey = top.topic;
      if (R[topicKey]) return pick(R[topicKey]);
      if (topicKey === "tax" && R.accounting_general) {
        return "Tax ko specific sawal ho — thora detail dinus. Jastai: 'income tax rate single person lai kati?', 'VAT kati %?', 'TDS rate k chha?'";
      }
      if (topicKey === "accounting") return pick(R.accounting_general);
    }
  }

  if (analysis.isAffirmation) return pick(R.affirmation);
  if (analysis.isNegation) return pick(R.negation);

  if (analysis.topScores.some((s) => s.topic === "joke")) return pick(R.joke);

  return pick(R.unknown);
}

/** Transaction signal words — CA-level expanded patterns */
export const TRANSACTION_SIGNALS =
  /\b(\d{2,}|saya|hajar|lakh)\b.*\b(udhaar|udhar|credit|tiryo|tireko|kineko|becheko|bikri|kharcha|expense|purchase|sold|cash\s+ma|nagad|payment\s+gareko|salary|ssf|gratuity|vat|tds|depreciation|loan|capital|drawings|stock|bad\s*debt|discount|contra|bank\s*charge|interest|rent|provision|accrual|prepaid|outstanding|cogs)\b|\b(udhaar|udhar|credit|tiryo|tireko|kineko|becheko|bikri|kharcha|expense|purchase|sold|cash\s+ma|nagad|payment\s+gareko|salary|ssf|gratuity|vat|tds|depreciation|loan|capital|drawings|stock|bad\s*debt|discount|contra|bank\s*charge|interest|rent|provision|accrual|prepaid|outstanding|cogs)\b.*\b(\d{2,}|saya|hajar|lakh)\b/i;

export function shouldTryTransactionParse(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (!t) return false;

  if (TRANSACTION_SIGNALS.test(t)) return true;

  const CA_KEYWORDS = /\b(salary|ssf|gratuity|vat|tds|depreciation|bad\s*debt|provision|accrual|prepaid|outstanding|contra|drawings|capital|cogs|discount)\b/i;
  if (CA_KEYWORDS.test(t) && /\b\d{2,}\b/.test(t)) return true;

  const WEAK_TRANSACTION = /\b(diye|diya|liye|aayo|gayo)\b/i;
  if (WEAK_TRANSACTION.test(t) && /\b\d{2,}\b/.test(t)) {
    if (/\b(k[aeo]?\s+ho|what\s+is|kina|why|kasari|how)\b/i.test(t)) return false;
    return true;
  }

  return false;
}
