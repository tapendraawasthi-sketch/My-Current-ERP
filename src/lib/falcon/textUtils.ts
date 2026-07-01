export const STOPWORDS = new Set([
  "a","an","the","is","are","was","were","be","been","being","do","does","did",
  "how","what","when","where","why","which","who","whom","this","that","these","those",
  "i","you","he","she","it","we","they","my","your","his","her","its","our","their",
  "to","of","in","on","at","for","with","by","about","as","into","like","through",
  "after","before","between","out","against","during","without","under","again",
  "and","or","but","if","then","so","not","no","can","could","should","would",
  "will","shall","may","might","must","have","has","had","get","gets","getting",
  "doing","up","down","off","over","just","also","from","me","us","them","there",
]);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s%.\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// Equivalence groups widen recall WITHOUT discarding the original word.
export const SYNONYM_GROUPS: string[][] = [
  ["invoice", "bill", "billing", "bills", "invoices"],
  ["account", "ledger", "ledgers", "accounts", "coa"],
  ["warehouse", "godown", "godowns", "warehouses", "location"],
  ["item", "items", "product", "products", "stock", "inventory", "sku"],
  ["party", "parties", "customer", "customers", "supplier", "suppliers", "vendor", "client"],
  ["voucher", "vouchers", "entry", "entries", "journal"],
  ["report", "reports", "statement", "statements"],
  ["vat", "tax", "gst"],
  ["tds", "withholding"],
  ["pos", "point-of-sale", "retail", "counter"],
  ["shortcut", "shortcuts", "hotkey", "hotkeys", "keyboard"],
  ["fiscal", "financial-year", "fy", "year"],
  ["payment", "pay", "paid"],
  ["receipt", "receive", "received"],
  ["purchase", "buy", "buying", "procurement"],
  ["sales", "sell", "selling", "sale"],
  ["cancel", "void", "cancelled", "voided", "delete"],
  ["print", "printing", "pdf"],
  ["backup", "restore", "export", "import"],
  ["configuration", "config", "settings", "setup", "configure"],
  ["batch", "lot", "expiry"],
  ["challan", "dc", "delivery-challan"],
  ["grn", "goods-receipt", "receipt-note"],
  ["balance", "outstanding", "due"],
  ["transfer", "stock-transfer", "movement"],
  ["password", "login", "credential", "user"],
  ["discount", "sundry", "charge"],
];

const SYNONYM_LOOKUP: Map<string, Set<string>> = new Map();
for (const group of SYNONYM_GROUPS) {
  const set = new Set(group);
  for (const word of group) {
    const existing = SYNONYM_LOOKUP.get(word);
    if (existing) group.forEach((w) => existing.add(w));
    else SYNONYM_LOOKUP.set(word, set);
  }
}

export function expandTokens(tokens: string[]): Set<string> {
  const expanded = new Set<string>();
  for (const t of tokens) {
    expanded.add(t);
    const group = SYNONYM_LOOKUP.get(t);
    if (group) group.forEach((w) => expanded.add(w));
  }
  return expanded;
}
