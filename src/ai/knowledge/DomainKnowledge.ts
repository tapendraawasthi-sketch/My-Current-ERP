/** SUTRA AI — ERP/Accounting domain knowledge */

import accountingTerms from "@/data/erp/accounting-terms.json";
import transactionPatterns from "@/data/erp/transaction-patterns.json";

export class DomainKnowledge {
  matchTransactionPattern(text: string): {
    type: string;
    fields: Record<string, string>;
    patternId: string;
  } | null {
    const patterns = transactionPatterns.patterns as Array<{
      id: string;
      pattern: string;
      type: string;
      fields: Record<string, number>;
    }>;

    for (const p of patterns) {
      const re = new RegExp(p.pattern, "i");
      const match = text.match(re);
      if (match) {
        const fields: Record<string, string> = {};
        for (const [name, groupIndex] of Object.entries(p.fields)) {
          fields[name] = match[groupIndex] ?? "";
        }
        return { type: p.type, fields, patternId: p.id };
      }
    }
    return null;
  }

  getAccountingTerm(term: string): {
    nepali: string[];
    roman: string[];
    english: string;
  } | null {
    const terms = accountingTerms.terms as Record<string, {
      nepali: string[];
      roman: string[];
      english: string;
    }>;

    const lower = term.toLowerCase();
    for (const [, entry] of Object.entries(terms)) {
      if (
        entry.english.toLowerCase() === lower ||
        entry.roman.some((r) => r.toLowerCase() === lower) ||
        entry.nepali.some((n) => n === term)
      ) {
        return entry;
      }
    }
    return null;
  }

  getRequiredFields(transactionType: "sales" | "purchase"): string[] {
    const txns = accountingTerms.transactions as Record<string, {
      requiredFields: string[];
    }>;
    return txns[transactionType]?.requiredFields ?? [];
  }

  isAccountingContext(text: string): boolean {
    const allRoman = Object.values(
      accountingTerms.terms as Record<string, { roman: string[] }>,
    ).flatMap((t) => t.roman);
    const lower = text.toLowerCase();
    return allRoman.some((r) => lower.includes(r.toLowerCase()));
  }
}

export const domainKnowledge = new DomainKnowledge();
