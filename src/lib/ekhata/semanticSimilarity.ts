/**
 * Semantic Similarity Engine — Understanding that different words can mean the same thing.
 * 
 * This module provides:
 * 1. Word-level similarity (synonyms, morphological variants)
 * 2. Phrase-level similarity (paraphrases, different word orders)
 * 3. Concept-level similarity (abstract meaning equivalence)
 * 
 * Key Insight: Humans don't just match strings — they understand that
 * "Ram le paisa tiryo" and "Ram bata payment aayo" mean the same thing.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1: SYNONYM CLUSTERS — Words with the same meaning
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Synonym clusters group words that share the same core meaning.
 * Each cluster represents a single "meaning slot" that can be filled by any member.
 */
const SYNONYM_CLUSTERS: Record<string, string[]> = {
  // Payment/money movement
  "CONCEPT:PAY": [
    "tiryo", "tireko", "tire", "tirna", "tirnu", "tira", "tirdai",
    "paid", "pay", "payment", "settle", "settled", "clear", "cleared",
    "bhugtan", "bhuktan",
    "तिर्यो", "तिरेको", "तिर्नु",
  ],
  
  "CONCEPT:RECEIVE": [
    "payo", "paayo", "paye", "paunu", "paayeko",
    "aayo", "aaye", "aaeko",
    "milyo", "mile", "mileko",
    "received", "got", "collected", "collection",
    "आयो", "पायो",
  ],

  // Buying/purchasing
  "CONCEPT:BUY": [
    "kinyo", "kinye", "kine", "kineko", "kiniyo", "kinnu", "kinna",
    "kharid", "kharidyo", "kharideko", "kharidne", "kharid gareko",
    "bought", "buy", "purchase", "purchased", "procured", "acquire",
    "किन्यो", "किनेको", "खरिद",
  ],

  // Selling
  "CONCEPT:SELL": [
    "bechyo", "bechye", "beche", "becheko", "bechnu", "bechcha",
    "bikri", "bikyo", "bikyayo", "bikne", "bik",
    "sold", "sell", "sale", "sales",
    "बेच्यो", "बेचेको", "बिक्री",
  ],

  // Giving/credit
  "CONCEPT:GIVE": [
    "diye", "diyo", "diya", "die", "diyeko", "dinu", "dinchhu",
    "gave", "give", "given", "lent",
    "दिए", "दिएको", "दिनु",
  ],

  // Credit/outstanding
  "CONCEPT:CREDIT": [
    "udhaar", "udhar", "udharo", "udaro",
    "credit", "on credit", "outstanding", "receivable", "payable",
    "karz", "karja",
    "baki", "baaki",
    "उधारो", "उधार", "बाकी",
  ],

  // Cash
  "CONCEPT:CASH": [
    "nagad", "nakad", "nakit", "nakat", "nagar",
    "cash", "in cash", "cash ma",
    "नगद", "नकद",
  ],

  // Money/currency
  "CONCEPT:MONEY": [
    "paisa", "paise", "rupiya", "rupaya", "rupees", "rupee", "nrs", "npr", "rs",
    "money", "amount", "sum", "fund", "funds",
    "पैसा", "रुपैया",
  ],

  // Goods/items
  "CONCEPT:GOODS": [
    "saman", "samaan", "mal", "maal",
    "goods", "stock", "inventory", "item", "items", "product", "products",
    "सामान", "माल",
  ],

  // Expense
  "CONCEPT:EXPENSE": [
    "kharcha", "kharcho", "kharch",
    "expense", "expenses", "cost", "costs", "spent", "spending",
    "खर्च", "खर्चा",
  ],

  // Profit/gain
  "CONCEPT:PROFIT": [
    "nafa", "naafa", "profit", "gain", "margin", "munafa",
    "नाफा",
  ],

  // Loss
  "CONCEPT:LOSS": [
    "noksan", "nokshan", "ghata", "ghateko",
    "loss", "losses", "deficit",
    "नोक्सान", "घाटा",
  ],

  // Person/party references
  "CONCEPT:PARTY": [
    "party", "person", "customer", "supplier", "vendor", "client",
    "grahak", "bikreta",
    "ग्राहक",
  ],

  // Question words
  "CONCEPT:WHAT": [
    "k", "ke", "kun", "kasto", "kati",
    "what", "which", "how much", "how many",
    "के", "कति",
  ],

  "CONCEPT:HOW": [
    "kasari", "kaise", "kasle",
    "how", "how to", "in what way",
    "कसरी",
  ],
};

/**
 * Get the concept cluster for a word, or null if not found.
 */
export function getConceptCluster(word: string): string | null {
  const normalized = word.toLowerCase().trim();
  for (const [cluster, words] of Object.entries(SYNONYM_CLUSTERS)) {
    if (words.includes(normalized)) {
      return cluster;
    }
  }
  return null;
}

/**
 * Check if two words are semantically similar (same concept cluster).
 */
export function areSynonyms(word1: string, word2: string): boolean {
  const cluster1 = getConceptCluster(word1);
  const cluster2 = getConceptCluster(word2);
  return cluster1 !== null && cluster1 === cluster2;
}

/**
 * Get all synonyms for a word.
 */
export function getSynonyms(word: string): string[] {
  const cluster = getConceptCluster(word);
  if (!cluster) return [];
  return SYNONYM_CLUSTERS[cluster] || [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2: PHRASE PATTERNS — Equivalent ways of saying the same thing
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Phrase patterns that represent the same meaning.
 * These are templates where variables (marked with $) can be filled.
 */
interface PhrasePattern {
  id: string;
  meaning: string;
  patterns: string[];  // Regex patterns
  intent: string;
  extractors: Array<{ name: string; pattern: RegExp }>;
}

const PHRASE_PATTERNS: PhrasePattern[] = [
  // Credit sale patterns
  {
    id: "credit_sale_1",
    meaning: "CREDIT_SALE",
    intent: "khata_credit_sale",
    patterns: [
      "\\b(\\w+)\\s+lai\\s+(\\d+(?:k|hajar|saya|lakh)?)\\s+(?:udhaar|udhar|credit)?\\s*(?:diye|diyo|diya|becheko|beche)",
      "\\b(\\w+)\\s+lai\\s+(?:udhaar|udhar|credit)\\s*(?:ma)?\\s+(\\d+(?:k|hajar|saya|lakh)?)",
      "\\b(?:udhaar|udhar|credit)\\s*(?:ma)?\\s+(\\w+)\\s+lai\\s+(\\d+(?:k|hajar|saya|lakh)?)",
      "\\b(\\w+)\\s+(?:ko\\s+udhaar|ko\\s+udhar)\\s+(\\d+(?:k|hajar|saya|lakh)?)",
    ],
    extractors: [
      { name: "party", pattern: /(\w+)\s+lai/i },
      { name: "amount", pattern: /(\d+(?:k|hajar|saya|lakh)?)/i },
    ],
  },

  // Payment received patterns
  {
    id: "payment_received_1",
    meaning: "PAYMENT_RECEIVED",
    intent: "khata_payment_in",
    patterns: [
      "\\b(\\w+)\\s+le\\s+(\\d+(?:k|hajar|saya|lakh)?)\\s+(?:tiryo|tireko|tire)",
      "\\b(\\w+)\\s+bata\\s+(\\d+(?:k|hajar|saya|lakh)?)\\s+(?:aayo|aaeko|payo|paayo)",
      "\\b(\\d+(?:k|hajar|saya|lakh)?)\\s+(\\w+)\\s+le\\s+(?:tiryo|tireko)",
      "\\b(\\w+)\\s+le\\s+(?:payment|paisa)\\s+(?:garyo|gareko|diye|diyo)",
    ],
    extractors: [
      { name: "party", pattern: /(\w+)\s+(?:le|bata)/i },
      { name: "amount", pattern: /(\d+(?:k|hajar|saya|lakh)?)/i },
    ],
  },

  // Purchase patterns
  {
    id: "purchase_1",
    meaning: "PURCHASE",
    intent: "khata_purchase",
    patterns: [
      "\\b(\\d+(?:k|hajar|saya|lakh)?)\\s+(?:ko|ma)?\\s*(\\w+)?\\s*(?:kinyo|kineko|kharid)",
      "\\b(\\w+)\\s+(?:kinyo|kineko|kharid)\\s+(\\d+(?:k|hajar|saya|lakh)?)",
      "\\b(\\w+)\\s+(?:bata|sanga)\\s+(\\d+(?:k|hajar|saya|lakh)?)\\s*(?:ko)?\\s*(?:saman|mal)?\\s*(?:kinyo|kineko)",
    ],
    extractors: [
      { name: "amount", pattern: /(\d+(?:k|hajar|saya|lakh)?)/i },
      { name: "item", pattern: /(?:ko\s+)?(\w+)\s+(?:kinyo|kineko|kharid)/i },
    ],
  },

  // Definition questions
  {
    id: "definition_q_1",
    meaning: "DEFINITION_QUESTION",
    intent: "question_definition",
    patterns: [
      "\\b(\\w+)\\s+k\\s*ho\\??",
      "\\b(\\w+)\\s+ke\\s*ho\\??",
      "\\bwhat\\s+is\\s+(\\w+)\\??",
      "\\bwhat\\s+are\\s+(\\w+)\\??",
      "\\b(\\w+)\\s+bhanya\\s+k\\s*ho\\??",
      "\\b(\\w+)\\s+ko\\s+(?:matlab|arth|meaning)\\s*k\\s*ho\\??",
    ],
    extractors: [
      { name: "topic", pattern: /(\w+)\s+k\s*ho|what\s+is\s+(\w+)/i },
    ],
  },

  // How-to questions
  {
    id: "howto_q_1",
    meaning: "HOWTO_QUESTION",
    intent: "question_howto",
    patterns: [
      "\\bkasari\\s+(\\w+(?:\\s+\\w+)?)\\s*(?:garne|garnu|hunchha)?\\??",
      "\\bhow\\s+(?:to|do\\s+i|can\\s+i)\\s+(\\w+(?:\\s+\\w+)?)\\??",
      "\\b(\\w+)\\s+kasari\\s+(?:garne|garnu)\\??",
    ],
    extractors: [
      { name: "topic", pattern: /kasari\s+(\w+)|how\s+to\s+(\w+)/i },
    ],
  },
];

/**
 * Match a text against phrase patterns and extract meaning + entities.
 */
export function matchPhrasePattern(text: string): {
  pattern: PhrasePattern;
  extracted: Record<string, string>;
} | null {
  const normalized = text.toLowerCase().trim();
  
  for (const phrasePattern of PHRASE_PATTERNS) {
    for (const patternStr of phrasePattern.patterns) {
      const regex = new RegExp(patternStr, "i");
      if (regex.test(normalized)) {
        // Extract entities
        const extracted: Record<string, string> = {};
        for (const extractor of phrasePattern.extractors) {
          const match = normalized.match(extractor.pattern);
          if (match) {
            extracted[extractor.name] = match[1] || match[2] || "";
          }
        }
        return { pattern: phrasePattern, extracted };
      }
    }
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3: SEMANTIC DISTANCE — How similar are two meanings?
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate semantic similarity between two texts (0-1 scale).
 * Uses multiple signals: word overlap, concept overlap, structure similarity.
 */
export function calculateSemanticSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);
  
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  
  // 1. Word overlap (Jaccard similarity)
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  const wordOverlap = intersection.size / union.size;
  
  // 2. Concept overlap (using synonym clusters)
  const concepts1 = tokens1.map(getConceptCluster).filter(Boolean);
  const concepts2 = tokens2.map(getConceptCluster).filter(Boolean);
  const conceptSet1 = new Set(concepts1);
  const conceptSet2 = new Set(concepts2);
  const conceptIntersection = new Set([...conceptSet1].filter(x => conceptSet2.has(x)));
  const conceptUnion = new Set([...conceptSet1, ...conceptSet2]);
  const conceptOverlap = conceptUnion.size > 0 ? conceptIntersection.size / conceptUnion.size : 0;
  
  // 3. Pattern match similarity
  const pattern1 = matchPhrasePattern(text1);
  const pattern2 = matchPhrasePattern(text2);
  const patternMatch = pattern1 && pattern2 && pattern1.pattern.meaning === pattern2.pattern.meaning ? 1 : 0;
  
  // Weighted combination
  const similarity = (wordOverlap * 0.3) + (conceptOverlap * 0.5) + (patternMatch * 0.2);
  
  return Math.min(similarity, 1);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4: NORMALIZATION — Converting text to canonical form
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize text to a canonical semantic form.
 * This helps with matching different surface forms.
 */
export function normalizeToCanonical(text: string): string {
  let normalized = text.toLowerCase().trim();
  
  // Expand k notation (5k → 5000)
  normalized = normalized.replace(/(\d+)k\b/gi, (_, num) => String(parseInt(num) * 1000));
  
  // Replace synonyms with canonical forms
  const canonicalForms: Record<string, string> = {
    "CONCEPT:PAY": "tiryo",
    "CONCEPT:RECEIVE": "aayo",
    "CONCEPT:BUY": "kineko",
    "CONCEPT:SELL": "becheko",
    "CONCEPT:GIVE": "diye",
    "CONCEPT:CREDIT": "udhaar",
    "CONCEPT:CASH": "nagad",
    "CONCEPT:MONEY": "paisa",
    "CONCEPT:GOODS": "saman",
    "CONCEPT:EXPENSE": "kharcha",
  };
  
  const tokens = normalized.split(/\s+/);
  const normalizedTokens = tokens.map(token => {
    const cluster = getConceptCluster(token);
    if (cluster && canonicalForms[cluster]) {
      return canonicalForms[cluster];
    }
    return token;
  });
  
  return normalizedTokens.join(" ");
}

/**
 * Expand a query to include synonyms for better matching.
 */
export function expandQuery(text: string): string[] {
  const tokens = tokenize(text);
  const expansions: string[][] = [];
  
  for (const token of tokens) {
    const synonyms = getSynonyms(token);
    if (synonyms.length > 0) {
      expansions.push([token, ...synonyms.slice(0, 3)]);
    } else {
      expansions.push([token]);
    }
  }
  
  // Generate combinations (limited to avoid explosion)
  const results: string[] = [text];
  for (let i = 0; i < Math.min(expansions.length, 3); i++) {
    const expansion = expansions[i];
    for (const variant of expansion.slice(0, 2)) {
      if (variant !== tokens[i]) {
        results.push(text.replace(tokens[i], variant));
      }
    }
  }
  
  return [...new Set(results)];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 5: MEANING PRESERVATION — Check if transformation preserves meaning
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if two texts express the same meaning (semantic equivalence).
 * More strict than similarity — requires high confidence match.
 */
export function areSemanticallyEquivalent(text1: string, text2: string, threshold = 0.85): boolean {
  // Quick exact match check
  if (text1.toLowerCase().trim() === text2.toLowerCase().trim()) return true;
  
  // Pattern match check — if both match same pattern with same extracted entities
  const pattern1 = matchPhrasePattern(text1);
  const pattern2 = matchPhrasePattern(text2);
  
  if (pattern1 && pattern2) {
    if (pattern1.pattern.meaning === pattern2.pattern.meaning) {
      // Check if extracted entities are equivalent
      const entities1 = Object.values(pattern1.extracted).join(",");
      const entities2 = Object.values(pattern2.extracted).join(",");
      if (entities1 === entities2) return true;
    }
  }
  
  // Fall back to similarity threshold
  return calculateSemanticSimilarity(text1, text2) >= threshold;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS — Public API
// ═══════════════════════════════════════════════════════════════════════════════

export {
  SYNONYM_CLUSTERS,
  PHRASE_PATTERNS,
};
