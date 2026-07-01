import { KNOWLEDGE_BASE } from "./kb";
import { tokenize, expandTokens, normalize } from "./textUtils";
import type { FalconAnswer, KBEntry } from "./types";

const GREETINGS = new Set(["hi", "hello", "hey", "greetings", "good morning", "good afternoon", "good evening"]);
const THANKS = new Set(["thanks", "thank you", "appreciate it", "great", "ok", "okay"]);

function isGreetingOrThanks(text: string): string | null {
  const norm = normalize(text);
  if (GREETINGS.has(norm)) {
    return "Hello! How can I help you with Sutra ERP today?";
  }
  if (THANKS.has(norm)) {
    return "You're welcome! Let me know if you need anything else.";
  }
  return null;
}

function calculateScore(entry: KBEntry, expandedTokens: Set<string>, currentPath?: string): number {
  let score = 0;
  let matches = 0;

  // Score against question tokens
  const qTokens = tokenize(entry.q);
  for (const t of qTokens) {
    if (expandedTokens.has(t)) {
      score += 1.5;
      matches++;
    }
  }

  // Score against explicit keywords
  for (const kw of entry.keywords) {
    const kwTokens = tokenize(kw);
    // If a multi-word keyword is fully matched
    if (kwTokens.length > 0 && kwTokens.every(t => expandedTokens.has(t))) {
      score += 3;
      matches++;
    } else {
      // Partial match on keywords
      for (const t of kwTokens) {
        if (expandedTokens.has(t)) {
          score += 1.0;
          matches++;
        }
      }
    }
  }

  // Category boosting
  if (currentPath && matches > 0) {
    if (
      (currentPath.includes("billing") || currentPath.includes("invoice") || currentPath.includes("voucher") || currentPath.includes("pos")) &&
      entry.category === "transactions"
    ) {
      score *= 1.2;
    } else if (
      (currentPath.includes("master") || currentPath.includes("party") || currentPath.includes("item") || currentPath.includes("account")) &&
      entry.category === "masters"
    ) {
      score *= 1.2;
    } else if (currentPath.includes("report") && entry.category === "reports") {
      score *= 1.2;
    } else if (currentPath.includes("settings") && entry.category === "general") {
      score *= 1.2;
    }
  }

  return matches > 0 ? score : 0;
}

export function askFalcon(question: string, currentPath?: string): FalconAnswer {
  const conversational = isGreetingOrThanks(question);
  if (conversational) {
    return {
      answer: conversational,
      suggestions: ["How do I create a sales invoice?", "What are the keyboard shortcuts?"],
      confidence: 100,
    };
  }

  const tokens = tokenize(question);
  if (tokens.length === 0) {
    return {
      answer: "I didn't quite catch that. Could you provide a bit more detail?",
      suggestions: ["How do I create a sales invoice?", "What are the keyboard shortcuts?"],
      confidence: 0,
    };
  }

  const expandedTokens = expandTokens(tokens);

  let bestEntry: KBEntry | null = null;
  let highestScore = 0;

  // Simple scoring model
  for (const entry of KNOWLEDGE_BASE) {
    const score = calculateScore(entry, expandedTokens, currentPath);
    if (score > highestScore) {
      highestScore = score;
      bestEntry = entry;
    }
  }

  if (bestEntry && highestScore > 1.0) {
    // Collect related questions for suggestions (same category, excluding the answer itself)
    const related = KNOWLEDGE_BASE.filter(
      (e) => e.category === bestEntry!.category && e.id !== bestEntry!.id
    )
      .sort(() => 0.5 - Math.random()) // Shuffle
      .slice(0, 3)
      .map((e) => e.q);

    return {
      answer: bestEntry.a,
      matchedId: bestEntry.id,
      suggestions: related,
      confidence: highestScore,
    };
  }

  return {
    answer: "I couldn't find a direct answer for that in my knowledge base. Try checking the documentation or rephrasing your question.",
    suggestions: ["How do I create a sales invoice?", "What are the keyboard shortcuts?"],
    confidence: 0,
  };
}
