/** SUTRA AI — grammar validation for Nepali/English */

import errorPatterns from "@/data/corrections/error-patterns.json";

export interface GrammarIssue {
  type: "case_marker" | "honorific" | "agreement" | "unit_mismatch";
  original: string;
  suggested: string;
  explanation: string;
  confidence: number;
}

export class GrammarAnalyzer {
  analyze(text: string): GrammarIssue[] {
    const issues: GrammarIssue[] = [];
    const lower = text.toLowerCase();

    const caseMarkers = (errorPatterns.grammar?.caseMarkers ?? []) as Array<{
      wrong: string;
      correct: string;
      rule: string;
    }>;

    for (const rule of caseMarkers) {
      const wrongPart = rule.wrong.split("...")[0];
      const wrongVerb = rule.wrong.split("...")[1];
      if (wrongPart && wrongVerb && lower.includes(wrongPart) && lower.includes(wrongVerb)) {
        issues.push({
          type: "case_marker",
          original: rule.wrong.replace("...", " "),
          suggested: rule.correct.replace("...", " "),
          explanation: `Verb agreement error: ${rule.rule}`,
          confidence: 0.75,
        });
      }
    }

    const honorific = (errorPatterns.grammar?.honorific ?? []) as Array<{
      wrong: string;
      correct: string;
      rule: string;
    }>;

    for (const rule of honorific) {
      if (lower.includes(rule.wrong.toLowerCase())) {
        issues.push({
          type: "honorific",
          original: rule.wrong,
          suggested: rule.correct,
          explanation: `Honorific mismatch: use formal verb form`,
          confidence: 0.8,
        });
      }
    }

    if (/\d+\s*liter\s+(chamal|rice|aalu|alu)/i.test(lower)) {
      issues.push({
        type: "unit_mismatch",
        original: text,
        suggested: text.replace(/liter/i, "kg"),
        explanation: "Rice/grains are typically measured in kg, not liters",
        confidence: 0.85,
      });
    }

    return issues;
  }
}

export const grammarAnalyzer = new GrammarAnalyzer();
