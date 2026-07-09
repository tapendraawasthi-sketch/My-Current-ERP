/** SUTRA AI — parse multiple product+amount segments in one utterance */

import type { ExtractedLineItem } from "../types";
import { productCatalog } from "../knowledge/ProductCatalog";

const SKIP_TOKENS = new Set([
  "maile", "ma", "le", "lai", "ko", "ka", "ki", "ke", "ra", "ani", "and",
  "bechye", "becheko", "kinyo", "kineko", "udhaar", "nagad", "cash", "credit",
  "the", "a", "an",
]);

function fillProduct(line: ExtractedLineItem, token: string): void {
  const found = productCatalog.findProduct(token);
  if (found) {
    line.product = found.entry.romanVariants[0] ?? found.nepali;
    line.productNepali = found.nepali;
    line.productEnglish = found.entry.english;
    return;
  }
  if (token.length >= 3 && !SKIP_TOKENS.has(token.toLowerCase())) {
    line.product = token;
  }
}

function parseSegment(segment: string): ExtractedLineItem | null {
  const lower = segment.toLowerCase().trim();
  if (!lower) return null;

  const line: ExtractedLineItem = {};

  const koProduct = lower.match(/(\d+)\s*ko\s+([a-z\u0900-\u097F]{2,20})/i);
  if (koProduct) {
    line.amount = parseInt(koProduct[1], 10);
    fillProduct(line, koProduct[2]);
    return line.product || line.amount ? line : null;
  }

  const productAmount = lower.match(/([a-z\u0900-\u097F]{2,20})\s+(\d+)/i);
  if (productAmount) {
    fillProduct(line, productAmount[1]);
    line.amount = parseInt(productAmount[2], 10);
    return line.product || line.amount ? line : null;
  }

  const qtyUnit = lower.match(/(\d+)\s*(kg|kilo|piece|wata|litre|liter|litr|bora)\s+([a-z\u0900-\u097F]{2,20})/i);
  if (qtyUnit) {
    line.quantity = parseInt(qtyUnit[1], 10);
    line.unit = qtyUnit[2].toLowerCase();
    fillProduct(line, qtyUnit[3]);
    return line.product ? line : null;
  }

  return null;
}

export class MultiItemEntityParser {
  /** Returns 2+ line items when a compound sale/purchase is detected */
  parse(text: string): ExtractedLineItem[] {
    const hasSeparator = /\s+(?:ra|ani|and)\s+|,/i.test(text);
    if (!hasSeparator) return [];

    const segments = text.split(/\s+(?:ra|ani|and)\s+|,/i);
    const lines: ExtractedLineItem[] = [];

    for (const segment of segments) {
      const parsed = parseSegment(segment);
      if (parsed) lines.push(parsed);
    }

    return lines.length >= 2 ? lines : [];
  }
}

export const multiItemEntityParser = new MultiItemEntityParser();
