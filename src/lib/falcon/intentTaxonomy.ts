// src/lib/falcon/intentTaxonomy.ts
// Shared 8-intent taxonomy — mirrors erp_bot/src/agent/intent_classifier.py exactly.

export type FalconIntent =
  | "code"
  | "troubleshoot"
  | "effect"
  | "steps"
  | "nav"
  | "action_path"
  | "definition"
  | "general";

export type SectionType =
  | "title"
  | "navigation"
  | "steps"
  | "fields"
  | "accounting-effect"
  | "validation"
  | "common-errors"
  | "shortcuts"
  | "tips"
  | "related"
  | "follow-ups";

export interface IntentOutputRules {
  maxSentences: number | null;
  allowedSections: SectionType[];
  forbiddenSections: SectionType[];
  oneLineOnly: boolean;
}

const CODE_PATTERNS =
  /\b(code|function|component|hook|api (route|endpoint)|schema|database|implementation|source (file|code)|where in (the )?code|how is .+ (implemented|built|coded|stored)|developer|backend|frontend|typescript|\.tsx?|sql query|table (schema|structure)|column|which (file|module|class) |renders?|supabase|rpc|query)\b/i;

const TROUBLESHOOT_PATTERNS =
  /\b(error|not working|issue|problem|failed|failing|fails|can'?t|cannot|won'?t|doesn'?t work|why (is|isn'?t|does|doesn'?t|can'?t|won'?t)|not (showing|posting|saving|appearing|reflecting|working|balanced?|calculating)|getting .+ error|throws?|exception|stuck|frozen|crash|bug)\b/i;

const EFFECT_PATTERNS =
  /\b(what (gets?|is|will be) (debited|credited)|accounting (entry|effect|treatment)|journal entry for|debit .+ credit|credit .+ debit|debit credit (for|of|in)|credit debit (for|of|in)|double entry (for|of)|which account (gets?|is|will be)|ledger effect|gl entry|dr[./]?cr|what is (the )?entry for)\b/i;

const STEPS_PATTERNS =
  /\b(steps (for|to)|step[- ]by[- ]step|procedure (for|to)|process (for|of)|guide me (through|on)|walk me through|how (exactly|specifically) (do i|to|does)|detailed (steps|procedure|process|instructions))\b/i;

const ACTION_PATH_PATTERNS =
  /\b(how (do i |to |can i )?(make|create|post|record|enter|add|pass|generate|cut|raise|prepare|issue|file|submit|save|write|book|lodge))\b/i;

const NAV_PATTERNS =
  /\b(where (is|do i|can i|to)|how (do i |to |can i )?(open|access|find|go to|get to|navigate|reach|see|view)|shortcut (for|to)|keyboard shortcut|hotkey|press which|which key|what key|path (to|for)|menu (for|of)|location of)\b/i;

const DEFINITION_PATTERNS =
  /\b(what (is|are)|explain|tell me about|describe|meaning of|definition of|what does .+ (do|mean)|what'?s (a |an |the )?[a-z]|define)\b/i;

const QUESTION_WORD_PATTERNS =
  /^(how|what|where|why|when|which|can|could|would|should|do|does|did|is|are|was|were|explain|tell|show|list|steps|step)\b/i;

const GREETING_PATTERNS =
  /^(hi|hello|hey|good\s+(morning|afternoon|evening)|namaste|namaskar)\b/i;

const ERP_TOPIC_PATTERNS =
  /\b(journal|voucher|invoice|payment|receipt|contra|ledger|trial\s*balance|day\s*book|balance\s*sheet|chart\s*of\s*accounts|party|parties|stock|vat|tds|payroll|report|sales|purchase|credit\s*note|debit\s*note)\b/i;

/** Short queries naming an ERP feature with no question word → definition. */
export function isBareTopicQuery(question: string): boolean {
  const q = question.trim();
  if (!q || QUESTION_WORD_PATTERNS.test(q)) return false;

  const words = q.replace(/[?.,!]/g, "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return false;

  return ERP_TOPIC_PATTERNS.test(q);
}

/** Port of erp_bot classify() — same priority order, first match wins. */
export function classifyIntent(question: string): FalconIntent {
  const q = question.trim();

  if (GREETING_PATTERNS.test(q)) {
    return "general";
  }

  if (CODE_PATTERNS.test(q)) return "code";
  if (TROUBLESHOOT_PATTERNS.test(q)) return "troubleshoot";
  if (EFFECT_PATTERNS.test(q)) return "effect";
  if (STEPS_PATTERNS.test(q)) return "steps";
  if (NAV_PATTERNS.test(q)) return "nav";
  if (ACTION_PATH_PATTERNS.test(q)) return "action_path";
  if (DEFINITION_PATTERNS.test(q)) return "definition";
  if (isBareTopicQuery(q)) return "definition";

  return "general";
}

export function formatNavAnswer(path: string, shortcut?: string): string {
  const cleanPath = path.replace(/^Path:\s*/i, "").trim();
  if (shortcut) {
    return `Path: ${cleanPath} · Shortcut: ${shortcut}`;
  }
  return `Path: ${cleanPath}`;
}

export function getIntentOutputRules(intent: FalconIntent): IntentOutputRules {
  const navForbidden: SectionType[] = [
    "steps",
    "fields",
    "accounting-effect",
    "validation",
    "common-errors",
    "tips",
    "related",
  ];

  switch (intent) {
    case "nav":
    case "action_path":
      return {
        maxSentences: 1,
        allowedSections: ["navigation"],
        forbiddenSections: navForbidden,
        oneLineOnly: true,
      };
    case "definition":
      return {
        maxSentences: 3,
        allowedSections: ["title"],
        forbiddenSections: ["navigation", "steps", "validation", "common-errors", "accounting-effect"],
        oneLineOnly: false,
      };
    case "steps":
      return {
        maxSentences: null,
        allowedSections: ["steps"],
        forbiddenSections: ["title", "navigation", "accounting-effect", "validation"],
        oneLineOnly: false,
      };
    case "effect":
      return {
        maxSentences: 4,
        allowedSections: ["accounting-effect"],
        forbiddenSections: ["navigation", "steps", "validation", "common-errors"],
        oneLineOnly: false,
      };
    case "troubleshoot":
      return {
        maxSentences: 5,
        allowedSections: ["common-errors"],
        forbiddenSections: ["navigation", "accounting-effect"],
        oneLineOnly: false,
      };
    case "code":
      return {
        maxSentences: null,
        allowedSections: ["title", "fields"],
        forbiddenSections: [],
        oneLineOnly: false,
      };
    case "general":
    default:
      return {
        maxSentences: null,
        allowedSections: ["title"],
        forbiddenSections: [],
        oneLineOnly: false,
      };
  }
}

const PATH_LINE_PATTERN =
  /(Path:|Shortcut:|→|Menu|Transactions|Masters|Reports|Utilities|Company|F\d+)/i;

const DEFINITION_SENTENCE_PATTERN =
  /^[A-Z].*?(is used for|is a|is an|is the|records|allows|enables|lets you|provides|helps|used to|feature for|way to)\b/i;

const NUMBERED_STEP_PATTERN = /^\s*\d+[.)]\s*/;

const DEBIT_CREDIT_PATTERN = /\b(DEBIT|CREDIT|Dr\.?|Cr\.?)\b/i;

/** Safety-net trim — mirrors erp_bot agent_builder._scope_answer */
export function postComposeScope(answer: string, intent: FalconIntent): string {
  if (!answer?.trim()) return answer;

  const lines = answer.trim().split("\n");

  if (intent === "action_path" || intent === "nav") {
    const pathLines: string[] = [];
    for (const line of lines) {
      const stripped = line.trim();
      if (!stripped) continue;
      if (PATH_LINE_PATTERN.test(stripped) || stripped.includes("→") || stripped.includes(">")) {
        if (!DEFINITION_SENTENCE_PATTERN.test(stripped)) {
          pathLines.push(stripped);
        }
      }
    }
    if (pathLines.length > 0) {
      const first = pathLines[0];
      if (first.startsWith("Path:")) return first;
      return formatNavAnswer(first.replace(/^\*\*Location:\*\*\s*/i, ""));
    }
    for (const line of lines) {
      if (line.trim()) return line.trim();
    }
    return answer;
  }

  if (intent === "definition") {
    const rawLines = lines.filter((l) => l.trim());
    const titleLine = rawLines.find((l) => /^\*\*.+\*\*$/.test(l.trim()));
    const bodyLines = rawLines.filter(
      (l) =>
        l !== titleLine &&
        !/^\*\*(Open|Steps|Rules|Required|Accounting|Validation|Location|Menu path)/i.test(l.trim()),
    );
    const text = bodyLines.join(" ").replace(/\*\*/g, "");
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 3);
    const body = sentences.join(" ").trim();
    if (titleLine && body) return `${titleLine}\n${body}`;
    if (titleLine) return titleLine;
    return body || answer;
  }

  if (intent === "steps") {
    const stepLines = lines.filter((l) => NUMBERED_STEP_PATTERN.test(l));
    if (stepLines.length > 0) return stepLines.join("\n");
    return answer;
  }

  if (intent === "effect") {
    const effectLines = lines.filter((l) => DEBIT_CREDIT_PATTERN.test(l));
    if (effectLines.length > 0) return effectLines.join("\n");
    return answer;
  }

  return answer;
}
