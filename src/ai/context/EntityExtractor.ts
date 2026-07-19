/** SUTRA AI — entity extraction system (products, amounts, parties, dates) */

import type { ExtractedEntities } from "../types";
import { productCatalog } from "../knowledge/ProductCatalog";
import { domainKnowledge } from "../knowledge/DomainKnowledge";
import { romanNepaliProcessor } from "../language/RomanNepaliProcessor";
import { nepaliProcessor } from "../language/NepaliProcessor";
import { transliterator } from "../language/Transliterator";
import unitMappings from "@/data/erp/unit-mappings.json";
import { multiItemEntityParser } from "./MultiItemEntityParser";
import { compoundPartyParser } from "./CompoundPartyParser";

const NEPALI_DIGIT_MAP: Record<string, string> = {
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
};

const PAYMENT_PATTERNS: Array<{ mode: ExtractedEntities["paymentMode"]; re: RegExp }> = [
  { mode: "cash", re: /\b(nagad|cash|rokka)\b/i },
  { mode: "credit", re: /\b(udhaar|udhar|credit|dhari)\b/i },
  { mode: "bank", re: /\b(bank|cheque|check|online|esewa|khalti|transfer)\b/i },
];

const DATE_PATTERNS: Array<{ ref: string; re: RegExp }> = [
  { ref: "today", re: /\b(aaja|aja|today)\b/i },
  { ref: "yesterday", re: /\b(hijo|yesterday)\b/i },
  { ref: "day_before", re: /\b(parsi|tomorrow|bholi)\b/i },
];

const VERB_MAP: Record<string, string> = {
  bechye: "sold", becheko: "sold", bechya: "sold", bech: "sell",
  kinyo: "bought", kineko: "bought", kinna: "buy",
  tiryo: "paid", diye: "gave", firta: "returned",
};

const COMMON_PARTIES = [
  "ram", "shyam", "hari", "gita", "sita", "krishna", "mohan", "ramesh",
  "customer", "supplier", "party",
];

export class EntityExtractor {
  extract(text: string, contextProducts?: string[]): ExtractedEntities {
    const normalized = romanNepaliProcessor.normalize(text);
    const lower = normalized.toLowerCase();
    const entities: ExtractedEntities = {};

    // Transaction pattern match (highest priority)
    const pattern = domainKnowledge.matchTransactionPattern(normalized);
    if (pattern) {
      entities.transactionType = pattern.type as ExtractedEntities["transactionType"];
      if (pattern.fields.agent) entities.agent = pattern.fields.agent;
      if (pattern.fields.amount) entities.amount = parseInt(pattern.fields.amount, 10);
      if (pattern.fields.quantity) entities.quantity = parseInt(pattern.fields.quantity, 10);
      if (pattern.fields.unit) entities.unit = pattern.fields.unit.toLowerCase();
      if (pattern.fields.party) entities.party = pattern.fields.party;
      if (pattern.fields.product) {
        this.fillProduct(entities, pattern.fields.product, contextProducts);
      }
      if (pattern.fields.verb) entities.verb = VERB_MAP[pattern.fields.verb.toLowerCase()] ?? pattern.fields.verb;
    }

    // MAI-09: duration before money — "5 maina ko" is not amount
    const durationMatch = lower.match(
      /\b(\d+)\s*(maina|mahina|month|months)\b/,
    );
    const durationDeva = text.match(/([०-९]+)\s*महिना/);
    if (durationMatch || durationDeva) {
      // Leave amount unset; duration handled as non-money cue
    } else {
      // Amount: "500 ko" pattern (only when not a duration unit)
      if (!entities.amount) {
        const amountKo = lower.match(/(\d+)\s*ko\b/);
        if (amountKo) entities.amount = parseInt(amountKo[1], 10);
      }

      // Nepali digits
      const devaAmount = text.match(/([०-९]+)\s*को/);
      if (devaAmount && !entities.amount) {
        const latin = [...devaAmount[1]].map((c) => NEPALI_DIGIT_MAP[c] ?? c).join("");
        entities.amount = parseInt(latin, 10);
      }
    }

    // Quantity + unit
    if (!entities.quantity) {
      const qtyMatch = lower.match(/(\d+)\s*(kg|kilo|keji|piece|wata|litre|liter|litr|bora|pathi|darjan|dozen)\b/i);
      if (qtyMatch) {
        entities.quantity = parseInt(qtyMatch[1], 10);
        entities.unit = this.normalizeUnit(qtyMatch[2]);
      }
    }

    // Product from catalog
    if (!entities.product) {
      const tokens = lower.split(/\s+/).filter((t) => t.length > 2 && !/^\d+$/.test(t));
      for (const token of tokens) {
        const found = productCatalog.findProduct(token);
        if (found) {
          entities.product = found.entry.romanVariants[0] ?? found.nepali;
          entities.productNepali = found.nepali;
          entities.productEnglish = found.entry.english;
          break;
        }
      }
    }

    // Context fallback: if discussing vegetables and token is misspelled, try context products
    if (!entities.product && contextProducts?.length) {
      for (const token of lower.split(/\s+/)) {
        if (contextProducts.some((p) => token.includes(p) || p.includes(token))) {
          this.fillProduct(entities, token, contextProducts);
          break;
        }
      }
    }

    // Party: "X lai" pattern
    if (!entities.party) {
      const partyMatch = lower.match(/\b([a-z]{2,15})\s+lai\b/i);
      if (partyMatch && !["ma", "timi", "tapai"].includes(partyMatch[1])) {
        entities.party = partyMatch[1];
      }
    }

    // Known party names
    if (!entities.party) {
      for (const name of COMMON_PARTIES) {
        if (new RegExp(`\\b${name}\\b`, "i").test(lower)) {
          entities.party = name;
          break;
        }
      }
    }

    // Payment mode
    for (const { mode, re } of PAYMENT_PATTERNS) {
      if (re.test(lower)) {
        entities.paymentMode = mode;
        break;
      }
    }

    // Date reference
    for (const { ref, re } of DATE_PATTERNS) {
      if (re.test(lower)) {
        entities.dateRef = ref;
        break;
      }
    }

    // Verb
    if (!entities.verb) {
      for (const [form, eng] of Object.entries(VERB_MAP)) {
        if (new RegExp(`\\b${form}\\b`, "i").test(lower)) {
          entities.verb = eng;
          if (!entities.transactionType) {
            entities.transactionType = /sold|sell/.test(eng) ? "sales" : /bought|buy/.test(eng) ? "purchase" : undefined;
          }
          break;
        }
      }
    }

    // Agent pronouns
    if (!entities.agent) {
      const agentMatch = lower.match(/\b(maile|usle|unle|timile|tapaille)\b/i);
      if (agentMatch) entities.agent = agentMatch[1];
    }

    const multiLines = multiItemEntityParser.parse(normalized);
    if (multiLines.length >= 2) {
      entities.lines = multiLines;
      const total = multiLines.reduce((sum, l) => sum + (l.amount ?? 0), 0);
      if (total > 0) entities.amount = total;
      if (!entities.product && multiLines[0]?.product) {
        entities.product = multiLines[0].product;
        entities.productNepali = multiLines[0].productNepali;
        entities.productEnglish = multiLines[0].productEnglish;
      }
    }

    const partyLines = compoundPartyParser.parse(normalized);
    if (partyLines.length >= 2) {
      entities.partyLines = partyLines;
      const total = partyLines.reduce((sum, l) => sum + l.amount, 0);
      if (total > 0) entities.amount = total;
      if (!entities.party && partyLines[0]?.party) entities.party = partyLines[0].party;
      if (/\budhaar\b/i.test(lower)) entities.paymentMode = "credit";
    }

    return entities;
  }

  /** Merge context entities into partial input (e.g. "500 ko" after product mentioned) */
  mergeWithContext(partial: ExtractedEntities, session: {
    lastProduct?: string;
    lastProductNepali?: string;
    lastAmount?: number;
    lastParty?: string;
    lastQuantity?: number;
    lastUnit?: string;
  }): ExtractedEntities {
    return {
      product: partial.product ?? session.lastProduct,
      productNepali: partial.productNepali ?? session.lastProductNepali,
      amount: partial.amount ?? session.lastAmount,
      quantity: partial.quantity ?? session.lastQuantity,
      unit: partial.unit ?? session.lastUnit,
      party: partial.party ?? session.lastParty,
      paymentMode: partial.paymentMode,
      dateRef: partial.dateRef,
      verb: partial.verb,
      transactionType: partial.transactionType,
      agent: partial.agent,
      productEnglish: partial.productEnglish,
    };
  }

  private fillProduct(
    entities: ExtractedEntities,
    token: string,
    contextProducts?: string[],
  ): void {
    const found = productCatalog.findProduct(token);
    if (found) {
      entities.product = found.entry.romanVariants[0] ?? token;
      entities.productNepali = found.nepali;
      entities.productEnglish = found.entry.english;
    } else {
      const lookup = nepaliProcessor.lookup(token);
      if (lookup) {
        entities.product = lookup.entry.romanVariants[0] ?? token;
        entities.productNepali = lookup.nepali;
        entities.productEnglish = lookup.entry.english;
      } else {
        entities.product = token;
        if (contextProducts?.includes(token)) {
          entities.productNepali = transliterator.romanToDevanagari(token);
        }
      }
    }
  }

  private normalizeUnit(raw: string): string {
    const lower = raw.toLowerCase();
    const units = unitMappings.units as Record<string, { roman: string[] }>;
    for (const [canonical, entry] of Object.entries(units)) {
      if (entry.roman.some((r) => r === lower)) return canonical;
    }
    return lower;
  }
}

export const entityExtractor = new EntityExtractor();
