/**
 * Unified Intelligence Layer — The orchestrator of human-like understanding.
 * 
 * This module combines all AI components to provide the best possible answer:
 * 1. Human Semantic Brain (semantic understanding)
 * 2. Nepali Accounting Rules (rule-based knowledge)
 * 3. Concept Definitions (glossary and explanations)
 * 4. Grammar Knowledge (detailed grammar-based reasoning)
 * 5. Semantic Similarity (understanding variant phrasings)
 * 
 * The key insight: We don't just match patterns — we UNDERSTAND meaning,
 * then choose the best knowledge source to answer.
 */

import { 
  processWithHumanBrain, 
  getHumanBrain,
  type UserIntent, 
  type SemanticFrame 
} from "./humanSemanticBrain";

import {
  answerFromKnowledgeBase,
  findConceptDefinition,
  formatConceptAnswer,
  ACCOUNTING_RULES,
  CONCEPT_DEFINITIONS,
} from "./nepaliAccountingRules";

import {
  calculateSemanticSimilarity,
  matchPhrasePattern,
  normalizeToCanonical,
  expandQuery,
} from "./semanticSimilarity";

import {
  understandAccountingLanguage,
  detectUserLanguage,
  type AccountingLanguageResult,
} from "./accountingLanguageBrain";

import {
  generateConversationalReply,
  analyzeQuestion,
} from "./conversationalBrain";

import {
  answerFromGrammarKnowledge,
  synthesizeGrammarContext,
} from "./grammarKnowledgeBrain";

// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED RESPONSE TYPE
// ═══════════════════════════════════════════════════════════════════════════════

export interface UnifiedResponse {
  answer: string;
  confidence: number;
  source: "semantic" | "rules" | "concepts" | "grammar" | "conversational" | "fallback";
  intent?: UserIntent;
  frame?: SemanticFrame;
  language: "nepali" | "english" | "mixed";
  isTransaction: boolean;
  suggestedFollowUp?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Process user input and generate the best possible response.
 * This is the main entry point for all AI queries.
 */
export function processWithUnifiedIntelligence(
  text: string,
  options: {
    history?: Array<{ role: "user" | "assistant"; text: string }>;
    balance?: any;
    userName?: string;
  } = {}
): UnifiedResponse {
  const language = detectUserLanguage(text) as "nepali" | "english" | "mixed";
  
  // ─── Step 1: Try Human Semantic Brain for deep understanding ─────────────
  const humanResult = processWithHumanBrain(text);
  
  // ─── Step 2: Check if it's a transaction intent ──────────────────────────
  if (humanResult.intent.type === "TRANSACTION" && humanResult.confidence >= 0.7) {
    return {
      answer: humanResult.response,
      confidence: humanResult.confidence,
      source: "semantic",
      intent: humanResult.intent,
      frame: humanResult.frame,
      language,
      isTransaction: true,
      suggestedFollowUp: language === "english" 
        ? "Would you like to confirm this entry?" 
        : "Yo entry confirm garne?",
    };
  }

  // ─── Step 3: Check for definition questions ──────────────────────────────
  if (humanResult.intent.type === "QUESTION") {
    // Try concept definitions first
    const conceptAnswer = answerFromKnowledgeBase(text, language);
    if (conceptAnswer && conceptAnswer.confidence >= 0.85) {
      return {
        answer: conceptAnswer.answer,
        confidence: conceptAnswer.confidence,
        source: conceptAnswer.source === "concept" ? "concepts" : "rules",
        intent: humanResult.intent,
        frame: humanResult.frame,
        language,
        isTransaction: false,
      };
    }

    // Try accounting language brain
    const accountingAnswer = understandAccountingLanguage(text);
    if (accountingAnswer.kind === "answer" && accountingAnswer.confidence >= 0.7) {
      return {
        answer: accountingAnswer.reply,
        confidence: accountingAnswer.confidence,
        source: "grammar",
        intent: humanResult.intent,
        frame: humanResult.frame,
        language,
        isTransaction: false,
      };
    }
  }

  // ─── Step 4: Check for social/conversational intent ──────────────────────
  if (humanResult.intent.type === "SOCIAL") {
    return {
      answer: humanResult.response,
      confidence: 0.9,
      source: "semantic",
      intent: humanResult.intent,
      frame: humanResult.frame,
      language,
      isTransaction: false,
    };
  }

  // ─── Step 5: Check for command intent ────────────────────────────────────
  if (humanResult.intent.type === "COMMAND") {
    // Special handling for language selection questions
    const langConcept = findConceptDefinition("language select");
    if (langConcept && /\b(language|bhasa|bhasha)\b/i.test(text)) {
      return {
        answer: formatConceptAnswer(langConcept, language),
        confidence: 0.92,
        source: "concepts",
        intent: humanResult.intent,
        frame: humanResult.frame,
        language,
        isTransaction: false,
      };
    }
    
    return {
      answer: humanResult.response,
      confidence: humanResult.confidence,
      source: "semantic",
      intent: humanResult.intent,
      frame: humanResult.frame,
      language,
      isTransaction: false,
    };
  }

  // ─── Step 6: Try grammar-based answer ────────────────────────────────────
  const grammarAnswer = answerFromGrammarKnowledge(text, language);
  if (grammarAnswer && grammarAnswer.confidence >= 0.6) {
    // Enhance grammar answer with better formatting
    const enhancedAnswer = enhanceGrammarAnswer(grammarAnswer.reply, text, language);
    return {
      answer: enhancedAnswer,
      confidence: grammarAnswer.confidence,
      source: "grammar",
      intent: humanResult.intent,
      frame: humanResult.frame,
      language,
      isTransaction: false,
    };
  }

  // ─── Step 7: Try conversational reply ────────────────────────────────────
  const conversationalReply = generateConversationalReply(text, {
    balance: options.balance,
    history: options.history,
    userName: options.userName,
  });

  if (conversationalReply && conversationalReply.length > 10) {
    return {
      answer: conversationalReply,
      confidence: 0.65,
      source: "conversational",
      intent: humanResult.intent,
      frame: humanResult.frame,
      language,
      isTransaction: false,
    };
  }

  // ─── Step 8: Semantic-based response as fallback ─────────────────────────
  if (humanResult.response && humanResult.response.length > 10) {
    return {
      answer: humanResult.response,
      confidence: humanResult.confidence,
      source: "semantic",
      intent: humanResult.intent,
      frame: humanResult.frame,
      language,
      isTransaction: false,
    };
  }

  // ─── Step 9: Ultimate fallback ───────────────────────────────────────────
  return {
    answer: generateFallbackResponse(text, language),
    confidence: 0.3,
    source: "fallback",
    intent: humanResult.intent,
    frame: humanResult.frame,
    language,
    isTransaction: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Enhance grammar answers with better formatting and explanations.
 */
function enhanceGrammarAnswer(
  grammarReply: string, 
  originalText: string, 
  language: "nepali" | "english" | "mixed"
): string {
  // If the grammar reply is just rules, add context
  if (grammarReply.includes("hisab bhasa ko niyam") || grammarReply.includes("accounting language rules")) {
    const intro = language === "english"
      ? "Here's how to understand this in Nepali accounting language:\n\n"
      : "Yo Nepali hisab bhasa ma yesari bujhnu hunchha:\n\n";
    
    // Add example if the rules mention specific patterns
    const hasPayment = /payment/i.test(grammarReply);
    const hasUdhaar = /udhaar|udhar/i.test(grammarReply);
    
    let example = "";
    if (hasPayment) {
      example = language === "english"
        ? "\n\n**Example:** `Ram le 500 tiryo` means Ram paid/settled Rs. 500"
        : "\n\n**Udaharan:** `Ram le 500 tiryo` vaneko Ram le Rs. 500 tiryo/settle garyo";
    } else if (hasUdhaar) {
      example = language === "english"
        ? "\n\n**Example:** `Ram lai 500 udhaar diye` means gave Rs. 500 credit sale to Ram"
        : "\n\n**Udaharan:** `Ram lai 500 udhaar diye` vaneko Ram lai Rs. 500 ko udhaar bikri";
    }
    
    return intro + grammarReply + example;
  }
  
  return grammarReply;
}

/**
 * Generate a helpful fallback response when nothing else works.
 */
function generateFallbackResponse(text: string, language: "nepali" | "english" | "mixed"): string {
  const isQuestion = /[?？]/.test(text) || /\b(k|ke|kasari|kati|what|how|why|when)\b/i.test(text);
  
  if (isQuestion) {
    return language === "english"
      ? "I'm not sure I fully understood your question. I can help you with:\n\n" +
        "• Recording transactions (e.g., 'Ram lai 500 udhaar diye')\n" +
        "• Accounting concepts (e.g., 'what is debit credit?')\n" +
        "• Tax info (e.g., 'VAT rate kati?')\n" +
        "• ERP features (e.g., 'how to change language?')\n\n" +
        "Could you rephrase your question?"
      : "Tapaiko sawal ramrari bujhina. Ma yinihar ma help garna sakchhu:\n\n" +
        "• Transaction record garna (jastai: 'Ram lai 500 udhaar diye')\n" +
        "• Accounting concepts (jastai: 'debit credit k ho?')\n" +
        "• Tax jankari (jastai: 'VAT rate kati?')\n" +
        "• ERP features (jastai: 'language kasari change garne?')\n\n" +
        "Thora arko tarikale sodhnu saknu huncha?";
  }
  
  return language === "english"
    ? "I'm here to help with your accounting and khata entries. Try:\n" +
      "• 'Ram lai 500 udhaar diye' - Credit sale\n" +
      "• 'Ram le 500 tiryo' - Payment received\n" +
      "• 'VAT k ho?' - Ask questions\n\n" +
      "What would you like to do?"
    : "Ma tapaiko khata ra accounting ma help garna tayar chhu. Try garnus:\n" +
      "• 'Ram lai 500 udhaar diye' - Udhaar bikri\n" +
      "• 'Ram le 500 tiryo' - Payment received\n" +
      "• 'VAT k ho?' - Sawal sodhnus\n\n" +
      "Ke garne?";
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEMANTIC UNDERSTANDING HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if two user queries are asking about the same thing.
 */
export function areQueriesSimilar(query1: string, query2: string, threshold = 0.8): boolean {
  return calculateSemanticSimilarity(query1, query2) >= threshold;
}

/**
 * Expand a query to catch semantic variants.
 */
export function getQueryVariants(query: string): string[] {
  return expandQuery(query);
}

/**
 * Get the normalized canonical form of a query.
 */
export function canonicalizeQuery(query: string): string {
  return normalizeToCanonical(query);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  processWithHumanBrain,
  getHumanBrain,
  answerFromKnowledgeBase,
  understandAccountingLanguage,
  generateConversationalReply,
  answerFromGrammarKnowledge,
};
