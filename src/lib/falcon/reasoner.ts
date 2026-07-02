/**
 * reasoner.ts — Phase 7 of the Falcon reasoning pipeline.
 *
 * Strategy orchestrator: holds all reasoning strategies and picks the
 * best result for any given user query.
 */

import type { KBEntry, FalconReasoningInput, FalconReasoningResult } from "./types";
import { KNOWLEDGE_BASE } from "./kb";
import { sentenceSimilarity, tokenize } from "./textUtils";
import {
  findTopKEntries,
  synthesizeAnswer,
  composeComparisonAnswer,
  composeFormulaAnswer,
  composeWorkflowAnswer,
  composePrincipleAnswer,
  scoreEntry,
  buildFallback,
} from "./composer";

// ─── SHARED CONSTANTS ────────────────────────────────────────────────────────

const DEFAULT_SUGGESTIONS = [
  "How do I create a sales invoice?",
  "How do I see VAT reports?",
  "What are the keyboard shortcuts?",
];

const GREETING_SET = new Set([
  "hi",
  "hello",
  "hey",
  "good morning",
  "good afternoon",
  "good evening",
  "namaste",
]);

const THANKS_SET = new Set([
  "thanks",
  "thank you",
  "appreciate it",
  "ok",
  "okay",
  "great",
  "noted",
  "got it",
  "understood",
  "cool",
  "perfect",
]);

// ─── STRATEGY 1 — greeting_thanks (priority 0) ───────────────────────────────

const greetingThanksStrategy = {
  name: "greeting_thanks",
  priority: 0,

  canHandle(input: FalconReasoningInput): boolean {
    const q = input.normalizedQuery.trim();
    if (q.length < 5) return true;
    if (GREETING_SET.has(q)) return true;
    if (THANKS_SET.has(q)) return true;
    return false;
  },

  execute(input: FalconReasoningInput): FalconReasoningResult {
    const q = input.normalizedQuery.trim();
    const isGreeting =
      GREETING_SET.has(q) || q.length < 5 || q.startsWith("hi") || q.startsWith("hello");

    const answer = isGreeting
      ? "Namaste! I'm Falcon, your Sutra ERP assistant. I can guide you through invoices, vouchers, inventory, reports, VAT, and more. What would you like to do?"
      : "You're welcome! Feel free to ask anything else about Sutra ERP.";

    return {
      answer,
      strategy: "greeting_thanks",
      confidence: 100,
      matchedEntryIds: [],
      suggestions: [
        "How do I create a sales invoice?",
        "What are keyboard shortcuts?",
        "How do I see VAT reports?",
      ],
    };
  },
};

// ─── STRATEGY 2 — kb_exact_match (priority 1) ────────────────────────────────

const kbExactMatchStrategy = {
  name: "kb_exact_match",
  priority: 1,

  canHandle(_input: FalconReasoningInput): boolean {
    return true; // always tries
  },

  execute(
    input: FalconReasoningInput,
    kb: KBEntry[]
  ): FalconReasoningResult | null {
    let bestEntry: KBEntry | null = null;
    let highestScore = 0;

    for (const entry of kb) {
      const score = scoreEntry(entry, input);
      if (score > highestScore) {
        highestScore = score;
        bestEntry = entry;
      }
    }

    if (!bestEntry || highestScore < 2.0) return null;

    // Up to 3 suggestions from same category (shuffled)
    const suggestions = kb
      .filter((e) => e.category === bestEntry!.category && e.id !== bestEntry!.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map((e) => e.q);

    return {
      answer: bestEntry.a,
      strategy: "kb_exact_match",
      confidence: Math.min(highestScore * 5, 95),
      matchedEntryIds: [bestEntry.id],
      suggestions: suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS,
    };
  },
};

// ─── STRATEGY 3 — kb_multi_synthesis (priority 2) ────────────────────────────

const kbMultiSynthesisStrategy = {
  name: "kb_multi_synthesis",
  priority: 2,

  canHandle(input: FalconReasoningInput): boolean {
    return input.tokens.length >= 5 || input.entities.length >= 2;
  },

  execute(
    input: FalconReasoningInput,
    kb: KBEntry[]
  ): FalconReasoningResult | null {
    const entries = findTopKEntries(input, kb, 4);
    if (entries.length === 0) return null;

    const result = synthesizeAnswer(entries, input);

    // Add suggestions from a different category than the majority
    const majorityCategory = entries[0].category;
    const otherSuggestions = kb
      .filter((e) => e.category !== majorityCategory)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map((e) => e.q);

    return {
      ...result,
      suggestions: otherSuggestions.length > 0 ? otherSuggestions : DEFAULT_SUGGESTIONS,
    };
  },
};

// ─── STRATEGY 4 — comparison_reasoning (priority 3) ──────────────────────────

const comparisonReasoningStrategy = {
  name: "comparison_reasoning",
  priority: 3,

  canHandle(input: FalconReasoningInput): boolean {
    return input.intent === "compare";
  },

  execute(
    input: FalconReasoningInput,
    kb: KBEntry[]
  ): FalconReasoningResult | null {
    let termA = "";
    let termB = "";

    // Extract from entities first
    if (input.entities.length >= 2) {
      termA = input.entities[0].canonical;
      termB = input.entities[1].canonical;
    } else if (input.entities.length === 1) {
      termA = input.entities[0].canonical;
    } else {
      // Try to extract from query around "vs", "versus", "difference between"
      const q = input.normalizedQuery;
      const vsMatch = q.match(/(.+?)\s+(?:vs\.?|versus)\s+(.+)/i);
      const diffMatch = q.match(/difference\s+between\s+(.+?)\s+and\s+(.+)/i);
      if (vsMatch) {
        termA = vsMatch[1].trim();
        termB = vsMatch[2].trim();
      } else if (diffMatch) {
        termA = diffMatch[1].trim();
        termB = diffMatch[2].trim();
      }
    }

    // Try the COMPARISON_TABLE first
    if (termA && termB) {
      const compResult = composeComparisonAnswer(termA, termB);
      if (compResult) return { ...compResult, confidence: 75 };
    } else if (termA) {
      const compResult = composeComparisonAnswer(termA, "");
      if (compResult) return { ...compResult, confidence: 65 };
    }

    // Fallback: synthesize from two separate KB lookups
    if (termA && termB) {
      const inputA: FalconReasoningInput = {
        ...input,
        normalizedQuery: termA,
        tokens: tokenize(termA),
      };
      const inputB: FalconReasoningInput = {
        ...input,
        normalizedQuery: termB,
        tokens: tokenize(termB),
      };
      const entriesA = findTopKEntries(inputA, kb, 1);
      const entriesB = findTopKEntries(inputB, kb, 1);
      const combined = [...entriesA, ...entriesB].filter(
        (e, i, arr) => arr.findIndex((x) => x.id === e.id) === i
      );
      if (combined.length > 0) {
        const synth = synthesizeAnswer(combined, input);
        return { ...synth, confidence: 55 };
      }
    }

    return null;
  },
};

// ─── STRATEGY 5 — formula_reasoning (priority 4) ─────────────────────────────

const formulaReasoningStrategy = {
  name: "formula_reasoning",
  priority: 4,

  canHandle(input: FalconReasoningInput): boolean {
    return input.intent === "calculate";
  },

  execute(input: FalconReasoningInput, _kb: KBEntry[]): FalconReasoningResult | null {
    return composeFormulaAnswer(input.normalizedQuery);
  },
};

// ─── STRATEGY 6 — troubleshoot_reasoning (priority 5) ────────────────────────

const troubleshootReasoningStrategy = {
  name: "troubleshoot_reasoning",
  priority: 5,

  canHandle(input: FalconReasoningInput): boolean {
    return input.intent === "troubleshoot" || input.intent === "why";
  },

  execute(
    input: FalconReasoningInput,
    kb: KBEntry[]
  ): FalconReasoningResult | null {
    // First try workflow rules
    const workflowResult = composeWorkflowAnswer(input.normalizedQuery, input.tokens);
    if (workflowResult) return { ...workflowResult, confidence: 78 };

    // Then synthesize from KB
    const entries = findTopKEntries(input, kb, 3);
    if (entries.length > 0) {
      const synth = synthesizeAnswer(entries, input);
      return { ...synth, confidence: 60 };
    }

    return null;
  },
};

// ─── STRATEGY 7 — accounting_principle_reasoning (priority 6) ────────────────

const accountingPrincipleReasoningStrategy = {
  name: "accounting_principle_reasoning",
  priority: 6,

  canHandle(input: FalconReasoningInput): boolean {
    return input.intent === "what_is" || input.intent === "definition";
  },

  execute(
    input: FalconReasoningInput,
    kb: KBEntry[]
  ): FalconReasoningResult | null {
    // First try KB with a slightly lower threshold
    let bestEntry: KBEntry | null = null;
    let highestScore = 0;
    for (const entry of kb) {
      const score = scoreEntry(entry, input);
      if (score > highestScore) {
        highestScore = score;
        bestEntry = entry;
      }
    }
    if (bestEntry && highestScore >= 1.5) {
      const suggestions = kb
        .filter((e) => e.category === bestEntry!.category && e.id !== bestEntry!.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .map((e) => e.q);
      return {
        answer: bestEntry.a,
        strategy: "accounting_principle_reasoning",
        confidence: Math.min(highestScore * 5, 85),
        matchedEntryIds: [bestEntry.id],
        suggestions: suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS,
      };
    }

    // Then try principle library
    const principleResult = composePrincipleAnswer(input.normalizedQuery, input.tokens);
    if (principleResult) return { ...principleResult, confidence: 70 };

    return null;
  },
};

// ─── STRATEGY 8 — context_followup (priority 7) ──────────────────────────────

const FOLLOWUP_PATTERNS = [
  "what about",
  "and how",
  "tell me more",
  "what else",
  "how about",
  "another question about",
  "related to that",
  "also",
];

const contextFollowupStrategy = {
  name: "context_followup",
  priority: 7,

  canHandle(input: FalconReasoningInput): boolean {
    if (input.conversationHistory.length < 2) return false;
    if (input.tokens.length <= 3) return true;
    return FOLLOWUP_PATTERNS.some((p) => input.normalizedQuery.includes(p));
  },

  execute(
    input: FalconReasoningInput,
    kb: KBEntry[]
  ): FalconReasoningResult | null {
    const history = input.conversationHistory;

    // Find last assistant and user messages
    const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
    const lastUser = [...history].reverse().find((m) => m.role === "user");

    if (!lastUser) return null;

    // Build an enriched query from previous user message + current query
    const enrichedQuery = `${lastUser.content} ${input.rawQuery}`;
    const enrichedInput: FalconReasoningInput = {
      ...input,
      normalizedQuery: enrichedQuery.toLowerCase(),
      tokens: tokenize(enrichedQuery),
    };

    // Re-run scoring on enriched input
    let bestEntry: KBEntry | null = null;
    let highestScore = 0;
    for (const entry of kb) {
      const score = scoreEntry(entry, enrichedInput);
      if (score > highestScore) {
        highestScore = score;
        bestEntry = entry;
      }
    }

    if (bestEntry && highestScore >= 1.5) {
      const suggestions = kb
        .filter((e) => e.category === bestEntry!.category && e.id !== bestEntry!.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .map((e) => e.q);
      return {
        answer: bestEntry.a,
        strategy: "context_followup",
        confidence: Math.min(highestScore * 5, 85) - 10,
        matchedEntryIds: [bestEntry.id],
        suggestions: suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS,
      };
    }

    // Provide a context-referencing fallback
    const contextSnippet = lastAssistant
      ? lastAssistant.content.slice(0, 80).replace(/\n/g, " ")
      : "";
    const answer = contextSnippet
      ? `Based on your previous question about "${contextSnippet}...", I think you're asking about **${input.normalizedQuery}**. Could you rephrase more specifically? For example, ask "How do I..." or "What is...".`
      : `Could you rephrase your question? You can ask about vouchers, reports, masters, VAT, TDS, or inventory.`;

    return {
      answer,
      strategy: "context_followup",
      confidence: 45,
      matchedEntryIds: [],
      suggestions: DEFAULT_SUGGESTIONS,
    };
  },
};

// ─── STRATEGY 9 — navigation_reasoning (priority 8) ──────────────────────────

const NAVIGATION_MAP: Record<string, string> = {
  "Sales Invoice": "Transactions → Sales → Sales Invoice (or press F9)",
  "Purchase Invoice": "Transactions → Purchase → Purchase Invoice (or press F10)",
  "Journal Entry": "Transactions → Finance → Journal (or press F5)",
  "Payment Voucher": "Transactions → Finance → Payment (or press F6)",
  "Receipt Voucher": "Transactions → Finance → Receipt (or press F7)",
  "Contra Voucher": "Transactions → Finance → Contra (or press F8)",
  "Chart of Accounts": "Masters → Accounts → Chart of Accounts",
  "Party Master": "Masters → Parties",
  "Party Master (Customer)": "Masters → Parties → filter by Customer",
  "Party Master (Supplier)": "Masters → Parties → filter by Supplier",
  "Item / Stock Master": "Masters → Inventory → Items",
  "Warehouse / Godown Master": "Masters → Inventory → Warehouses",
  "Trial Balance": "Reports → Financial → Trial Balance (or press T)",
  "Balance Sheet": "Reports → Financial → Balance Sheet (or press B)",
  "Profit & Loss Statement": "Reports → Financial → Profit & Loss",
  "Day Book": "Reports → Books → Day Book (or press D)",
  "General Ledger Report": "Reports → Books → General Ledger (or press L)",
  "VAT Report": "Reports → GST/VAT → VAT Summary (or press V)",
  "Stock Summary": "Reports → Inventory → Stock Summary (or press S)",
  "POS Mode": "Transactions → POS Mode (or press F9 on billing)",
  "Audit Log": "Utilities → Audit Logs",
  "Backup & Restore": "Utilities → Backup & Restore",
  "System Settings": "Company → System Settings",
  "User Roles & Permissions": "Utilities → Users & Roles",
  "Fiscal Year": "Company → Fiscal Year",
  "Delivery Challan": "Transactions → Inventory → Delivery Challan",
  "Goods Receipt Note (GRN)": "Transactions → Inventory → GRN",
  "Stock Transfer": "Transactions → Inventory → Stock Transfer",
  "Cost Center Master": "Masters → Cost Centers",
  "TDS Certificate": "Reports → TDS → TDS Certificate",
  "Sales Return": "Transactions → Sales → Sales Return",
  "Purchase Return": "Transactions → Purchase → Purchase Return",
  "Sales Order": "Transactions → Sales → Sales Order",
  "Purchase Order": "Transactions → Purchase → Purchase Order",
  "Physical Stock Adjustment": "Transactions → Inventory → Physical Stock",
  "Outstanding Receivables": "Reports → Parties → Outstanding Receivables",
  "Outstanding Payables": "Reports → Parties → Outstanding Payables",
};

const navigationReasoningStrategy = {
  name: "navigation_reasoning",
  priority: 8,

  canHandle(input: FalconReasoningInput): boolean {
    return input.intent === "navigate" || input.intent === "where";
  },

  execute(
    input: FalconReasoningInput,
    kb: KBEntry[]
  ): FalconReasoningResult | null {
    const resolved: Array<{ canonical: string; path: string }> = [];
    const unresolved: string[] = [];

    for (const entity of input.entities) {
      const path = NAVIGATION_MAP[entity.canonical];
      if (path) {
        resolved.push({ canonical: entity.canonical, path });
      } else {
        unresolved.push(entity.canonical);
      }
    }

    // If no entities at all, try to match from the normalizedQuery against map keys
    if (input.entities.length === 0) {
      for (const [canonical, path] of Object.entries(NAVIGATION_MAP)) {
        if (input.normalizedQuery.includes(canonical.toLowerCase())) {
          resolved.push({ canonical, path });
        }
      }
    }

    // Build the navigation answer
    let answer = "";
    if (resolved.length > 0) {
      const navLines = resolved
        .map((r) => `**${r.canonical}** → ${r.path}`)
        .join("\n\n");
      answer = resolved.length === 1
        ? `To open **${resolved[0].canonical}**, go to:\n\n📍 ${resolved[0].path}`
        : `Here are the navigation paths:\n\n${navLines}`;
    }

    // Append first sentence of top KB entry for extra context
    const topEntry = findTopKEntries(input, kb, 1)[0];
    if (topEntry) {
      const firstSentence = topEntry.a.split(". ")[0] + ".";
      if (answer) {
        answer += `\n\n${firstSentence}`;
      } else {
        answer = topEntry.a;
      }
    }

    if (!answer) return null;

    const confidence = resolved.length > 0 ? 85 : 55;

    return {
      answer,
      strategy: "navigation_reasoning",
      confidence,
      matchedEntryIds: topEntry ? [topEntry.id] : [],
      suggestions: [
        "How do I create a sales invoice?",
        "Where is the VAT report?",
        "How do I open the Chart of Accounts?",
      ],
    };
  },
};

// ─── STRATEGY 10 — general_fallback (priority 99) ────────────────────────────

const generalFallbackStrategy = {
  name: "general_fallback",
  priority: 99,

  canHandle(_input: FalconReasoningInput): boolean {
    return true;
  },

  execute(
    input: FalconReasoningInput,
    kb: KBEntry[]
  ): FalconReasoningResult {
    const suggestions = findTopKEntries(input, kb, 3).map((e) => e.q);

    const entityNames = input.entities.map((e) => e.canonical).join(", ");
    const answer =
      entityNames.length > 0
        ? `I couldn't find a precise answer about **${entityNames}**, but here are some related things I can help with. Try rephrasing or ask me specifically about any of these.`
        : "I couldn't find a direct answer for that. Could you rephrase? You can ask me about: creating sales/purchase invoices, journal entries, VAT reports, party/item masters, inventory transactions, POS mode, or system settings.";

    return {
      answer,
      strategy: "general_fallback",
      confidence: 5,
      matchedEntryIds: [],
      suggestions: suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS,
    };
  },
};

// ─── ORDERED STRATEGY LIST ────────────────────────────────────────────────────

type AnyStrategy = {
  name: string;
  priority: number;
  canHandle(input: FalconReasoningInput): boolean;
  execute(
    input: FalconReasoningInput,
    kb: KBEntry[]
  ): FalconReasoningResult | null;
};

const STRATEGIES: AnyStrategy[] = [
  greetingThanksStrategy,
  kbExactMatchStrategy,
  kbMultiSynthesisStrategy,
  comparisonReasoningStrategy,
  formulaReasoningStrategy,
  troubleshootReasoningStrategy,
  accountingPrincipleReasoningStrategy,
  contextFollowupStrategy,
  navigationReasoningStrategy,
  generalFallbackStrategy,
].sort((a, b) => a.priority - b.priority);

// ─── MAIN ORCHESTRATOR ────────────────────────────────────────────────────────

/**
 * runReasoner — evaluates all strategies in priority order and returns the
 * first result with confidence >= 40. If none reach that threshold, the
 * highest-confidence result seen (or the fallback) is returned.
 */
export function runReasoner(input: FalconReasoningInput): FalconReasoningResult {
  let bestResult: FalconReasoningResult | null = null;

  for (const strategy of STRATEGIES) {
    if (!strategy.canHandle(input)) continue;

    const result = strategy.execute(input, KNOWLEDGE_BASE);
    if (!result) continue;

    // Ensure suggestions always has 1-3 items
    if (!result.suggestions || result.suggestions.length === 0) {
      result.suggestions = DEFAULT_SUGGESTIONS;
    } else if (result.suggestions.length > 3) {
      result.suggestions = result.suggestions.slice(0, 3);
    }

    // Track the best result seen so far
    if (!bestResult || result.confidence > bestResult.confidence) {
      bestResult = result;
    }

    // Return immediately if confidence is good enough
    if (result.confidence >= 40) {
      return result;
    }
  }

  // Return the best result seen even if < 40 confidence
  if (bestResult) return bestResult;

  // Final safety net: explicit fallback
  return generalFallbackStrategy.execute(input, KNOWLEDGE_BASE);
}
