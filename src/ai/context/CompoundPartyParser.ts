/** SUTRA AI — multiple party+amount segments in one utterance */

import type { ExtractedPartyLine } from "../types";

const SKIP = new Set(["ma", "maile", "timi", "tapai", "ani", "ra", "and", "udhaar", "nagad"]);

export class CompoundPartyParser {
  parse(text: string): ExtractedPartyLine[] {
    const hasMulti =
      /\b(ani|ra|and)\b/i.test(text) &&
      (/\blai\s+\d+/i.test(text) ||
        /\b(le|bata)\s+\d+/i.test(text) ||
        /\b\d+\s+ko\b/i.test(text));
    if (!hasMulti) return [];

    const segments = text.split(/\s+(?:ani|ra|and)\s+/i);
    const lines: ExtractedPartyLine[] = [];

    for (const segment of segments) {
      const lai = segment.match(/\b([a-z\u0900-\u097F]{2,20})\s+lai\s+(\d+)/i);
      if (lai && !SKIP.has(lai[1].toLowerCase())) {
        lines.push({ party: lai[1], amount: parseInt(lai[2], 10) });
        continue;
      }
      const le = segment.match(/\b([a-z\u0900-\u097F]{2,20})\s+le\s+(\d+)/i);
      if (le && !SKIP.has(le[1].toLowerCase())) {
        lines.push({ party: le[1], amount: parseInt(le[2], 10) });
        continue;
      }
      const bata = segment.match(/\b([a-z\u0900-\u097F]{2,20})\s+bata\s+(\d+)/i);
      if (bata && !SKIP.has(bata[1].toLowerCase())) {
        lines.push({ party: bata[1], amount: parseInt(bata[2], 10) });
        continue;
      }
      const ko = segment.match(/\b([a-z\u0900-\u097F]{2,20})\s+ko\s+(\d+)/i);
      if (ko && !SKIP.has(ko[1].toLowerCase())) {
        lines.push({ party: ko[1], amount: parseInt(ko[2], 10) });
      }
    }

    return lines.length >= 2 ? lines : [];
  }
}

export const compoundPartyParser = new CompoundPartyParser();
