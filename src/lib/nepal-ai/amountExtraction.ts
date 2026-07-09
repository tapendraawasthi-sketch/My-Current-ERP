/**
 * Nepal amount extraction — rule-driven parsing for Nepali retail/accounting phrases.
 * Corpus: data/nepal-ai/language/amount_extraction_patterns.jsonl
 */

import {
  AMOUNT_EXTRACTION_EXAMPLES,
  AMOUNT_EXTRACTION_BY_INPUT,
  NUMBER_WORD_VALUES,
} from "./generated/runtimeMaps";

export type AmountExtractionResult = {
  amount: number | null;
  quantity: number | null;
  unitPrice: number | null;
  minAmount: number | null;
  maxAmount: number | null;
  approximate: boolean;
  rule: string | null;
  calculation: string | null;
};

const EMPTY: AmountExtractionResult = {
  amount: null,
  quantity: null,
  unitPrice: null,
  minAmount: null,
  maxAmount: null,
  approximate: false,
  rule: null,
  calculation: null,
};

const FRACTIONS: Record<string, number> = {
  sawa: 1.25,
  saawa: 1.25,
  dedh: 1.5,
  derh: 1.5,
  dhai: 2.5,
  aadha: 0.5,
  adha: 0.5,
  paune: 0.75,
  pauna: 0.75,
  poune: 0.75,
  pune: 0.75,
};

const UNITS: Record<string, number> = {
  saya: 100,
  sayaa: 100,
  sau: 100,
  hajar: 1000,
  hazar: 1000,
  hajaar: 1000,
  thousand: 1000,
  lakh: 100_000,
  lac: 100_000,
  karod: 10_000_000,
  crore: 10_000_000,
  cr: 10_000_000,
};

const SMALL_WORDS: Record<string, number> = {
  ek: 1,
  one: 1,
  dui: 2,
  two: 2,
  tin: 3,
  three: 3,
  char: 4,
  four: 4,
  paanch: 5,
  panch: 5,
  five: 5,
  chha: 6,
  six: 6,
  sat: 7,
  saat: 7,
  seven: 7,
  aath: 8,
  eight: 8,
  nau: 9,
  nine: 9,
  das: 10,
  ten: 10,
  ...Object.fromEntries(
    Object.entries(NUMBER_WORD_VALUES).filter(([, v]) => v >= 1 && v < 100 && Number.isInteger(v)),
  ),
};

const QTY_WORDS =
  "(?:piece|pieces|pcs?|wota|ota|euta|eutako|eutai|plate|plates|jana|kg|kilo|kilos|gram|g|litre|liter|ltr|patak)";

function norm(text: string): string {
  return text
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/[₹₨]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function roundAmt(n: number): number {
  return Math.abs(n - Math.round(n)) < 1e-9 ? Math.round(n) : Math.round(n * 100) / 100;
}

function parseNumToken(tok: string): number | null {
  if (/^\d+(?:\.\d+)?$/.test(tok)) return parseFloat(tok);
  if (tok in SMALL_WORDS) return SMALL_WORDS[tok];
  if (tok in NUMBER_WORD_VALUES) {
    const v = NUMBER_WORD_VALUES[tok];
    if (v >= 1 && v < 100) return v;
  }
  return null;
}

function unitOf(tok: string): number | null {
  return UNITS[tok] ?? null;
}

function fractionOf(tok: string): number | null {
  return FRACTIONS[tok] ?? null;
}

/** Strip fiscal-year noise like 2081/82 so it is not treated as an amount. */
function stripFiscalYear(t: string): string {
  return t
    .replace(/\b20\d{2}\s*\/\s*\d{2}\b/g, " ")
    .replace(/\b20\d{2}\s*[-–]\s*\d{2,4}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resultScalar(
  amount: number,
  rule: string,
  calc: string,
  extra: Partial<AmountExtractionResult> = {},
): AmountExtractionResult {
  return {
    ...EMPTY,
    amount: roundAmt(amount),
    rule,
    calculation: calc,
    ...extra,
  };
}

function resultRange(
  min: number,
  max: number,
  rule: string,
  approx = false,
): AmountExtractionResult {
  const mid = roundAmt((min + max) / 2);
  return {
    ...EMPTY,
    amount: mid,
    minAmount: roundAmt(min),
    maxAmount: roundAmt(max),
    approximate: approx,
    rule,
    calculation: approx ? `range ~${min}-${max}` : `range ${min}-${max}`,
  };
}

function tryExactCorpus(t: string): AmountExtractionResult | null {
  const hit = AMOUNT_EXTRACTION_BY_INPUT[t] || AMOUNT_EXTRACTION_BY_INPUT[norm(t)];
  if (!hit) return null;
  const entry = AMOUNT_EXTRACTION_EXAMPLES.find((e) => e.id === hit.id);
  const fa = hit.finalAmount;
  if (typeof fa === "number") {
    const ent = entry?.entities ?? {};
    return {
      ...EMPTY,
      amount: fa,
      quantity: typeof ent.quantity === "number" ? ent.quantity : null,
      unitPrice: typeof ent.unit_price === "number" ? ent.unit_price : null,
      rule: hit.extractionRule,
      calculation: hit.calculation,
      approximate: String(hit.calculation).startsWith("~"),
    };
  }
  if (typeof fa === "string") {
    const approx = fa.startsWith("~");
    const body = fa.replace(/^~/, "");
    const range = body.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
    if (range) {
      return resultRange(parseFloat(range[1]), parseFloat(range[2]), hit.extractionRule, approx);
    }
    const single = body.match(/^(\d+(?:\.\d+)?)$/);
    if (single) {
      return {
        ...resultScalar(parseFloat(single[1]), hit.extractionRule, hit.calculation),
        approximate: approx,
      };
    }
  }
  return null;
}

/** Fraction + optional digit/word + unit (+ optional more units) — sawa 2 hajar, paune char hajar, dedh lakh */
function tryFractionalMagnitude(t: string): AmountExtractionResult | null {
  // sawa 3 lakh 50 hajar / paune 4 hajar 3 saya / sawa 1 hajar 2 saya / dedh hajar 2 saya
  const compound = t.match(
    /\b(sawa|saawa|dedh|derh|paune|pauna|poune|aadha|adha)\s+(\d+(?:\.\d+)?|[a-z]+)?\s*(hajar|hazar|lakh|lac|karod|crore|saya)\b(?:\s+(\d+(?:\.\d+)?|[a-z]+)\s*(hajar|hazar|saya))?\b/i,
  );
  if (compound) {
    const frac = fractionOf(compound[1].toLowerCase());
    if (frac == null) return null;
    const midTok = (compound[2] || "").toLowerCase();
    const unit1 = unitOf(compound[3].toLowerCase())!;
    let baseNum = midTok ? parseNumToken(midTok) : 1;
    if (baseNum == null) baseNum = 1;
    // "paune char hajar" — midTok is word number, unit is hajar → base = 4 * 1000, amount = 0.75 * base
    // "dedh lakh" — no midTok → base = 1 * lakh, amount = 1.5 * lakh
    // "sawa 2 hajar" — mid * unit
    let main = roundAmt(frac * baseNum * unit1);
    // special: when midTok absent and fraction applies to unit alone — correct via frac * unit
    if (!midTok) main = roundAmt(frac * unit1);

    let extra = 0;
    if (compound[4] && compound[5]) {
      const n2 = parseNumToken(compound[4].toLowerCase());
      const u2 = unitOf(compound[5].toLowerCase());
      if (n2 != null && u2 != null) extra = n2 * u2;
    }
    const amount = roundAmt(main + extra);
    return resultScalar(
      amount,
      extra ? "fractional_compound" : "fractional_nepali_magnitude",
      extra ? `${main} + ${extra} = ${amount}` : `${frac} * ${baseNum * unit1} = ${amount}`,
    );
  }
  return null;
}

/** Bare fractional before digit+unit already handled; also "sawa saya", "aadha karod" */
function trySimpleFractionUnit(t: string): AmountExtractionResult | null {
  const m = t.match(
    /\b(sawa|saawa|dedh|derh|paune|pauna|aadha|adha)\s+(saya|sayaa|hajar|hazar|lakh|lac|karod|crore)\b/i,
  );
  if (!m) return null;
  const frac = fractionOf(m[1].toLowerCase())!;
  const unit = unitOf(m[2].toLowerCase())!;
  const amount = roundAmt(frac * unit);
  return resultScalar(amount, "fractional_nepali_word_to_number", `${frac} * ${unit} = ${amount}`);
}

/** Compound number words: 4 hajar 5 saya, jamma 12 hajar 3 saya, ek saya 50 */
function tryCompoundNepali(t: string): AmountExtractionResult | null {
  const m = t.match(
    /\b(\d+(?:\.\d+)?|[a-z]+)\s+(hajar|hazar)\s+(\d+(?:\.\d+)?|[a-z]+)\s+(saya|sayaa)\b/i,
  );
  if (m) {
    const a = parseNumToken(m[1].toLowerCase());
    const b = parseNumToken(m[3].toLowerCase());
    if (a != null && b != null) {
      const amount = roundAmt(a * 1000 + b * 100);
      return resultScalar(amount, "compound_nepali_number", `${a * 1000} + ${b * 100} = ${amount}`);
    }
  }
  const h = t.match(/\b(ek|dui|tin|char|paanch|panch)\s+(saya|sayaa)\s+(\d+(?:\.\d+)?)\b/i);
  if (h) {
    const a = parseNumToken(h[1].toLowerCase())!;
    const rest = parseFloat(h[3]);
    const amount = roundAmt(a * 100 + rest);
    return resultScalar(amount, "compound_nepali_number_hundreds", `${a * 100} + ${rest} = ${amount}`);
  }
  return null;
}

/** Ranges: 5-6 hajar, 50-60 hajar, lagbhag 2500-2600, 6-7 hajar 5 saya */
function tryRange(t: string): AmountExtractionResult | null {
  const approx = /\b(around|lagbhag|almost|approx|jati)\b/i.test(t);

  const withSaya = t.match(
    /\b(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(hajar|hazar)\s+(\d+(?:\.\d+)?)\s*(saya|sayaa)\b/i,
  );
  if (withSaya) {
    const a = parseFloat(withSaya[1]);
    const b = parseFloat(withSaya[2]);
    const hundreds = parseFloat(withSaya[4]) * 100;
    return resultRange(a * 1000 + hundreds, b * 1000 + hundreds, "range_with_compound_shared_unit", approx);
  }

  const withUnit = t.match(
    /\b(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(hajar|hazar|lakh|lac|saya)\b/i,
  );
  if (withUnit) {
    const unit = unitOf(withUnit[3].toLowerCase())!;
    return resultRange(
      parseFloat(withUnit[1]) * unit,
      parseFloat(withUnit[2]) * unit,
      "range_with_shared_unit",
      approx,
    );
  }

  const plain = t.match(/\b(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\b/);
  if (plain && /\b(range|bich|jati|lagbhag|around|almost)\b/i.test(t)) {
    return resultRange(parseFloat(plain[1]), parseFloat(plain[2]), "approximate_range", approx);
  }
  return null;
}

/** Sum of products: "10 ko 20 ra 15 ko 30", "50 eutako 20 wota 30 eutako 10 wota", "2 ota ko 500 ra 3 ota ko 200" */
function trySumOfProducts(t: string): AmountExtractionResult | null {
  const pairsA = [
    ...t.matchAll(/\b(\d+(?:\.\d+)?)\s*ko\s*(\d+(?:\.\d+)?)/gi),
  ];
  if (pairsA.length >= 2 && /\bra\b|\s/.test(t)) {
    let sum = 0;
    for (const m of pairsA) sum += parseFloat(m[1]) * parseFloat(m[2]);
    return resultScalar(sum, "sum_of_multiple_products", `sum products = ${sum}`);
  }

  const eutaPairs = [
    ...t.matchAll(/\b(\d+(?:\.\d+)?)\s*eutako\s+(\d+(?:\.\d+)?)\s*(?:wota|ota|piece|pieces)?/gi),
  ];
  if (eutaPairs.length >= 2) {
    let sum = 0;
    for (const m of eutaPairs) sum += parseFloat(m[1]) * parseFloat(m[2]);
    return resultScalar(sum, "sum_of_multiple_products", `sum eutako = ${sum}`);
  }

  const otaKo = [
    ...t.matchAll(
      /\b(\d+(?:\.\d+)?)\s*(?:ota|wota|piece|pieces|euta)\s*ko\s*(\d+(?:\.\d+)?)/gi,
    ),
  ];
  if (otaKo.length >= 2) {
    let sum = 0;
    for (const m of otaKo) sum += parseFloat(m[1]) * parseFloat(m[2]);
    return resultScalar(sum, "sum_of_multiple_products", `sum ota*price = ${sum}`);
  }
  return null;
}

/** Unit price × qty: "500 ko 10 piece", "50 eutako 20 wota", "saya ko 7 piece", "dedh hajar ko 3 ota" */
function tryUnitPriceTimesQty(t: string): AmountExtractionResult | null {
  // Price word/fraction + unit + ko + qty
  const fracPriceQty = t.match(
    /\b(sawa|dedh|derh|paune|pauna|aadha|adha)?\s*(\d+(?:\.\d+)?)?\s*(saya|sayaa|hajar|hazar|lakh|lac|rupaiya|rupees?|rs)?\s*ko\s+(\d+(?:\.\d+)?)\s*(?:piece|pieces|pcs?|wota|ota|euta|plate|plates|kg|kilo)?\b/i,
  );
  // More precise patterns below.

  // "X eutako Y wota/ota/piece"
  const eutako = t.match(
    /\b(\d+(?:\.\d+)?)\s*eutako\s+(\d+(?:\.\d+)?)\s*(?:wota|ota|piece|pieces|plate|plates)?\b/i,
  );
  if (eutako) {
    const unit = parseFloat(eutako[1]);
    const qty = parseFloat(eutako[2]);
    return resultScalar(unit * qty, "unit_price * quantity = total", `${unit} * ${qty} = ${unit * qty}`, {
      unitPrice: unit,
      quantity: qty,
    });
  }

  // Fractional/word unit price ko qty: "dedh hajar ko 3 ota", "saya ko 7 piece", "aadha saya ko 10 ota", "hajar ko 5 ota"
  const wordPrice = t.match(
    /\b(?:(sawa|dedh|derh|paune|pauna|aadha|adha)\s+)?(?:(\d+(?:\.\d+)?)\s+)?(saya|sayaa|hajar|hazar|lakh)\s+ko\s+(\d+(?:\.\d+)?)\s*(?:piece|pieces|pcs?|wota|ota|euta|kitab|ghar|saman)?\b/i,
  );
  if (wordPrice) {
    const frac = wordPrice[1] ? fractionOf(wordPrice[1].toLowerCase()) : 1;
    const mid = wordPrice[2] ? parseFloat(wordPrice[2]) : 1;
    const unit = unitOf(wordPrice[3].toLowerCase())!;
    const price = roundAmt((frac ?? 1) * mid * unit);
    const qty = parseFloat(wordPrice[4]);
    return resultScalar(price * qty, "unit_price_word * quantity", `${price} * ${qty}`, {
      unitPrice: price,
      quantity: qty,
    });
  }

  // "N rupaiya ko M piece/wota" / "N ko M piece"
  const koQty = t.match(
    /\b(\d+(?:\.\d+)?)\s*(?:rupaiya|rupees?|rs|npr)?\s*(?:piece\s*)?ko\s+(\d+(?:\.\d+)?)\s*(?:piece|pieces|pcs?|wota|ota|euta|kg|kilo)?\b/i,
  );
  if (koQty) {
    const unit = parseFloat(koQty[1]);
    const qty = parseFloat(koQty[2]);
    // Avoid treating "20 wota lai 5000" — handled elsewhere
    if (/\blai\b|\bma\s+thik\b|\bhajar\s*ma\b/i.test(t) && unit < qty && qty >= 100) {
      // likely bulk total phrasing slipped — skip here
    } else {
      return resultScalar(unit * qty, "unit_price * quantity = total", `${unit} * ${qty}`, {
        unitPrice: unit,
        quantity: qty,
      });
    }
  }

  // "rate X … Y kg/piece" / "X ko dar le Y"
  const rateDar = t.match(
    /\b(?:rate\s+)?(\d+(?:\.\d+)?)\s*(?:rupaiya|rupees?|rs)?\s*(?:ko\s+)?(?:dar|rate|kilo)?\s*(?:le\s+)?(\d+(?:\.\d+)?)\s*(?:kg|kilo|piece|pieces|pcs?|wota|ota)?\b/i,
  );
  if (rateDar && /\b(rate|dar|kilo|kg|piece)\b/i.test(t)) {
    const unit = parseFloat(rateDar[1]);
    const qty = parseFloat(rateDar[2]);
    return resultScalar(unit * qty, "unit_price * quantity = total", `${unit} * ${qty}`, {
      unitPrice: unit,
      quantity: qty,
    });
  }

  // "2.5 kg ko 800" weight * price
  const wtPrice = t.match(
    /\b(\d+(?:\.\d+)?)\s*(?:kg|kilo)\s*ko\s*(\d+(?:\.\d+)?)/i,
  );
  if (wtPrice) {
    const w = parseFloat(wtPrice[1]);
    const p = parseFloat(wtPrice[2]);
    return resultScalar(w * p, "weight * unit_price = total", `${w} * ${p}`, {
      quantity: w,
      unitPrice: p,
    });
  }

  // "kilo ko 1200 le 3.5 kilo" / "rate 80 rupaiya kilo ko 5.5 kg"
  const kiloRate = t.match(
    /\b(?:kilo\s*ko\s*|rate\s+)?(\d+(?:\.\d+)?)\s*(?:rupaiya\s*)?(?:kilo\s*ko\s*)?(\d+(?:\.\d+)?)\s*(?:kg|kilo)\b/i,
  );
  if (kiloRate && /\b(kilo|kg)\b/i.test(t)) {
    const unit = parseFloat(kiloRate[1]);
    const qty = parseFloat(kiloRate[2]);
    return resultScalar(unit * qty, "unit_price * decimal_quantity", `${unit} * ${qty}`, {
      unitPrice: unit,
      quantity: qty,
    });
  }

  // "300 ko 12 kg"
  const perKg = t.match(/\b(\d+(?:\.\d+)?)\s*ko\s*(\d+(?:\.\d+)?)\s*(?:kg|kilo)\b/i);
  if (perKg) {
    const unit = parseFloat(perKg[1]);
    const qty = parseFloat(perKg[2]);
    return resultScalar(unit * qty, "unit_price_per_kg * weight", `${unit} * ${qty}`, {
      unitPrice: unit,
      quantity: qty,
    });
  }

  // "15 rupaiya piece ko 60 ota"
  const pieceKo = t.match(
    /\b(\d+(?:\.\d+)?)\s*(?:rupaiya|rupees?|rs)?\s*piece\s*ko\s*(\d+(?:\.\d+)?)\s*(?:ota|wota|piece)?\b/i,
  );
  if (pieceKo) {
    const unit = parseFloat(pieceKo[1]);
    const qty = parseFloat(pieceKo[2]);
    return resultScalar(unit * qty, "unit_price * quantity = total", `${unit} * ${qty}`, {
      unitPrice: unit,
      quantity: qty,
    });
  }

  // "3.5 hajar ko 4 ota" decimal thousand × qty
  const decHajar = t.match(
    /\b(\d+(?:\.\d+)?)\s*(hajar|hazar|lakh)\s*ko\s*(\d+(?:\.\d+)?)\s*(?:ota|wota|piece|ghar)?\b/i,
  );
  if (decHajar) {
    const n = parseFloat(decHajar[1]);
    const u = unitOf(decHajar[2].toLowerCase())!;
    const qty = parseFloat(decHajar[3]);
    const price = n * u;
    return resultScalar(price * qty, "unit_price_decimal_thousand * quantity", `${price} * ${qty}`, {
      unitPrice: price,
      quantity: qty,
    });
  }

  // "1.5 lakh ka 3 ghar"
  const mixedQty = t.match(
    /\b(\d+(?:\.\d+)?)\s*(lakh|lac|hajar|karod)\s*(?:ka|ko)\s*(\d+(?:\.\d+)?)\s*(?:ghar|ota|wota|piece)?\b/i,
  );
  if (mixedQty) {
    const price = parseFloat(mixedQty[1]) * unitOf(mixedQty[2].toLowerCase())!;
    const qty = parseFloat(mixedQty[3]);
    return resultScalar(price * qty, "unit_price_mixed * quantity", `${price} * ${qty}`, {
      unitPrice: price,
      quantity: qty,
    });
  }

  // "7.5 ko dar le 100 piece"
  const darLe = t.match(
    /\b(\d+(?:\.\d+)?)\s*ko\s*dar\s*le\s*(\d+(?:\.\d+)?)\s*(?:piece|pieces|pcs?|wota|ota)?\b/i,
  );
  if (darLe) {
    const unit = parseFloat(darLe[1]);
    const qty = parseFloat(darLe[2]);
    return resultScalar(unit * qty, "decimal_unit_price * quantity", `${unit} * ${qty}`, {
      unitPrice: unit,
      quantity: qty,
    });
  }

  // "kati bhayo 10 ko 12 le"
  const kati = t.match(/\b(\d+(?:\.\d+)?)\s*ko\s*(\d+(?:\.\d+)?)\s*le\b/i);
  if (kati) {
    const unit = parseFloat(kati[1]);
    const qty = parseFloat(kati[2]);
    return resultScalar(unit * qty, "unit_price * quantity = total", `${unit} * ${qty}`, {
      unitPrice: unit,
      quantity: qty,
    });
  }

  void fracPriceQty;
  return null;
}

/** Daily / per-person / patak */
function tryRateTimesCount(t: string): AmountExtractionResult | null {
  const daily = t.match(
    /\bdin\s*ko\s*(\d+(?:\.\d+)?)\s*(?:ko\s*)?(?:hisab\s*le\s*)?(\d+(?:\.\d+)?)\s*din\b/i,
  );
  if (daily) {
    const rate = parseFloat(daily[1]);
    const days = parseFloat(daily[2]);
    return resultScalar(rate * days, "daily_rate * days = total", `${rate} * ${days}`, {
      unitPrice: rate,
      quantity: days,
    });
  }

  const perHead =
    t.match(
      /\b(\d+(?:\.\d+)?)\s*(?:rupaiya|rupees?|rs)?\s*(?:per\s*head|ko\s*hisab\s*le)\s*(\d+(?:\.\d+)?)\s*(?:jana|janna|people|persons?)?\b/i,
    ) ||
    t.match(/\b(\d+(?:\.\d+)?)\s*ko\s*hisab\s*le\s*(\d+(?:\.\d+)?)\s*jana\b/i);
  if (perHead) {
    const rate = parseFloat(perHead[1]);
    const people = parseFloat(perHead[2]);
    return resultScalar(rate * people, "per_person_rate * people", `${rate} * ${people}`, {
      unitPrice: rate,
      quantity: people,
    });
  }

  const patak = t.match(
    /\b(\d+(?:\.\d+)?)\s*ko\s*patak\s*ma\s*(\d+(?:\.\d+)?)\s*patak\b/i,
  );
  if (patak) {
    const rate = parseFloat(patak[1]);
    const n = parseFloat(patak[2]);
    return resultScalar(rate * n, "per_instance * instances", `${rate} * ${n}`, {
      unitPrice: rate,
      quantity: n,
    });
  }
  return null;
}

/** Bulk total for quantity (do not multiply): "20 wota lai 5000 ma", "8 hajar ma 4 ota" */
function tryBulkTotal(t: string): AmountExtractionResult | null {
  const a = t.match(
    /\b(\d+(?:\.\d+)?)\s*(?:wota|ota|piece|pieces)\s+lai\s+(\d+(?:\.\d+)?)\s*ma\b/i,
  );
  if (a) {
    const qty = parseFloat(a[1]);
    const amount = parseFloat(a[2]);
    return resultScalar(amount, "total_for_bulk_quantity", String(amount), {
      quantity: qty,
    });
  }
  const b = t.match(
    /\b(\d+(?:\.\d+)?)\s*(hajar|hazar|lakh)\s*ma\s*(\d+(?:\.\d+)?)\s*(?:ota|wota|piece|saman)\b/i,
  );
  if (b) {
    const amount = parseFloat(b[1]) * unitOf(b[2].toLowerCase())!;
    const qty = parseFloat(b[3]);
    return resultScalar(amount, "total_for_bulk_quantity", String(amount), { quantity: qty });
  }
  return null;
}

/** Approximate single amount */
function tryApproximate(t: string): AmountExtractionResult | null {
  if (!/\b(around|lagbhag|almost|approx|jati)\b/i.test(t)) return null;
  if (/\d+\s*[-–]\s*\d+/.test(t)) return null; // ranges handled separately
  // Prefer fractional magnitudes already; else first clear magnitude number
  const hajar = t.match(/\b(\d+(?:\.\d+)?)\s*(hajar|hazar|lakh|saya)\b/i);
  if (hajar) {
    const amount = parseFloat(hajar[1]) * unitOf(hajar[2].toLowerCase())!;
    return { ...resultScalar(amount, "approximate_amount", `~${amount}`), approximate: true };
  }
  const n = t.match(/\b(\d{2,}(?:\.\d+)?)\b/);
  if (n) {
    const amount = parseFloat(n[1]);
    return { ...resultScalar(amount, "approximate_amount", `~${amount}`), approximate: true };
  }
  return null;
}

/** "ek karod bata 50 lakh nafa" → take the subset amount (50 lakh) */
function trySubsetContext(t: string): AmountExtractionResult | null {
  const m = t.match(
    /\b(?:ek\s+)?(?:karod|crore)\s+bata\s+(\d+(?:\.\d+)?)\s*(lakh|lac|hajar)\b/i,
  );
  if (m) {
    const amount = parseFloat(m[1]) * unitOf(m[2].toLowerCase())!;
    return resultScalar(amount, "subset_from_larger_context", String(amount));
  }
  return null;
}

/** Digit/word × unit fallback: "8 hajar", "3.5 hajar" when not consumed */
function tryPlainMagnitude(t: string): AmountExtractionResult | null {
  const m = t.match(/\b(\d+(?:\.\d+)?)\s*(hajar|hazar|lakh|lac|karod|crore|saya)\b/i);
  if (!m) return null;
  // Skip if looks like price×qty with remaining qty elsewhere and "ko" after unit
  if (new RegExp(`${m[0]}\\s*ko\\s*\\d+`, "i").test(t)) return null;
  const amount = parseFloat(m[1]) * unitOf(m[2].toLowerCase())!;
  return resultScalar(amount, "plain_magnitude", String(amount));
}

/**
 * Extract Nepali/English transaction amounts using trained extraction rules.
 */
export function extractNepaliAmount(text: string): AmountExtractionResult {
  if (!text?.trim()) return { ...EMPTY };
  let t = stripFiscalYear(norm(text));

  const exact = tryExactCorpus(t);
  if (exact?.amount != null || exact?.minAmount != null) return exact;

  const pipeline: Array<() => AmountExtractionResult | null> = [
    () => trySumOfProducts(t),
    () => tryRange(t),
    () => tryBulkTotal(t),
    () => tryFractionalMagnitude(t),
    () => trySimpleFractionUnit(t),
    () => tryCompoundNepali(t),
    () => tryUnitPriceTimesQty(t),
    () => tryRateTimesCount(t),
    () => trySubsetContext(t),
    () => tryApproximate(t),
    () => tryPlainMagnitude(t),
  ];

  for (const step of pipeline) {
    const hit = step();
    if (hit && (hit.amount != null || hit.minAmount != null)) return hit;
  }

  // Digits after fiscal strip — prefer last "money-like" number (>= 10 or sole number)
  const nums = [...t.matchAll(/\b(\d+(?:\.\d+)?)\b/g)].map((m) => parseFloat(m[1]));
  if (nums.length === 1) {
    return resultScalar(nums[0], "single_digit", String(nums[0]));
  }
  if (nums.length > 1) {
    // Prefer max if no multiply cues already failed
    const max = Math.max(...nums);
    return resultScalar(max, "largest_digit_fallback", String(max));
  }

  return { ...EMPTY };
}

/** Scalar amount for journal posting — midpoint for ranges; ignores quantity alone. */
export function extractNepaliAmountValue(text: string): number | null {
  const r = extractNepaliAmount(text);
  return r.amount;
}
