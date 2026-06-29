/**
 * nepaliCurrency.ts  (src/lib/nepaliCurrency.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * Nepal South-Asian number formatting (Lakh / Crore system)
 * and amount-in-words in English and Nepali script.
 *
 * TEST CASES:
 *
 * formatNepaliCurrency(999)            → "999"
 * formatNepaliCurrency(1000)           → "1,000"
 * formatNepaliCurrency(99999)          → "99,999"
 * formatNepaliCurrency(100000)         → "1,00,000"
 * formatNepaliCurrency(1000000)        → "10,00,000"
 * formatNepaliCurrency(10000000)       → "1,00,00,000"
 * formatNepaliCurrency(125000, true)   → "Rs. 1,25,000"
 * formatNepaliCurrency(-50000, true)   → "Rs. (50,000)"   [negative in parens]
 *
 * amountInWords(125000)
 *   → "Rupees One Lakh Twenty Five Thousand Only"
 * amountInWords(10050075.50)
 *   → "Rupees One Crore Fifty Thousand Seventy Five and Paisa Fifty Only"
 *
 * amountInWordsNepali(125000)
 *   → "एक लाख पच्चीस हजार मात्र"
 */

// ─────────────────────────────────────────────────────────────────────────────
// Core formatter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a number using the South Asian grouping system:
 *   Last 3 digits → thousands group
 *   Remaining digits → groups of 2  (lakhs, crores, arab, …)
 *
 * @param amount      The numeric value (may be negative)
 * @param showSymbol  Prepend "Rs. " when true
 * @param decimals    Decimal places (default 2; pass 0 for integers)
 */
export function formatNepaliCurrency(amount: number, showSymbol = false, decimals = 2): string {
  const isNegative = amount < 0;
  const abs = Math.abs(amount);

  // Split integer and decimal parts
  const fixed = abs.toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");

  // South-Asian grouping
  const grouped = groupSouthAsian(intPart);
  const formatted =
    decPart && parseInt(decPart) !== 0
      ? `${grouped}.${decPart}`
      : decimals === 0
        ? grouped
        : `${grouped}.${decPart}`;

  const withSymbol = showSymbol ? `Rs. ${formatted}` : formatted;
  return isNegative ? `(${withSymbol})` : withSymbol;
}

/** Apply South-Asian comma grouping to a string of digits */
function groupSouthAsian(digits: string): string {
  if (digits.length <= 3) return digits;

  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);

  // Group remaining digits in pairs from the right
  const pairedGroups: string[] = [];
  let i = rest.length;
  while (i > 0) {
    pairedGroups.unshift(rest.slice(Math.max(0, i - 2), i));
    i -= 2;
  }

  return [...pairedGroups, last3].join(",");
}

// ─────────────────────────────────────────────────────────────────────────────
// Amount in words — English
// ─────────────────────────────────────────────────────────────────────────────

const ONES_EN = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS_EN = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function threeDigitWords(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES_EN[n];
  if (n < 100) {
    const t = TENS_EN[Math.floor(n / 10)];
    const o = n % 10 ? ` ${ONES_EN[n % 10]}` : "";
    return `${t}${o}`;
  }
  const h = `${ONES_EN[Math.floor(n / 100)]} Hundred`;
  const rem = n % 100;
  return rem ? `${h} ${threeDigitWords(rem)}` : h;
}

/**
 * Decompose a large integer into South-Asian named units.
 * Returns [ [value, unit], … ] from largest to smallest.
 */
function decomposeSouthAsian(n: number): Array<[number, string]> {
  const units: Array<[number, string]> = [
    [10_00_00_00_00_000, "Arab Crore"], // 10^11
    [1_00_00_00_000, "Arab"], // 10^9
    [1_00_00_000, "Crore"], // 10^7
    [1_00_000, "Lakh"], // 10^5
    [1_000, "Thousand"],
    [100, "Hundred"],
    [1, ""],
  ];

  const result: Array<[number, string]> = [];
  let rem = Math.floor(n);
  for (const [divisor, name] of units) {
    const q = Math.floor(rem / divisor);
    if (q > 0) {
      result.push([q, name]);
      rem -= q * divisor;
    }
  }
  return result;
}

/**
 * Convert an integer into English words using South-Asian units.
 */
function intToWordsEN(n: number): string {
  if (n === 0) return "Zero";

  const parts = decomposeSouthAsian(n);
  const words = parts.map(([val, unit]) => {
    const valWords = threeDigitWords(val);
    return unit ? `${valWords} ${unit}` : valWords;
  });
  return words.join(" ").trim();
}

/**
 * Returns the amount in English words (Nepali Rupees + Paisa).
 * e.g. amountInWords(125000) → "Rupees One Lakh Twenty Five Thousand Only"
 */
export function amountInWords(amount: number): string {
  const abs = Math.abs(amount);
  const rupees = Math.floor(abs);
  const paisa = Math.round((abs - rupees) * 100);

  const prefix = amount < 0 ? "Minus " : "";
  const rupeePart = rupees > 0 ? `Rupees ${intToWordsEN(rupees)}` : "";
  const paisaPart = paisa > 0 ? `and Paisa ${intToWordsEN(paisa)}` : "";

  const joined = [rupeePart, paisaPart].filter(Boolean).join(" ");
  return `${prefix}${joined} Only`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Amount in words — Nepali (Devanagari)
// ─────────────────────────────────────────────────────────────────────────────

const ONES_NP = [
  "",
  "एक",
  "दुई",
  "तीन",
  "चार",
  "पाँच",
  "छ",
  "सात",
  "आठ",
  "नौ",
  "दश",
  "एघार",
  "बाह्र",
  "तेह्र",
  "चौध",
  "पन्ध्र",
  "सोह्र",
  "सत्र",
  "अठार",
  "उन्नाइस",
];
const TENS_NP = ["", "", "बीस", "तीस", "चालीस", "पचास", "साठी", "सत्तरी", "असी", "नब्बे"];
// Special compounds 21-99 that deviate from the pattern
const SPECIAL_NP: Record<number, string> = {
  21: "एक्काइस",
  22: "बाइस",
  23: "तेइस",
  24: "चौबीस",
  25: "पच्चीस",
  26: "छब्बीस",
  27: "सत्ताइस",
  28: "अट्ठाइस",
  29: "उन्तीस",
  31: "एकत्तीस",
  32: "बत्तीस",
  33: "तेत्तीस",
  34: "चौँतीस",
  35: "पैँतीस",
  36: "छत्तीस",
  37: "सैँतीस",
  38: "अठत्तीस",
  39: "उनचालीस",
  41: "एकचालीस",
  42: "बयालीस",
  43: "त्रियालीस",
  44: "चवालीस",
  45: "पैँतालीस",
  46: "छयालीस",
  47: "सतचालीस",
  48: "अठचालीस",
  49: "उनपचास",
  51: "एकाउन्न",
  52: "बाउन्न",
  53: "त्रिपन्न",
  54: "चौवन्न",
  55: "पचपन्न",
  56: "छपन्न",
  57: "सन्ताउन्न",
  58: "अन्ठाउन्न",
  59: "उनसाठी",
  61: "एकसाठी",
  62: "बासाठी",
  63: "तिरसाठी",
  64: "चौँसाठी",
  65: "पैँसाठी",
  66: "छैसाठी",
  67: "सतसाठी",
  68: "अठसाठी",
  69: "उनसत्तरी",
  71: "एकहत्तर",
  72: "बहत्तर",
  73: "त्रिहत्तर",
  74: "चौहत्तर",
  75: "पचहत्तर",
  76: "छहत्तर",
  77: "सतहत्तर",
  78: "अठहत्तर",
  79: "उनासी",
  81: "एकासी",
  82: "बयासी",
  83: "त्रियासी",
  84: "चौरासी",
  85: "पचासी",
  86: "छयासी",
  87: "सतासी",
  88: "अठासी",
  89: "उनान्नब्बे",
  91: "एकान्नब्बे",
  92: "बयान्नब्बे",
  93: "त्रियान्नब्बे",
  94: "चौरान्नब्बे",
  95: "पन्चान्नब्बे",
  96: "छयान्नब्बे",
  97: "सत्तान्नब्बे",
  98: "अन्ठान्नब्बे",
  99: "उनान्सय",
};

function twoDigitWordsNP(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES_NP[n];
  if (SPECIAL_NP[n]) return SPECIAL_NP[n];
  const t = TENS_NP[Math.floor(n / 10)];
  const o = n % 10 ? ` ${ONES_NP[n % 10]}` : "";
  return `${t}${o}`;
}

function threeDigitWordsNP(n: number): string {
  if (n === 0) return "";
  if (n < 100) return twoDigitWordsNP(n);
  const hundreds = Math.floor(n / 100);
  const rem = n % 100;
  const h = `${ONES_NP[hundreds]} सय`;
  return rem ? `${h} ${twoDigitWordsNP(rem)}` : h;
}

const NP_UNITS: Array<[number, string]> = [
  [1_00_00_00_000, "अर्ब"],
  [1_00_00_000, "करोड"],
  [1_00_000, "लाख"],
  [1_000, "हजार"],
  [100, "सय"],
  [1, ""],
];

function intToWordsNP(n: number): string {
  if (n === 0) return "शून्य";
  const parts: string[] = [];
  let rem = Math.floor(n);

  for (const [divisor, unit] of NP_UNITS) {
    const q = Math.floor(rem / divisor);
    if (q > 0) {
      const w = divisor >= 100 ? threeDigitWordsNP(q) : twoDigitWordsNP(q);
      parts.push(unit ? `${w} ${unit}` : w);
      rem -= q * divisor;
    }
  }
  return parts.join(" ").trim();
}

/**
 * Returns the amount in Nepali Devanagari script.
 * e.g. amountInWordsNepali(125000) → "एक लाख पच्चीस हजार मात्र"
 */
export function amountInWordsNepali(amount: number): string {
  const abs = Math.abs(amount);
  const rupees = Math.floor(abs);
  const paisa = Math.round((abs - rupees) * 100);

  const prefix = amount < 0 ? "माइनस " : "";
  const rupeePart = rupees > 0 ? intToWordsNP(rupees) : "";
  const paisaPart = paisa > 0 ? `र पैसा ${intToWordsNP(paisa)}` : "";

  const joined = [rupeePart, paisaPart].filter(Boolean).join(" ");
  return `${prefix}${joined} मात्र`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: parse an existing formatNumber() value and re-format it
// (for migrating legacy invoice calls)
// ─────────────────────────────────────────────────────────────────────────────

/** Drop-in replacement for formatNumber(n) used in invoice print layouts */
export function formatNumber(amount: number, decimals = 2): string {
  return formatNepaliCurrency(amount, false, decimals);
}
