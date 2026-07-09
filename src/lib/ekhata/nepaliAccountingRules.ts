/**
 * Nepali Accounting Language Rules — Human-readable knowledge base.
 * 
 * This module provides structured knowledge about:
 * 1. Nepali accounting language patterns
 * 2. Transaction rules and mappings
 * 3. Concept definitions and explanations
 * 
 * Based on Nepali accounting language rules (hisab bhasa ko niyam).
 */

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1: ACCOUNTING LANGUAGE RULES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AccountingRule {
  id: string;
  category: "transaction" | "definition" | "usage" | "pattern";
  nepaliPattern: string;
  englishEquivalent: string;
  meaning: string;
  examples: string[];
  debitAccount?: string;
  creditAccount?: string;
  transactionType?: string;
}

export const ACCOUNTING_RULES: AccountingRule[] = [
  // ─── Payment/Settlement Rules ─────────────────────────────────────────────
  {
    id: "rule_payment_garyo",
    category: "transaction",
    nepaliPattern: "payment garyo",
    englishEquivalent: "payment made",
    meaning: "Payment was made to someone (settling a liability)",
    examples: [
      "Ram lai payment garyo 5000",
      "supplier lai payment garyo",
      "rent payment garyo",
    ],
    debitAccount: "Payable/Expense",
    creditAccount: "Cash/Bank",
    transactionType: "PAYMENT_OUT",
  },
  {
    id: "rule_payment_gareko",
    category: "transaction",
    nepaliPattern: "payment gareko",
    englishEquivalent: "payment done/completed",
    meaning: "Payment has been completed (past tense, perfective)",
    examples: [
      "supplier lai payment gareko",
      "rent ko payment gareko",
    ],
    debitAccount: "Payable/Expense",
    creditAccount: "Cash/Bank",
    transactionType: "PAYMENT_OUT",
  },
  {
    id: "rule_payment_received",
    category: "transaction",
    nepaliPattern: "payment received / payment aayo",
    englishEquivalent: "payment received",
    meaning: "Payment was received from someone (settling a receivable)",
    examples: [
      "Ram bata payment aayo 5000",
      "customer bata payment received",
    ],
    debitAccount: "Cash/Bank",
    creditAccount: "Receivable/Party",
    transactionType: "PAYMENT_IN",
  },
  {
    id: "rule_payment_aayo",
    category: "transaction",
    nepaliPattern: "payment aayo",
    englishEquivalent: "payment came/received",
    meaning: "Payment arrived/received from someone",
    examples: [
      "Ram le payment aayo",
      "customer bata payment aayo",
    ],
    debitAccount: "Cash/Bank",
    creditAccount: "Receivable/Party",
    transactionType: "PAYMENT_IN",
  },
  {
    id: "rule_done_payment_garyo",
    category: "transaction",
    nepaliPattern: "done payment garyo",
    englishEquivalent: "payment completed",
    meaning: "Confirming payment was successfully made",
    examples: [
      "supplier lai done payment garyo",
      "rent ko done payment garyo",
    ],
    debitAccount: "Payable/Expense",
    creditAccount: "Cash/Bank",
    transactionType: "PAYMENT_OUT",
  },

  // ─── Credit Sale Rules (Udhaar) ───────────────────────────────────────────
  {
    id: "rule_udhaar_diye",
    category: "transaction",
    nepaliPattern: "[Party] lai [Amount] udhaar diye",
    englishEquivalent: "Gave [Amount] on credit to [Party]",
    meaning: "Credit sale — goods/services sold on credit, creating a receivable",
    examples: [
      "Ram lai 500 udhaar diye",
      "customer lai 1000 udhaar diye",
      "Shyam lai saman udhaar diye",
    ],
    debitAccount: "Debtors/Party",
    creditAccount: "Sales",
    transactionType: "CREDIT_SALE",
  },
  {
    id: "rule_udhaar_becheko",
    category: "transaction",
    nepaliPattern: "[Amount] ko saman udhaar becheko",
    englishEquivalent: "Sold goods worth [Amount] on credit",
    meaning: "Credit sale with explicit goods mention",
    examples: [
      "500 ko saman udhaar becheko",
      "1000 rupiya ko mal udhaar becheko",
    ],
    debitAccount: "Debtors/Party",
    creditAccount: "Sales",
    transactionType: "CREDIT_SALE",
  },

  // ─── Payment Received Rules (Tiryo) ───────────────────────────────────────
  {
    id: "rule_le_tiryo",
    category: "transaction",
    nepaliPattern: "[Party] le [Amount] tiryo",
    englishEquivalent: "[Party] paid [Amount]",
    meaning: "Payment received from party — settles receivable",
    examples: [
      "Ram le 500 tiryo",
      "customer le paisa tiryo",
    ],
    debitAccount: "Cash/Bank",
    creditAccount: "Debtors/Party",
    transactionType: "PAYMENT_IN",
  },

  // ─── Purchase Rules ───────────────────────────────────────────────────────
  {
    id: "rule_saman_kinyo",
    category: "transaction",
    nepaliPattern: "[Amount] ko saman kinyo",
    englishEquivalent: "Bought goods worth [Amount]",
    meaning: "Purchase of goods/inventory",
    examples: [
      "500 ko saman kinyo",
      "1000 rupiya ko maal kharid gareko",
    ],
    debitAccount: "Stock/Purchase",
    creditAccount: "Cash/Payable",
    transactionType: "PURCHASE",
  },

  // ─── Profit/Loss Rules ────────────────────────────────────────────────────
  {
    id: "rule_naafa_bhayo",
    category: "transaction",
    nepaliPattern: "naafa [Amount] bhayo",
    englishEquivalent: "Profit of [Amount]",
    meaning: "Profit gained from a transaction or period",
    examples: [
      "naafa 2000 bhayo",
      "yo mahina naafa bhayo",
    ],
    debitAccount: "P&L Account",
    creditAccount: "Capital/Retained Earnings",
    transactionType: "PROFIT",
  },

  // ─── Expense Rules ────────────────────────────────────────────────────────
  {
    id: "rule_kharcha_garyo",
    category: "transaction",
    nepaliPattern: "[Item] kharcha [Amount]",
    englishEquivalent: "[Item] expense [Amount]",
    meaning: "Expense incurred",
    examples: [
      "bijuli kharcha 500",
      "rent kharcha 10000",
      "office kharcha 2000",
    ],
    debitAccount: "Expense Account",
    creditAccount: "Cash/Bank",
    transactionType: "EXPENSE",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2: CONCEPT DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConceptDefinition {
  id: string;
  terms: string[];  // All terms that refer to this concept
  nepaliName: string;
  englishName: string;
  definition: {
    nepali: string;
    english: string;
  };
  category: string;
  examples?: string[];
  relatedConcepts?: string[];
}

export const CONCEPT_DEFINITIONS: ConceptDefinition[] = [
  // ─── Currency ─────────────────────────────────────────────────────────────
  {
    id: "nrs",
    terms: ["nrs", "npr", "rs", "rupees", "rupiya", "rupaya", "nepali rupees", "nepali rupiya"],
    nepaliName: "नेपाली रुपैया (NPR/NRs)",
    englishName: "Nepali Rupees (NPR/NRs)",
    definition: {
      nepali: "NRs (Nepali Rupees) Nepal ko official mudra ho. Symbol: ₨ wa Rs. ISO code: NPR. Yo Sutra ERP ma sabai rakam default ma NPR ma hunchha. 1 INR = 1.6 NPR (fixed exchange rate India sanga).",
      english: "NRs (Nepali Rupees) is the official currency of Nepal. Symbol: ₨ or Rs. ISO code: NPR. In this ERP, all amounts are in NPR by default. 1 INR = 1.6 NPR (fixed exchange rate with India).",
    },
    category: "currency",
    examples: ["Rs. 500", "NPR 1000", "NRs. 5000"],
    relatedConcepts: ["money", "currency", "paisa"],
  },

  // ─── UI/Settings ──────────────────────────────────────────────────────────
  {
    id: "language_select",
    terms: ["language", "bhasa", "bhasha", "language select", "language change", "भाषा"],
    nepaliName: "भाषा छान्नुहोस्",
    englishName: "Language Selection",
    definition: {
      nepali: "Language select garna:\n1. Chat window ko header ma **language icon** (🌐) click garnus\n2. Nepali, English, wa Auto-detect choose garnus\n3. Settings > Preferences ma pani change garna sakincha\n\nWa directly afno preferred language ma type garnus — ma duitai Nepali ra English bujhchhu!",
      english: "To select language:\n1. Click the **language icon** (🌐) in the chat header\n2. Choose Nepali, English, or Auto-detect\n3. You can also change it in Settings > Preferences\n\nOr simply type in your preferred language — I understand both Nepali and English!",
    },
    category: "settings",
    examples: ["language change garne", "bhasa kasari select garne", "how to change language"],
  },

  // ─── Accounting Concepts ──────────────────────────────────────────────────
  {
    id: "udhaar",
    terms: ["udhaar", "udhar", "udharo", "credit", "on credit", "उधारो", "उधार"],
    nepaliName: "उधारो (Credit)",
    englishName: "Credit / On Credit",
    definition: {
      nepali: "Udhaar vaneko paisa pachhi dine/line gari saman kinne wa bechne ho. Bikri ma udhaar = Receivable (party le dinubhaeko); Kharid ma udhaar = Payable (hamile dinuparcha). Yo hisab kitab ma important concept ho.",
      english: "Udhaar (credit) means buying or selling goods with payment to be made later. Credit sale = Receivable (party owes us); Credit purchase = Payable (we owe supplier). This is a fundamental accounting concept.",
    },
    category: "accounting",
    examples: ["udhaar diye", "udhaar kineko", "udhaar baki"],
    relatedConcepts: ["receivable", "payable", "outstanding"],
  },

  {
    id: "khata",
    terms: ["khata", "ledger", "account", "hisab", "खाता", "हिसाब"],
    nepaliName: "खाता (Ledger)",
    englishName: "Ledger / Account",
    definition: {
      nepali: "Khata vaneko party-wise wa account-wise paisa aune-jane record ho. Har ek party ko alag khata hunchha — kati dinu paryo, kati paaunu paryo sabai record hunchha. Double-entry system ma har transaction ma debit = credit hunchha.",
      english: "Khata (ledger) is the record of money in/out for each party or account. Every party has a separate ledger showing receivables and payables. In double-entry system, every transaction has debit = credit.",
    },
    category: "accounting",
    examples: ["Ram ko khata", "party ledger", "hisab kitab"],
    relatedConcepts: ["journal", "debit", "credit"],
  },

  {
    id: "debit_credit",
    terms: ["debit", "credit", "dr", "cr", "jama", "kharcha"],
    nepaliName: "डेबिट र क्रेडिट",
    englishName: "Debit and Credit",
    definition: {
      nepali: "Debit (Dr) = baaya taraf, Credit (Cr) = daaya taraf.\n\n• Asset badhda → Debit\n• Asset ghatda → Credit\n• Liability badhda → Credit\n• Liability ghatda → Debit\n• Income → Credit\n• Expense → Debit\n\nDouble entry: har ek transaction ma Total Debit = Total Credit hunu parchha.",
      english: "Debit (Dr) = left side, Credit (Cr) = right side.\n\n• Asset increases → Debit\n• Asset decreases → Credit\n• Liability increases → Credit\n• Liability decreases → Debit\n• Income → Credit\n• Expense → Debit\n\nDouble entry: every transaction must have Total Debit = Total Credit.",
    },
    category: "accounting",
    examples: ["debit cash", "credit sales", "debit expense"],
    relatedConcepts: ["journal", "ledger", "double entry"],
  },

  {
    id: "vat",
    terms: ["vat", "value added tax", "mulya thap kar", "vat 13%"],
    nepaliName: "मूल्य अभिवृद्धि कर (VAT)",
    englishName: "Value Added Tax (VAT)",
    definition: {
      nepali: "Nepal ma VAT 13% ho. Rs. 50 lakh bhanda badi annual turnover bhaye VAT registration mandatory ho. VAT registered business le bikri ma VAT charge garchha (Output VAT) ra kharid ma VAT pay garchha (Input VAT). Net VAT = Output - Input → IRD lai tirne.",
      english: "VAT in Nepal is 13%. VAT registration is mandatory for businesses with annual turnover exceeding Rs. 50 lakh. VAT registered businesses charge VAT on sales (Output VAT) and pay VAT on purchases (Input VAT). Net VAT = Output - Input → payable to IRD.",
    },
    category: "tax",
    examples: ["13% VAT", "VAT invoice", "VAT return"],
    relatedConcepts: ["tax", "ird", "pan"],
  },

  // ─── Orbix/AI Concepts ────────────────────────────────────────────────────
  {
    id: "orbix",
    terms: ["orbix", "ekhata", "e-khata", "khata ai", "sutra ai"],
    nepaliName: "Orbix (इ-खाता AI)",
    englishName: "Orbix (e-Khata AI)",
    definition: {
      nepali: "Orbix tapaiko personal accounting AI assistant ho — Sutra ERP ko bhag. Ma Nepali, English ra mixed language bujhchhu. Transaction record garna, accounting sawal sodhna, tax jankari lina — sabai Orbix sanga garna sakincha. Ma self-contained chhu — kuni external API chaahidaina.",
      english: "Orbix is your personal accounting AI assistant — part of Sutra ERP. I understand Nepali, English, and mixed language. Record transactions, ask accounting questions, get tax info — all with Orbix. I'm self-contained — no external API required.",
    },
    category: "system",
    examples: ["Orbix k ho?", "ekhata kasari use garne?"],
    relatedConcepts: ["sutra erp", "khata", "ai"],
  },

  {
    id: "accounting_mode",
    terms: ["accounting mode", "mode", "khata mode", "entry mode"],
    nepaliName: "Accounting Mode",
    englishName: "Accounting Mode",
    definition: {
      nepali: "Accounting Mode ma Orbix tapaiko transaction entries bujhchha ra journal vouchers banaucha. 'Ram lai 500 udhaar diye' jasto lekhda, Orbix le automatically debit-credit entry tayar garchha. Mode change garna top-right ma setting icon ma click garnus.",
      english: "In Accounting Mode, Orbix understands your transaction entries and creates journal vouchers. When you type 'Ram lai 500 udhaar diye', Orbix automatically prepares the debit-credit entry. To change modes, click the settings icon in top-right.",
    },
    category: "system",
    examples: ["accounting mode k ho?", "mode kasari change garne?"],
  },

  // ─── More Accounting Concepts ─────────────────────────────────────────────
  {
    id: "balance_sheet",
    terms: ["balance sheet", "bs", "sthiti vivaran", "sampatti dayitwo", "financial position"],
    nepaliName: "बैलेन्स शीट (स्थिति विवरण)",
    englishName: "Balance Sheet",
    definition: {
      nepali: "Balance Sheet (Sthiti Vivaran) le company ko kun samay ma kati sampatti (assets), kati rin (liabilities), ra kati malik ko lagaani (equity) chha bhanera dekhaucha. Yo accounting ko sabse important report ho — Assets = Liabilities + Equity formula follow garchha.",
      english: "Balance Sheet shows a company's financial position at a point in time — how much assets, liabilities, and equity it has. It's the most important accounting report following the formula: Assets = Liabilities + Equity.",
    },
    category: "report",
    examples: ["balance sheet k ho?", "BS hernu", "sampatti dayitwo"],
    relatedConcepts: ["asset", "liability", "equity"],
  },

  {
    id: "profit_loss",
    terms: ["profit loss", "p&l", "pl", "nafa noksan", "income statement", "profit and loss"],
    nepaliName: "नाफा नोक्सान विवरण",
    englishName: "Profit & Loss Statement",
    definition: {
      nepali: "Profit & Loss Statement (Nafa Noksan Vivaran) le ek fiscal year ma kati income aayo ra kati expense bhayo bhanera dekhaucha. Income - Expenses = Net Profit/Loss. Yo business ko performance measure garne report ho.",
      english: "Profit & Loss Statement shows income earned and expenses incurred over a period. Income - Expenses = Net Profit/Loss. It measures the performance of a business.",
    },
    category: "report",
    examples: ["P&L k ho?", "nafa noksan report"],
    relatedConcepts: ["income", "expense", "profit"],
  },

  {
    id: "journal",
    terms: ["journal", "journal entry", "voucher", "journal voucher"],
    nepaliName: "जर्नल (प्रारम्भिक लेखा)",
    englishName: "Journal Entry",
    definition: {
      nepali: "Journal vaneko har ek transaction ko pehilo record ho — debit ra credit account, amount, date, ra narration sahit. Double-entry system ma har transaction ma ek account debit ra arko credit hunchha. Total Debit = Total Credit hunu parchha.",
      english: "Journal is the first record of every transaction — with debit and credit accounts, amount, date, and narration. In double-entry system, every transaction debits one account and credits another. Total Debit = Total Credit.",
    },
    category: "accounting",
    examples: ["journal entry k ho?", "voucher kasari banauney?"],
    relatedConcepts: ["debit", "credit", "ledger"],
  },

  {
    id: "trial_balance",
    terms: ["trial balance", "tb", "parikshan lekha"],
    nepaliName: "ट्रायल बैलेन्स",
    englishName: "Trial Balance",
    definition: {
      nepali: "Trial Balance le sabai ledger accounts ko debit ra credit totals ek thau ma dekhaucha. Debit total = Credit total hunu parchha — natra journal entries ma galti chha. Yo financial statements banaunnu aghi check garne report ho.",
      english: "Trial Balance lists all ledger account balances in one place. Total Debits must equal Total Credits — if not, there are errors in journal entries. It's verified before preparing financial statements.",
    },
    category: "report",
    examples: ["trial balance k ho?", "TB hernu"],
    relatedConcepts: ["ledger", "debit", "credit"],
  },

  {
    id: "tds",
    terms: ["tds", "tax deducted at source", "source ma kar"],
    nepaliName: "TDS (स्रोतमा कर)",
    englishName: "Tax Deducted at Source (TDS)",
    definition: {
      nepali: "TDS (Tax Deducted at Source) Nepal ma payment gareko bela nai kar katne system ho. Service contract 1.5%, House rent 10%, Consultancy 15%, Interest 5-15%, Dividend 5%. TDS kateko pachi IRD lai jamma garne.",
      english: "TDS (Tax Deducted at Source) is the system where tax is deducted when making payments. Service contract 1.5%, House rent 10%, Consultancy 15%, Interest 5-15%, Dividend 5%. TDS collected is remitted to IRD.",
    },
    category: "tax",
    examples: ["TDS rate kati?", "TDS kasari katne?"],
    relatedConcepts: ["tax", "ird", "income tax"],
  },

  {
    id: "receivable",
    terms: ["receivable", "debtor", "sundry debtor", "lina baki", "paauna baki"],
    nepaliName: "प्राप्य (Receivable)",
    englishName: "Accounts Receivable",
    definition: {
      nepali: "Receivable (Lina Baki) vaneko arule tapailai dinu parne paisa ho — udhaar bikri gareko party le dinu baki. Yo asset ho. Journal: Dr Party A/c, Cr Sales.",
      english: "Receivable (Accounts Receivable) is money others owe you — from credit sales. It's an asset. Journal entry: Dr Party A/c, Cr Sales.",
    },
    category: "accounting",
    examples: ["receivable k ho?", "debtor meaning"],
    relatedConcepts: ["credit sale", "asset", "party"],
  },

  {
    id: "payable",
    terms: ["payable", "creditor", "sundry creditor", "tirna baki", "dinu baki"],
    nepaliName: "भुक्तानी योग्य (Payable)",
    englishName: "Accounts Payable",
    definition: {
      nepali: "Payable (Tirna Baki) vaneko tapai le arulai dinu parne paisa ho — udhaar kharid gareko supplier lai. Yo liability ho. Journal: Dr Purchase, Cr Supplier A/c.",
      english: "Payable (Accounts Payable) is money you owe others — from credit purchases. It's a liability. Journal entry: Dr Purchase, Cr Supplier A/c.",
    },
    category: "accounting",
    examples: ["payable k ho?", "creditor meaning"],
    relatedConcepts: ["credit purchase", "liability", "supplier"],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3: LOOKUP FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Find accounting rule by pattern or keyword.
 */
export function findAccountingRule(text: string): AccountingRule | null {
  const normalized = text.toLowerCase().trim();
  
  for (const rule of ACCOUNTING_RULES) {
    // Check pattern
    if (normalized.includes(rule.nepaliPattern.toLowerCase())) {
      return rule;
    }
    // Check examples
    for (const example of rule.examples) {
      if (normalized.includes(example.toLowerCase()) || 
          example.toLowerCase().includes(normalized)) {
        return rule;
      }
    }
  }
  
  return null;
}

/**
 * Find concept definition by term.
 */
export function findConceptDefinition(text: string): ConceptDefinition | null {
  const normalized = text.toLowerCase().trim();
  
  // Remove common question patterns to extract the term
  const cleanedText = normalized
    .replace(/\b(k\s*ho|ke\s*ho|what\s*is|what\s*are|explain|define|meaning|arth|matlab)\b/gi, "")
    .replace(/[?।।.!]/g, "")
    .trim();
  
  for (const concept of CONCEPT_DEFINITIONS) {
    for (const term of concept.terms) {
      if (cleanedText.includes(term.toLowerCase()) || 
          term.toLowerCase().includes(cleanedText)) {
        return concept;
      }
    }
  }
  
  return null;
}

/**
 * Format concept definition for display.
 */
export function formatConceptAnswer(concept: ConceptDefinition, language: "nepali" | "english" | "mixed"): string {
  const def = language === "english" ? concept.definition.english : concept.definition.nepali;
  const name = language === "english" ? concept.englishName : concept.nepaliName;
  
  let answer = `**${name}**\n\n${def}`;
  
  if (concept.examples && concept.examples.length > 0) {
    answer += `\n\n**${language === "english" ? "Examples" : "Udaharan"}:** ${concept.examples.join(", ")}`;
  }
  
  return answer;
}

/**
 * Format accounting rule for display.
 */
export function formatRuleAnswer(rule: AccountingRule, language: "nepali" | "english" | "mixed"): string {
  if (language === "english") {
    return `**${rule.englishEquivalent}**\n\n${rule.meaning}\n\n` +
      `**Pattern:** ${rule.nepaliPattern}\n` +
      `**Examples:**\n${rule.examples.map(e => `• ${e}`).join("\n")}\n\n` +
      (rule.debitAccount ? `**Debit:** ${rule.debitAccount}\n**Credit:** ${rule.creditAccount}` : "");
  }
  
  return `**${rule.nepaliPattern}** (${rule.englishEquivalent})\n\n${rule.meaning}\n\n` +
    `**Udaharan:**\n${rule.examples.map(e => `• ${e}`).join("\n")}\n\n` +
    (rule.debitAccount ? `**Debit:** ${rule.debitAccount}\n**Credit:** ${rule.creditAccount}` : "");
}

/**
 * Get all rules as formatted list for display.
 */
export function getFormattedRulesList(language: "nepali" | "english" | "mixed"): string {
  const header = language === "english" 
    ? "Based on Nepali accounting language rules:"
    : "Nepali hisab bhasa ko niyam anusar:";
  
  const paymentRules = ACCOUNTING_RULES
    .filter(r => r.nepaliPattern.includes("payment") || r.nepaliPattern.includes("tiryo"))
    .slice(0, 6);
  
  const lines = paymentRules.map(rule => `• ${rule.nepaliPattern}`);
  
  return `${header}\n\n${lines.join("\n")}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4: UNIFIED ANSWER FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Try to answer a question using the knowledge base.
 * Returns null if no answer found.
 */
export function answerFromKnowledgeBase(
  text: string, 
  language: "nepali" | "english" | "mixed"
): { answer: string; confidence: number; source: "concept" | "rule" } | null {
  
  // Try concept definitions first (for "X k ho?" / "what is X?" questions)
  const concept = findConceptDefinition(text);
  if (concept) {
    return {
      answer: formatConceptAnswer(concept, language),
      confidence: 0.92,
      source: "concept",
    };
  }
  
  // Try accounting rules (for transaction pattern questions)
  const rule = findAccountingRule(text);
  if (rule) {
    return {
      answer: formatRuleAnswer(rule, language),
      confidence: 0.88,
      source: "rule",
    };
  }
  
  return null;
}
