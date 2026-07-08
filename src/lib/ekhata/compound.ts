/** Detect and split compound transaction messages (Python parity). */

const AMOUNT_COMMA = /\d{1,3}(?:,\d{2,3})+(?:\.\d+)?/g;
const SPLIT = /\s+(?:ra|ani|and|;|\+)\s+|,\s+(?=[a-zA-Z\u0900-\u097F])/i;
const HAS_AMOUNT = /\d|saya|hajar|lakh|panch|das|bees/i;
const TX_VERB =
  /\b(becheko|beche|bechyo|bikri|bikyo|bikne|kineko|kinya|kharid|kinyo|tiryo|tireko|diye|diyeko|deko|kharcha|kharch|expense|bill|salary|talab|bhada|bhaada|kiraya|rent|jama|aayo|aayeko|liyo|payment|paid|sold|purchase|bought|advance|deposit|withdraw|return|firta|refund)\b/i;
const LEADING_FILLER = /^(?:aaja|aja|hijo|bholi|yo|aile)\s+/i;

function protectAmountCommas(text: string): {
  protected: string;
  placeholders: Map<string, string>;
} {
  const placeholders = new Map<string, string>();
  const protectedText = text.replace(AMOUNT_COMMA, (match) => {
    const key = `__AMT${placeholders.size}__`;
    placeholders.set(key, match);
    return key;
  });
  return { protected: protectedText, placeholders };
}

function restoreAmountCommas(text: string, placeholders: Map<string, string>): string {
  let out = text;
  for (const [key, value] of placeholders) {
    out = out.replaceAll(key, value);
  }
  return out;
}

function partIsTransaction(part: string): boolean {
  return HAS_AMOUNT.test(part) && (TX_VERB.test(part) || part.length > 14);
}

export function splitCompoundTransactions(text: string): string[] {
  const t = (text || "").trim();
  if (!t || !HAS_AMOUNT.test(t)) return [t];

  const { protected: protectedText, placeholders } = protectAmountCommas(t);
  let parts = protectedText
    .split(SPLIT)
    .map((p) => p.trim())
    .filter(Boolean);
  parts = parts.map((p) => restoreAmountCommas(p, placeholders));
  if (parts.length < 2) return [t];

  const valid = parts.filter(partIsTransaction);
  if (valid.length < 2) return [t];

  let sharedPrefix = "";
  const m = valid[0].match(LEADING_FILLER);
  if (m) sharedPrefix = m[0].trim();

  return valid.map((part) => {
    if (sharedPrefix && !LEADING_FILLER.test(part) && !TX_VERB.test(part.slice(0, 20))) {
      return `${sharedPrefix} ${part}`.trim();
    }
    return part;
  });
}

export function isCompoundMessage(text: string): boolean {
  return splitCompoundTransactions(text).length > 1;
}
