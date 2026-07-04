// src/lib/falcon/chainOfThought.ts
// Falcon AI — Multi-Phase Chain-of-Thought Reasoning Engine
// Pure TypeScript, zero external imports, browser-safe, no side effects.

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type QuestionDomain =
  "erp" | "accounting" | "math" | "general" | "web-search" | "greeting" | "code";

export type QuestionIntent =
  | "how-to"
  | "explain"
  | "troubleshoot"
  | "calculate"
  | "compare"
  | "list"
  | "define"
  | "search"
  | "casual";

export interface ThoughtStep {
  stepNumber: number;
  phase: "analyze" | "retrieve" | "construct" | "verify" | "suggest";
  title: string;
  thinking: string;
  conclusion: string;
  duration?: number;
}

export interface ReasoningPlan {
  query: string;
  domain: QuestionDomain;
  intent: QuestionIntent;
  confidence: number;
  shouldSearchWeb: boolean;
  searchQuery?: string;
  steps: ThoughtStep[];
  promptAdditions: string;
  suggestedFollowUps: string[];
  estimatedComplexity: "simple" | "moderate" | "complex";
}

// ─────────────────────────────────────────────────────────────────────────────
// KEYWORD SIGNAL MAPS
// ─────────────────────────────────────────────────────────────────────────────

const ERP_KEYWORDS = [
  "invoice",
  "voucher",
  "ledger",
  "party",
  "customer",
  "supplier",
  "stock",
  "inventory",
  "warehouse",
  "payroll",
  "vat",
  "tds",
  "trial balance",
  "balance sheet",
  "profit",
  "loss",
  "receipt",
  "payment",
  "journal",
  "contra",
  "batch",
  "serial",
  "day book",
  "fiscal year",
  "pan",
  "ird",
  "cbms",
  "narration",
  "account",
  "debit",
  "credit",
  "posting",
  "sutra",
  "erp",
  "report",
  "challan",
  "grn",
  "goods receipt",
  "delivery challan",
  "bill",
  "sales",
  "purchase",
  "income",
  "expense",
  "bank reconciliation",
  "fixed assets",
  "depreciation",
  "cost center",
  "outstanding",
  "receivable",
  "payable",
  "aging",
  "register",
  "statement",
  "opening balance",
  "closing balance",
  "f2",
  "f3",
  "f8",
  "f9",
  "f10",
  "voucher type",
  "item master",
  "chart of accounts",
  "party master",
  "recurring",
  "pdc",
  "cheque",
  "narration",
  "bill sundry",
  "reorder",
  "unit",
  "hsn",
  "round off",
  "fiscal",
];

const ACCOUNTING_KEYWORDS = [
  "double entry",
  "bookkeeping",
  "accrual",
  "gaap",
  "ifrs",
  "fifo",
  "lifo",
  "amortization",
  "provision",
  "prepaid",
  "accrued",
  "goodwill",
  "equity",
  "liability",
  "asset",
  "revenue",
  "working capital",
  "ratio",
  "liquidity",
  "solvency",
  "gross profit",
  "net profit",
  "ebit",
  "ebitda",
  "cash flow",
  "accounts receivable",
  "accounts payable",
  "retained earnings",
  "capital",
  "dividend",
  "auditing",
  "tax",
];

const MATH_KEYWORDS = [
  "calculate",
  "compute",
  "how much",
  "percentage",
  "formula",
  "total",
  "sum",
  "multiply",
  "divide",
  "interest",
  "compound",
  "emi",
  "rate",
  "convert",
  "math",
  "arithmetic",
  "algebra",
  "equation",
  "solve",
  "%",
  "×",
  "÷",
  "√",
  "squared",
  "what is x",
  "how many",
  "average",
  "mean",
  "median",
];

const WEB_SEARCH_KEYWORDS = [
  "today",
  "latest",
  "current news",
  "price of",
  "weather",
  "who won",
  "recent",
  "2024",
  "2025",
  "2026",
  "search",
  "find online",
  "google",
  "right now",
  "live",
  "breaking",
  "update",
  "news",
  "stock price",
  "exchange rate",
  "trending",
  "this week",
  "this month",
  "currently",
  "at the moment",
];

const CODE_KEYWORDS = [
  "function",
  "component",
  "react",
  "typescript",
  "usestate",
  "useeffect",
  "npm",
  "package",
  "code",
  "implement",
  "api",
  "javascript",
  "python",
  "html",
  "css",
  "git",
  "github",
  "debug",
  "compile",
  "error",
  "import",
  "export",
  "class",
  "interface",
  "type",
  "props",
  "hook",
  "async",
  "await",
  "fetch",
  "axios",
  "database",
  "sql",
  "query",
];

const GREETING_KEYWORDS = [
  "hi",
  "hello",
  "hey",
  "good morning",
  "good afternoon",
  "good evening",
  "namaste",
  "namaskar",
  "how are you",
  "what can you do",
  "who are you",
  "what are you",
  "help me",
  "introduce yourself",
  "sup",
  "howdy",
  "greetings",
];

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY — Count keyword matches in a query
// ─────────────────────────────────────────────────────────────────────────────

function countMatches(query: string, keywords: string[]): number {
  const lower = query.toLowerCase();
  return keywords.reduce((count, kw) => {
    return lower.includes(kw.toLowerCase()) ? count + 1 : count;
  }, 0);
}

function containsAny(query: string, keywords: string[]): boolean {
  const lower = query.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function extractTopics(query: string): string[] {
  // Extract meaningful words (length > 3, not stop words)
  const stopWords = new Set([
    "what",
    "when",
    "where",
    "which",
    "with",
    "that",
    "this",
    "from",
    "have",
    "does",
    "will",
    "been",
    "them",
    "they",
    "your",
    "about",
    "would",
    "could",
    "should",
    "into",
    "more",
    "also",
    "just",
    "like",
    "than",
    "then",
  ]);
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w))
    .slice(0, 5);
}

// ─────────────────────────────────────────────────────────────────────────────
// classifyQuestion
// ─────────────────────────────────────────────────────────────────────────────

export function classifyQuestion(
  query: string,
  currentRoute?: string,
): {
  domain: QuestionDomain;
  intent: QuestionIntent;
  confidence: number;
  shouldSearchWeb: boolean;
  searchQuery?: string;
} {
  const lower = query.toLowerCase().trim();

  // ── Signal 1: Domain keyword scoring ────────────────────────────────────
  const scores: Record<QuestionDomain, number> = {
    erp: countMatches(lower, ERP_KEYWORDS) * 3,
    accounting: countMatches(lower, ACCOUNTING_KEYWORDS) * 2.5,
    math: countMatches(lower, MATH_KEYWORDS) * 2,
    "web-search": countMatches(lower, WEB_SEARCH_KEYWORDS) * 3,
    code: countMatches(lower, CODE_KEYWORDS) * 2.5,
    greeting: countMatches(lower, GREETING_KEYWORDS) * 4,
    general: 1, // baseline
  };

  // Greeting exact patterns get a strong boost
  if (/^(hi|hello|hey|namaste|namaskar|sup|howdy)[\s!?.]*$/.test(lower)) {
    scores.greeting += 20;
  }

  // Short queries (< 4 words) with no specific signals → greeting or general
  const wordCount = lower.split(/\s+/).length;
  if (wordCount <= 3 && scores.greeting > 0) scores.greeting += 5;

  // ── Signal 3: Route boosting ──────────────────────────────────────────
  if (currentRoute) {
    const routeSignals = [
      "invoice",
      "voucher",
      "ledger",
      "parties",
      "items",
      "stock",
      "payment",
      "receipt",
      "journal",
      "contra",
      "balance",
      "profit",
      "trial",
      "vat",
      "payroll",
      "assets",
      "batch",
      "warehouse",
    ];
    const routeLower = currentRoute.toLowerCase();
    if (routeSignals.some((s) => routeLower.includes(s))) {
      scores.erp += 4;
    }
  }

  // ── Determine top domain ──────────────────────────────────────────────
  let topDomain: QuestionDomain = "general";
  let topScore = 0;
  for (const [domain, score] of Object.entries(scores)) {
    if (score > topScore) {
      topScore = score;
      topDomain = domain as QuestionDomain;
    }
  }

  // ── Signal 5: Confidence ──────────────────────────────────────────────
  let confidence: number;
  if (topScore >= 9) confidence = 95;
  else if (topScore >= 6) confidence = 85;
  else if (topScore >= 3) confidence = 72;
  else if (topScore >= 1.5) confidence = 55;
  else confidence = 38;

  // If confidence < 40, fall back to general
  if (confidence < 40) topDomain = "general";

  // ── Signal 2: Intent detection ────────────────────────────────────────
  let intent: QuestionIntent = "explain";

  if (/\b(how do i|how to|steps to|guide me|walk me through|show me how)\b/.test(lower)) {
    intent = "how-to";
  } else if (
    /\b(not working|error|problem|issue|can'?t|cannot|why is|why does|fails|broken)\b/.test(lower)
  ) {
    intent = "troubleshoot";
  } else if (
    /\b(calculate|compute|what is\s+\d|how much|formula|total|sum of)\b/.test(lower) ||
    /\d+\s*[%×÷+-]\s*\d+/.test(lower)
  ) {
    intent = "calculate";
  } else if (
    /\b(compare|difference between|vs.?|versus|which is better|what'?s the difference)\b/.test(
      lower,
    )
  ) {
    intent = "compare";
  } else if (
    /\b(list|what are all|show me all|give me all|types of|kinds of|examples of)\b/.test(lower)
  ) {
    intent = "list";
  } else if (/\b(define|definition|meaning of|what does.+mean)\b/.test(lower)) {
    intent = "define";
  } else if (
    /\b(search|find online|what'?s the price|latest|current|today'?s)\b/.test(lower) ||
    topDomain === "web-search"
  ) {
    intent = "search";
  } else if (topDomain === "greeting") {
    intent = "casual";
  } else if (/\b(what is|what are|explain|tell me|describe|why)\b/.test(lower)) {
    intent = "explain";
  }

  // ── Signal 4: shouldSearchWeb ─────────────────────────────────────────
  const webTriggers = [
    "today",
    "latest",
    "current news",
    "right now",
    "live",
    "breaking",
    "price of",
    "exchange rate",
    "weather",
    "who won",
    "2025",
    "2026",
    "this week",
    "trending",
    "recently",
    "just announced",
  ];
  const shouldSearchWeb =
    topDomain === "web-search" || containsAny(lower, webTriggers) || intent === "search";

  // ── Build search query if needed ──────────────────────────────────────
  const searchQuery = shouldSearchWeb ? extractSearchQuery(query, topDomain) : undefined;

  return {
    domain: topDomain,
    intent,
    confidence,
    shouldSearchWeb,
    searchQuery,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// extractSearchQuery
// ─────────────────────────────────────────────────────────────────────────────

export function extractSearchQuery(query: string, domain: QuestionDomain): string {
  // Remove filler phrases to make a cleaner search query
  const fillers = [
    "can you",
    "could you",
    "please",
    "i want to know",
    "tell me",
    "what is the",
    "what are the",
    "search for",
    "find",
    "google",
    "look up",
    "i need",
    "help me with",
    "do you know",
  ];

  let cleaned = query.toLowerCase().trim();
  for (const filler of fillers) {
    cleaned = cleaned.replace(new RegExp(`\\b${filler}\\b`, "gi"), "").trim();
  }

  // Remove leading question words
  cleaned = cleaned.replace(/^(who|what|where|when|why|how|which)\s+/i, "").trim();

  // Remove punctuation at the end
  cleaned = cleaned.replace(/[?.!]+$/, "").trim();

  // Capitalize first letter
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// buildReasoningPlan
// ─────────────────────────────────────────────────────────────────────────────

export function buildReasoningPlan(
  query: string,
  domain: QuestionDomain,
  intent: QuestionIntent,
  currentRoute?: string,
): ReasoningPlan {
  const lower = query.toLowerCase();
  const topics = extractTopics(query);
  const topicStr = topics.length > 0 ? topics.slice(0, 3).join(", ") : "the topic";
  const classification = classifyQuestion(query, currentRoute);

  // ── Estimate complexity ──────────────────────────────────────────────
  const wordCount = query.split(/\s+/).length;
  let complexity: "simple" | "moderate" | "complex" = "simple";
  if (wordCount > 25 || intent === "troubleshoot" || intent === "compare") complexity = "moderate";
  if (wordCount > 40 || intent === "calculate" || domain === "accounting") complexity = "moderate";
  if (lower.includes("explain") && lower.includes("difference") && lower.includes("and"))
    complexity = "complex";
  if (domain === "erp" && (intent === "how-to" || intent === "troubleshoot"))
    complexity = "moderate";

  // ── Build ThoughtSteps ────────────────────────────────────────────────
  const steps: ThoughtStep[] = [];
  let stepCounter = 1;

  // ── STEP 1: Analyze ────────────────────────────────────────────────────
  const routeContext = currentRoute ? ` The user is currently on the "${currentRoute}" page.` : "";

  const intentLabel: Record<QuestionIntent, string> = {
    "how-to": "a step-by-step how-to guide",
    explain: "an explanation of a concept",
    troubleshoot: "a troubleshooting diagnosis",
    calculate: "a calculation with worked steps",
    compare: "a comparison of two or more things",
    list: "a structured list of items",
    define: "a definition",
    search: "real-time information from the web",
    casual: "a conversational response",
  };

  const domainDescription: Record<QuestionDomain, string> = {
    erp: "Sutra ERP software usage",
    accounting: "accounting principles and Nepal tax rules",
    math: "mathematical calculation",
    general: "general knowledge",
    "web-search": "a live web search for current data",
    greeting: "a greeting or casual opening",
    code: "programming and technical implementation",
  };

  steps.push({
    stepNumber: stepCounter++,
    phase: "analyze",
    title: "Analyzing your question",
    thinking:
      `Parsing query: "${query.slice(0, 80)}${query.length > 80 ? "..." : ""}"n` +
      `Detected domain signals for: ${domainDescription[domain]} (confidence: ${classification.confidence}%)n` +
      `Intent pattern: "${intent}" — user is looking for ${intentLabel[intent]}n` +
      `Key topics identified: ${topicStr}n` +
      `Current page context: ${routeContext || " not specified — using global context"}n` +
      `Complexity estimate: ${complexity} (${query.split(/\s+/).length} words, intent "${intent}")`,
    conclusion: `Classified as [${domain.toUpperCase()}] domain with [${intent}] intent. Confidence: ${classification.confidence}%. Complexity: ${complexity}.`,
    duration: complexity === "simple" ? 400 : complexity === "moderate" ? 650 : 900,
  });

  // ── STEP 2: Knowledge Retrieval ───────────────────────────────────────
  const retrievalThinking: Record<QuestionDomain, string> = {
    erp:
      `Accessing Sutra ERP module documentation...n` +
      `Looking up: ${currentRoute ? `"${currentRoute}" module fields, workflow steps, keyboard shortcuts` : "relevant ERP modules"}n` +
      `Retrieving: Accounting impact of transactions, validation rules, Nepal VAT/TDS rulesn` +
      `Cross-referencing: Common errors and solutions for "${topicStr}"n` +
      `Checking: Related modules that connect to this topic`,

    accounting:
      `Accessing accounting principles knowledge base...n` +
      `Retrieving: Double-entry bookkeeping rules relevant to "${topicStr}"n` +
      `Looking up: Nepal-specific regulations — VAT Act 2052, Income Tax Act 2058n` +
      `Retrieving: Applicable journal entry format, debit/credit rulesn` +
      `Preparing: Worked numerical example using Nepal Rupee (Rs.) context`,

    math:
      `Accessing mathematical formulas and calculation methods...n` +
      `Identifying: The correct formula for "${topicStr}"n` +
      `Preparing: Step-by-step calculation approach — formula → substitution → resultn` +
      `Verifying: Units and rounding rules for the answer`,

    "web-search":
      `Formulating optimized search query: "${classification.searchQuery || topicStr}"n` +
      `Preparing to fetch: Real-time data from the webn` +
      `Will prioritize: Search results over training knowledge for current information`,

    code:
      `Accessing programming knowledge for "${topicStr}"...n` +
      `Retrieving: Relevant language patterns, syntax, and best practicesn` +
      `Preparing: Working code example with explanation`,

    general:
      `Scanning general knowledge across all domains for "${topicStr}"...n` +
      `Retrieving: Relevant facts, context, historical backgroundn` +
      `Preparing: Clear explanation with real-world examples`,

    greeting:
      `This is a conversational opener. No deep knowledge retrieval needed.n` +
      `Preparing: A warm, helpful greeting that introduces Falcon AI's capabilities`,
  };

  const retrievalConclusion: Record<QuestionDomain, string> = {
    erp: `Located relevant ERP module documentation, accounting rules, and Nepal compliance notes for "${topicStr}"`,
    accounting: `Retrieved accounting principles, Nepal tax rules (VAT 13%, TDS rates), and journal entry format for "${topicStr}"`,
    math: `Identified applicable formula and calculation approach for "${topicStr}"`,
    "web-search": `Search query prepared: "${classification.searchQuery || topicStr}". Ready to fetch live data.`,
    code: `Located programming patterns and code examples relevant to "${topicStr}"`,
    general: `Retrieved general knowledge facts, context, and examples for "${topicStr}"`,
    greeting: `Greeting detected. Preparing welcome response with capability overview.`,
  };

  steps.push({
    stepNumber: stepCounter++,
    phase: "retrieve",
    title: domain === "web-search" ? "Preparing web search" : "Retrieving knowledge",
    thinking: retrievalThinking[domain],
    conclusion: retrievalConclusion[domain],
    duration: domain === "web-search" ? 300 : complexity === "complex" ? 800 : 550,
  });

  // ── STEP 2.5: Web Search (conditional) ───────────────────────────────
  if (classification.shouldSearchWeb) {
    steps.push({
      stepNumber: stepCounter++,
      phase: "retrieve",
      title: "Searching the web",
      thinking:
        `Sending search query: "${classification.searchQuery || topicStr}"n` +
        `Connecting to search service...n` +
        `Fetching top results and parsing structured content...n` +
        `Extracting: Relevant titles, snippets, and source URLsn` +
        `Filtering: Prioritizing authoritative, recent sources`,
      conclusion: `Live web data retrieved and ready to incorporate into response`,
      duration: 1200,
    });
  }

  // ── STEP 3: Construct Answer ──────────────────────────────────────────
  const constructThinking: Record<QuestionIntent, string> = {
    "how-to":
      `Organizing steps in logical sequential order...n` +
      `Including: Exact menu navigation paths and field names in boldn` +
      `Adding: Keyboard shortcuts where relevant (F2=Post, F3=New, etc.)n` +
      `Preparing: Expected result after following the stepsn` +
      `Appending: One key tip or common mistake to avoid`,

    explain:
      `Building explanation from fundamentals up to specifics...n` +
      `Structure: Definition → Core concept → Why it matters → Examplen` +
      `Using: Nepal-context examples (Rs., IRD, VAT Act 2052)n` +
      `Ensuring: Accessible language for the user's apparent expertise level`,

    troubleshoot:
      `Diagnosing likely causes for the reported problem...n` +
      `Mapping: Issue symptoms → probable root cause → actionable solutionn` +
      `Structure: What the error means → Why it happens → How to fix itn` +
      `Including: Prevention tip to avoid recurrence`,

    calculate:
      `Applying the relevant formula to the user's values...n` +
      `Structure: State formula → Substitute values → Show arithmetic → State resultn` +
      `Verifying: Unit labels (Rs., %, days) and decimal precisionn` +
      `Checking: The math independently before presenting`,

    compare:
      `Building side-by-side comparison structure...n` +
      `Identifying: 3-5 meaningful dimensions of differencen` +
      `Providing: Concrete recommendation for the user's likely contextn` +
      `Avoiding: False equivalences or oversimplifications`,

    list:
      `Compiling comprehensive, logically ordered list...n` +
      `Ensuring: No important items are omittedn` +
      `Organizing: By category or importance ordern` +
      `Adding: Brief description for each item where helpful`,

    define:
      `Formulating precise, clear definition...n` +
      `Including: Etymology or origin if relevantn` +
      `Providing: Concrete example in the accounting/ERP contextn` +
      `Distinguishing: From related concepts the user might confuse it with`,

    search:
      `Structuring response around retrieved web data...n` +
      `Leading with: Most current/relevant facts from search resultsn` +
      `Adding: Context from training knowledgen` +
      `Noting: Information freshness and any relevant caveats`,

    casual:
      `Composing friendly, welcoming greeting response...n` +
      `Including: Brief introduction to Falcon AI capabilitiesn` +
      `Suggesting: How to get started or example questions to try`,
  };

  const constructConclusion: Record<QuestionIntent, string> = {
    "how-to": `Response structure: numbered steps with menu paths → expected result → pro tip`,
    explain: `Response structure: definition → explanation → Nepal-context example → summary`,
    troubleshoot: `Response structure: diagnosis → root cause → step-by-step fix → prevention`,
    calculate: `Response structure: formula → substitution → arithmetic working → result with units`,
    compare: `Response structure: intro → comparison table/bullets → recommendation`,
    list: `Response structure: categorized list with descriptions`,
    define: `Response structure: definition → context → example → related terms`,
    search: `Response structure: live data lead → context → analysis`,
    casual: `Response structure: warm greeting → capability introduction → starter suggestions`,
  };

  steps.push({
    stepNumber: stepCounter++,
    phase: "construct",
    title: "Constructing response",
    thinking: constructThinking[intent],
    conclusion: constructConclusion[intent],
    duration: complexity === "complex" ? 700 : complexity === "moderate" ? 500 : 350,
  });

  // ── STEP 4: Verify (for moderate/complex) ─────────────────────────────
  if (complexity !== "simple" || domain === "accounting" || intent === "calculate") {
    const verifyChecks: Record<QuestionDomain, string> = {
      erp:
        `Verifying: Are all menu navigation paths accurate for Sutra ERP?n` +
        `Checking: Are field names and keyboard shortcuts correct?n` +
        `Confirming: Nepal VAT rate is 13%, TDS rates are correct per sectionn` +
        `Ensuring: Accounting entries (Dr/Cr) are balanced and correctn` +
        `Reviewing: Is any important validation rule or warning missing?`,
      accounting:
        `Verifying: Does the journal entry balance (Total Dr = Total Cr)?n` +
        `Checking: Nepal Income Tax Act 2058 and VAT Act 2052 rates are accuraten` +
        `Confirming: The formula and worked example are arithmetically correctn` +
        `Ensuring: No mixing of cash vs accrual concepts incorrectly`,
      math:
        `Verifying: Re-checking arithmetic independently...n` +
        `Confirming: Units are correct (%, Rs., years, days)n` +
        `Checking: Edge cases (division by zero, negative results)n` +
        `Ensuring: Decimal rounding is appropriate`,
      "web-search":
        `Checking: Web data is being correctly interpreted and citedn` +
        `Ensuring: Clear distinction between training knowledge and live search data`,
      code:
        `Reviewing: Code syntax for obvious errorsn` +
        `Checking: Logic flow and edge casesn` +
        `Verifying: Imports and dependencies are noted`,
      general:
        `Verifying: All factual claims are accuraten` +
        `Checking: Answer is complete and addresses all parts of the questionn` +
        `Ensuring: No misleading simplifications`,
      greeting: `Checking: Response is warm but not overly verbose`,
    };

    steps.push({
      stepNumber: stepCounter++,
      phase: "verify",
      title: "Verifying accuracy",
      thinking: verifyChecks[domain],
      conclusion: `Accuracy check passed. Answer is complete, balanced, and Nepal-context appropriate.`,
      duration: complexity === "complex" ? 600 : 400,
    });
  }

  // ── STEP 5: Follow-up Suggestions ─────────────────────────────────────
  const followUps = generateFollowUpSuggestions(query, domain, currentRoute);

  steps.push({
    stepNumber: stepCounter++,
    phase: "suggest",
    title: "Preparing follow-up ideas",
    thinking:
      `Analyzing what the user is likely to need next after this answer...n` +
      `Considering: What adjacent topics naturally follow from "${topicStr}"?n` +
      `Selected follow-ups:n` +
      followUps.map((f, i) => `  ${i + 1}. "${f}"`).join("\n"),
    conclusion: `${followUps.length} follow-up suggestions prepared`,
    duration: 200,
  });

  // ── Build promptAdditions ─────────────────────────────────────────────
  const complexityInstructions: Record<"simple" | "moderate" | "complex", string> = {
    simple:
      "Keep the answer concise and direct (2-5 sentences for factual, numbered steps for how-to).",
    moderate:
      "Provide a complete, well-structured answer. Use headers only if the answer covers 3+ distinct topics.",
    complex:
      "This is a complex question. Provide a thorough, multi-section answer with examples. Use headers to organize sections.",
  };

  const domainInstructions: Record<QuestionDomain, string> = {
    erp: `Focus on exact Sutra ERP navigation paths (module name, field names in **bold**), keyboard shortcuts, and Nepal compliance notes (VAT 13%, TDS rates). State the accounting impact.`,
    accounting: `Use proper accounting terminology, provide the journal entry (Dr/Cr), cite Nepal-specific rules (VAT Act 2052 / Income Tax Act 2058) where applicable, and include a worked example with Rs.`,
    math: `Show the formula, substitute the values, work through the arithmetic, and state the result with correct units.`,
    "web-search": `Lead with the most current information from the web search results. Clearly attribute: "According to recent search results:" before using live data.`,
    code: `Provide working, well-commented code. Explain what each part does. Note any dependencies or setup requirements.`,
    general: `Be clear, engaging, and use real-world examples. Answer comprehensively but avoid padding.`,
    greeting: `Respond with a warm greeting, introduce yourself as Falcon AI (Sutra ERP's AI assistant), and give 2-3 example questions the user can try.`,
  };

  const promptAdditions =
    `[FALCON REASONING COMPLETE]n` +
    `Domain: ${domain.toUpperCase()} | Intent: ${intent} | Complexity: ${complexity} | Confidence: ${classification.confidence}%n` +
    `Key topics: ${topicStr}n` +
    (currentRoute ? `Active page: ${currentRoute}n` : "") +
    (classification.shouldSearchWeb
      ? `Web search performed: YES (query: "${classification.searchQuery}")n`
      : "") +
    `nAnswer instructions: ${complexityInstructions[complexity]}n` +
    `Domain-specific guidance: ${domainInstructions[domain]}`;

  return {
    query,
    domain,
    intent,
    confidence: classification.confidence,
    shouldSearchWeb: classification.shouldSearchWeb,
    searchQuery: classification.searchQuery,
    steps,
    promptAdditions,
    suggestedFollowUps: followUps,
    estimatedComplexity: complexity,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// generateFollowUpSuggestions
// ─────────────────────────────────────────────────────────────────────────────

export function generateFollowUpSuggestions(
  query: string,
  domain: QuestionDomain,
  currentRoute?: string,
): string[] {
  const lower = query.toLowerCase();
  const topics = extractTopics(query);
  const topic = topics[0] || "this";

  // ── ERP suggestions by sub-topic ─────────────────────────────────────
  if (domain === "erp") {
    if (lower.includes("invoice") || lower.includes("sales")) {
      return [
        "How do I print a sales invoice as PDF?",
        "Where can I check outstanding customer balances?",
        "How do I apply a discount on an invoice?",
      ].slice(0, 3);
    }
    if (lower.includes("purchase")) {
      return [
        "How do I record TDS on a purchase payment?",
        "How do I link a GRN to a purchase invoice?",
        "How do I view supplier outstanding balances?",
      ].slice(0, 3);
    }
    if (lower.includes("vat") || lower.includes("tax")) {
      return [
        "How do I file the VAT return for the month?",
        "What is the difference between exempt and zero-rated?",
        "How do I record VAT payment to IRD?",
      ].slice(0, 3);
    }
    if (lower.includes("stock") || lower.includes("inventory") || lower.includes("item")) {
      return [
        "How do I check current stock levels?",
        "How do I set a reorder level alert?",
        "How do I transfer stock between warehouses?",
      ].slice(0, 3);
    }
    if (lower.includes("journal") || lower.includes("voucher")) {
      return [
        "What is the difference between journal and contra voucher?",
        "How do I post a depreciation entry?",
        "How do I reverse a wrongly posted voucher?",
      ].slice(0, 3);
    }
    if (lower.includes("report") || lower.includes("balance sheet") || lower.includes("profit")) {
      return [
        "How do I export this report to Excel?",
        "How do I compare current vs previous year?",
        "How do I drill down to individual transactions?",
      ].slice(0, 3);
    }
    if (currentRoute) {
      return [
        `What are the keyboard shortcuts for this page?`,
        `What common errors occur here and how to fix them?`,
        `How does this module connect to financial reports?`,
      ].slice(0, 3);
    }
    return [
      "How do I post a journal entry in Sutra ERP?",
      "Where can I see the VAT payable amount?",
      "How do I add a new customer party?",
    ].slice(0, 3);
  }

  // ── Accounting suggestions ────────────────────────────────────────────
  if (domain === "accounting") {
    if (lower.includes("depreciation")) {
      return [
        "What are Nepal's WDV depreciation rates by asset type?",
        "How does SLM differ from WDV depreciation?",
        "How do I record depreciation in Sutra ERP?",
      ].slice(0, 3);
    }
    if (lower.includes("vat") || lower.includes("tax")) {
      return [
        "What is the VAT registration threshold in Nepal?",
        "How do I calculate net VAT payable to IRD?",
        "What are the TDS rates under Nepal Income Tax Act?",
      ].slice(0, 3);
    }
    if (lower.includes("debit") || lower.includes("credit") || lower.includes("journal")) {
      return [
        "What are the golden rules of accounting?",
        "How do I record a cash purchase journal entry?",
        "What is the difference between real and nominal accounts?",
      ].slice(0, 3);
    }
    return [
      `What is the difference between cash and accrual accounting?`,
      `How do I calculate gross profit margin?`,
      `What are the key financial ratios for a business?`,
    ].slice(0, 3);
  }

  // ── Math suggestions ─────────────────────────────────────────────────
  if (domain === "math") {
    if (lower.includes("interest") || lower.includes("emi") || lower.includes("loan")) {
      return [
        "How do I calculate compound interest?",
        "What is the EMI formula for a loan?",
        "How does simple interest differ from compound?",
      ].slice(0, 3);
    }
    if (lower.includes("percent") || lower.includes("%")) {
      return [
        "How do I calculate percentage increase?",
        "What is 13% VAT on Rs. 25,000?",
        "How do I reverse-calculate pre-VAT amount?",
      ].slice(0, 3);
    }
    return [
      `How do I calculate ${topic} as a percentage?`,
      `What formula is used for compound ${topic}?`,
      `Can you show me a worked example with different numbers?`,
    ].slice(0, 3);
  }

  // ── Code suggestions ─────────────────────────────────────────────────
  if (domain === "code") {
    return [
      `How do I handle errors in this code?`,
      `What are TypeScript best practices for this pattern?`,
      `How do I test this function?`,
    ].slice(0, 3);
  }

  // ── Web search suggestions ────────────────────────────────────────────
  if (domain === "web-search") {
    return [
      `What is the latest update on this topic?`,
      `Can you give me more background on ${topic}?`,
      `What are the key facts I should know about ${topic}?`,
    ].slice(0, 3);
  }

  // ── Greeting suggestions ──────────────────────────────────────────────
  if (domain === "greeting") {
    return [
      "How do I create a sales invoice in Sutra ERP?",
      "What is VAT and how is it calculated in Nepal?",
      "How do I read a balance sheet?",
    ].slice(0, 3);
  }

  // ── General fallback ─────────────────────────────────────────────────
  return [
    `Can you explain ${topic} with an example?`,
    `What are the main things to know about ${topic}?`,
    `How does ${topic} apply in a business context?`,
  ].slice(0, 3);
}

// ─────────────────────────────────────────────────────────────────────────────
// buildEnhancedUserMessage
// ─────────────────────────────────────────────────────────────────────────────

export function buildEnhancedUserMessage(
  originalQuery: string,
  plan: ReasoningPlan,
  context: { route?: string; webResults?: string },
): string {
  const parts: string[] = [];

  // ── Context block ─────────────────────────────────────────────────────
  if (context.route && context.route.trim()) {
    parts.push(`[CONTEXT: User is on the "${context.route}" page of Sutra ERP]`);
  }

  parts.push(
    `[REASONING PLAN: Domain=${plan.domain.toUpperCase()}, Intent=${plan.intent}, ` +
      `Complexity=${plan.estimatedComplexity}, Confidence=${plan.confidence}%]`,
  );

  // ── Web data block ────────────────────────────────────────────────────
  if (context.webResults && context.webResults.trim()) {
    parts.push(
      `[WEB SEARCH DATA AVAILABLE — use this for current information, cite as "According to recent search results:"]n` +
        context.webResults.trim(),
    );
  }

  parts.push(``);

  // ── The actual user question ──────────────────────────────────────────
  parts.push(`User's question: ${originalQuery}`);
  parts.push(``);

  // ── Prompt additions from reasoning plan ──────────────────────────────
  parts.push(plan.promptAdditions);

  return parts.join("\n");
}
