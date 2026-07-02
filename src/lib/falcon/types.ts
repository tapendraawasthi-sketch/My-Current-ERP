export interface KBEntry {
  id: string;
  category: string;
  q: string;
  keywords: string[];
  a: string;
}

export interface FalconAnswer {
  answer: string;
  suggestions: string[];
  matchedId?: string;
  confidence: number;
}

/** A named entity extracted from the user's query (e.g. "Purchase Invoice", "VAT"). */
export interface FalconEntity {
  /** Canonical lowercase form used for KB matching. */
  canonical: string;
  /** Original surface form from the query. */
  surface: string;
  /** Entity type hint — e.g. "voucher_type", "ledger", "report", "concept". */
  type: string;
}

/**
 * Normalised, enriched representation of the user's query — produced by the
 * pre-processor and consumed by the reasoning / composer layer.
 */
export interface FalconReasoningInput {
  /** Raw query text as typed by the user. */
  rawQuery: string;
  /** Lower-cased, punctuation-stripped query used for similarity scoring. */
  normalizedQuery: string;
  /** Individual meaningful tokens after stop-word removal. */
  tokens: string[];
  /** Tokens plus synonym expansions — the union of all equivalent terms. */
  expandedTokens: Set<string>;
  /** Detected named entities (voucher types, ledger names, concepts, etc.). */
  entities: FalconEntity[];
  /** Current browser pathname, used for category boosting. */
  currentRoute?: string;
  /** Detected intent label — e.g. "how_to", "comparison", "formula", "workflow". */
  intent?: string;
  /** Last ≤6 turns of conversation for follow-up context. */
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
}

/**
 * The structured result produced by the reasoning engine before it is
 * turned into a FalconAnswer for the UI.
 */
export interface FalconReasoningResult {
  /** Final composed answer string (Markdown). */
  answer: string;
  /** Which strategy produced this answer. */
  strategy: string;
  /** Numeric confidence — higher is better (0–100). */
  confidence: number;
  /** IDs of KB entries that contributed to the answer. */
  matchedEntryIds: string[];
  /** Follow-up question suggestions to show the user. */
  suggestions: string[];
}
