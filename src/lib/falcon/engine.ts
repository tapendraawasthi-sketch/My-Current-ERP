import type { FalconAnswer, FalconReasoningInput } from "./types";
import { tokenize, normalize, expandTokens } from "./textUtils";
import { detectIntent } from "./intentDetector";
import { extractEntities } from "./entityExtractor";
import { runReasoner } from "./reasoner";

export function askFalcon(
  question: string,
  currentPath?: string,
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>
): FalconAnswer {
  // 1. Trim and validate input
  const raw = question.trim();
  if (!raw) {
    return {
      answer: "I didn't quite catch that. Could you provide more detail?",
      suggestions: [
        "How do I create a sales invoice?",
        "What are keyboard shortcuts?",
      ],
      confidence: 0,
    };
  }

  // 2. Build the reasoning input
  const normalizedQuery = normalize(raw);
  const tokens = tokenize(raw);
  const expandedTokens = expandTokens(tokens);
  const intent = detectIntent(normalizedQuery, tokens);
  const entities = extractEntities(normalizedQuery, tokens, expandedTokens);
  const history = conversationHistory ?? [];

  const input: FalconReasoningInput = {
    rawQuery: raw,
    normalizedQuery,
    tokens,
    expandedTokens,
    intent,
    entities,
    currentRoute: currentPath,
    conversationHistory: history.slice(-6), // last 6 messages for context
  };

  // 3. Run the reasoner
  const result = runReasoner(input);

  // 4. Map to FalconAnswer (the existing interface callers expect)
  return {
    answer: result.answer,
    suggestions: result.suggestions,
    matchedId: result.matchedEntryIds[0],
    confidence: result.confidence,
  };
}
