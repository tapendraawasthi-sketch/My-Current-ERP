// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CompanySettings } from "./types";

// ==========================================
// 1. NUMBER & CURRENCY FORMATTING (LAKHS / CRORES)
// ==========================================

export function roundTo2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function roundTo4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

/**
 * Formats a number with Indian numbering scheme commas: e.g., 12,34,567.89 instead of 1,234,567.89
 */
export function formatIndianNumber(amount: number, decimals: number = 2): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    amount = 0;
  }

  const tempVal = roundTo2(amount);
  const parts = tempVal.toFixed(decimals).split(".");
  const integerPart = parts[0];
  const decimalPart = parts[1];

  let lastThree = integerPart.slice(-3);
  const otherNumbers = integerPart.slice(0, -3);

  if (otherNumbers !== "") {
    lastThree = "," + lastThree;
  }

  // Format remaining in groups of 2
  const formattedOthers = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  const resultStr = formattedOthers + lastThree;

  return decimalPart ? `${resultStr}.${decimalPart}` : resultStr;
}

export function formatCurrency(amount: number, settings?: Partial<CompanySettings>): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "0.00";
  }

  const formatter = new Intl.NumberFormat("ne-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const prefix = settings?.currencySymbol || "Rs.";
  return `${prefix} ` + formatter.format(amount);
}

export function formatNumber(amount: number, decimals: number = 2): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "0.00";
  }

  const formatter = new Intl.NumberFormat("ne-NP", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return formatter.format(amount);
}

// ==========================================
// 2. CLASSNAMES & STRING HELPERS
// ==========================================

export function cn(...inputs: any[]): string {
  return inputs.filter(Boolean).join(" ");
}

export function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

export function slugify(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // remove non-alphanumeric, spaces, or hyphens
    .replace(/[\s_-]+/g, "-") // collapse repeated space/dashes into single hyphen
    .replace(/^-+|-+$/g, ""); // trim trailing/leading hyphens
}

export function generateCode(prefix: string, count: number): string {
  const nextNum = (count + 1).toString().padStart(4, "0");
  return `${prefix}-${nextNum}`;
}

// ==========================================
// 3. DATE UTILITIES
// ==========================================

export function dateToAD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayAD(): string {
  return dateToAD(new Date());
}

export function formatDate(dateStr: string, format: "short" | "long" = "short"): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  if (format === "long") {
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function addDays(dateStr: string, days: number): string {
  const dateObj = new Date(dateStr);
  dateObj.setDate(dateObj.getDate() + days);
  return dateToAD(dateObj);
}

export function daysBetween(startDate: string, endDate: string): number {
  const s = new Date(startDate);
  const e = new Date(endDate);
  const diff = e.getTime() - s.getTime();
  return Math.ceil(diff / (1000 * 3600 * 24));
}

export function isDateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

// ==========================================
// 4. SECURITY & CRYPTOGRAPHY
// ==========================================

export function sha256Fallback(ascii: string): string {
  // Simple deterministic non-secure hashing for local sandboxed storage fallback
  let hash1 = 5381;
  let hash2 = 3381;
  for (let i = 0; i < ascii.length; i++) {
    const char = ascii.charCodeAt(i);
    hash1 = (hash1 << 5) + hash1 + char;
    hash1 &= hash1; // Convert to 32bit integer
    hash2 = ((hash2 << 4) + hash2) ^ char;
    hash2 &= hash2;
  }

  const p1 = Math.abs(hash1).toString(16).padStart(8, "0");
  const p2 = Math.abs(hash2).toString(16).padStart(8, "0");
  const p3 = Math.abs(hash1 ^ hash2)
    .toString(16)
    .padStart(8, "0");
  const p4 = Math.abs(hash1 & hash2)
    .toString(16)
    .padStart(8, "0");

  return p1 + p2 + p3 + p4;
}

export async function hashPassword(password: string): Promise<string> {
  return sha256Fallback(password);
}

// ==========================================
// 5. VALIDATIONS
// ==========================================

export function isValidEmail(email: string): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  // Standard phone check
  const clean = phone.replace(/[-\s()]/g, "");
  return /^\+?\d{7,15}$/.test(clean);
}

export function isPositiveNumber(val: any): boolean {
  return typeof val === "number" && !isNaN(val) && val > 0;
}

export function isNonEmptyString(val: any): boolean {
  return typeof val === "string" && val.trim().length > 0;
}

// ==========================================
// 6. ID GENERATOR
// ==========================================

export function generateId(prefix: string): string {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${rand}`;
}

// ==========================================
// 7. LABELS DICTIONARIES
// ==========================================

export function getAccountTypeLabel(type: string, lang: string = "en"): string {
  const maps: Record<string, Record<string, string>> = {
    asset: { en: "Asset", np: "परिसम्पति" },
    liability: { en: "Liability", np: "दायित्व" },
    equity: { en: "Equity", np: "पुँजी" },
    income: { en: "Income", np: "आय" },
    expense: { en: "Expense", np: "खर्च" },
  };
  return maps[type]?.[lang] || type;
}

export function getVoucherTypeLabel(type: string, lang: string = "en"): string {
  const maps: Record<string, Record<string, string>> = {
    journal: { en: "Journal Voucher", np: "जर्नल भाउचर" },
    payment: { en: "Payment Voucher", np: "भुक्तानी भाउचर" },
    receipt: { en: "Receipt Voucher", np: "प्राप्ति भाउचर" },
    contra: { en: "Contra Voucher", np: "काउन्टर म्याच भाउचर" },
    "sales-invoice": { en: "Sales Tax Invoice", np: "बिक्री कर विजक" },
    "purchase-invoice": { en: "Purchase Invoice", np: "खरिद बिल विजक" },
    "opening-balance": { en: "Opening Balance Voucher", np: "सुरुवाती मौजदात विजक" },
  };
  return maps[type]?.[lang] || type;
}

export function getLevelLabel(level: string, lang: string = "en"): string {
  const maps: Record<string, Record<string, string>> = {
    group: { en: "Main Class Group", np: "मुख्य सुची समूह" },
    subgroup: { en: "Sub Class Group", np: "उप-सूची समूह" },
    ledger: { en: "Ledger Account", np: "खाता पाना" },
    subledger: { en: "Sub-Ledger", np: "सहायक खाता पाना" },
  };
  return maps[level]?.[lang] || level;
}

// ==========================================
// 8. NUMBER TO WORDS NEPALESE (RUPEES & PAISA)
// ==========================================

const ONES = [
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
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const NEPALI_WORDS = [
  "शून्य",
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
  "बीस",
  "एकिस",
  "बाइस",
  "तेइस",
  "चौबिस",
  "पच्चिस",
  "छब्बिस",
  "सत्ताइस",
  "अठ्ठाइस",
  "उनान्तीस",
  "तीस",
  "एकतीस",
  "बत्तीस",
  "तेतीस",
  "चौंतीस",
  "पैंतील",
  "छत्तीसर",
  "सैंतीस",
  "अठतीस",
  "उनन्चालीस",
  "चालीस",
  "एकचालीस",
  "बयालीस",
  "त्रिचालीस",
  "चौवालिस",
  "पैंतालिस",
  "छयालिस",
  "सरचालीस",
  "अठकालीस",
  "उनन्पचास",
  "पचास",
  "एकपन्न",
  "बाउन्न",
  "त्रिपन्न",
  "चौपन्न",
  "पचपन्न",
  "छपन्न",
  "सन्ताउन्न",
  "अठ्याउन्न",
  "उनन्साठी",
  "साठी",
  "एकसाठी",
  "बासठ्ठी",
  "त्रिसाठी",
  "चौंसठ्ठी",
  "पैंसठ्ठी",
  "छyasठ्ठी",
  "सरसाठी",
  "अठसाठी",
  "उनन्सत्तरी",
  "सत्तरी",
  "एकहत्तर",
  "बहत्तर",
  "त्रिहत्तर",
  "चौहत्तर",
  "पचहत्तर",
  "छहत्तर",
  "सतहत्तर",
  "अठहत्तर",
  "उनन्अस्सी",
  "अस्सी",
  "एकासी",
  "बयासी",
  "त्रियासी",
  "चौरासी",
  "पचासी",
  "छयासी",
  "सतासी",
  "अठासी",
  "उनान्नब्बे",
  "नब्बे",
  "एकानब्बे",
  "बयानब्बे",
  "त्रियानब्बे",
  "चौरानब्बे",
  "पञ्चानब्बे",
  "छयानब्बे",
  "सन्तानब्बे",
  "अन्ठानब्बे",
  "उनन्सय",
];

/**
 * Converts integer numbers below 1000 into English Words
 */
function translateUnderThousand(n: number): string {
  let word = "";
  if (n >= 100) {
    word += ONES[Math.floor(n / 100)] + " Hundred ";
    n %= 100;
  }
  if (n >= 20) {
    word += TENS[Math.floor(n / 10)] + " ";
    n %= 10;
  }
  if (n > 0) {
    word += ONES[n] + " ";
  }
  return word.trim();
}

/**
 * Translates integer values under 100 into Devanagari words
 */
function translateUnderHundredNep(n: number): string {
  return NEPALI_WORDS[n] || "";
}

export function numberToWords(
  amount: number,
  currency: string = "Rupees",
): { english: string; nepali: string } {
  if (amount === 0) {
    return {
      english: "Zero Rupees Only",
      nepali: "शून्य रुपैयाँ मात्र",
    };
  }

  const signStrEn = amount < 0 ? "Negative " : "";
  const signStrNp = amount < 0 ? "ऋणात्मक " : "";

  const absAmount = Math.abs(amount);
  const rupeesInteger = Math.floor(absAmount);
  // Extract decimal paisa (rounding protect)
  const paisaInteger = Math.round((absAmount - rupeesInteger) * 100);

  // --- ENGLISH WORDS TRANSLATION IN LAKH/CRORE ---
  let tempRupees = rupeesInteger;
  let wordEn = "";

  if (tempRupees >= 10000000) {
    // 1 Crore = 10,000,000
    const croreVal = Math.floor(tempRupees / 10000000);
    wordEn += translateUnderThousand(croreVal) + " Crore ";
    tempRupees %= 10000000;
  }

  if (tempRupees >= 100000) {
    // 1 Lakh = 100,000
    const lakhVal = Math.floor(tempRupees / 100000);
    wordEn += translateUnderThousand(lakhVal) + " Lakh ";
    tempRupees %= 100000;
  }

  if (tempRupees >= 1000) {
    // 1 Thousand = 1000
    const thousandVal = Math.floor(tempRupees / 1000);
    wordEn += translateUnderThousand(thousandVal) + " Thousand ";
    tempRupees %= 1000;
  }

  if (tempRupees > 0) {
    wordEn += translateUnderThousand(tempRupees);
  }

  wordEn = wordEn.trim();
  if (wordEn === "") {
    wordEn = "Zero";
  }

  const paisaWordEn = paisaInteger > 0 ? ` and ${translateUnderThousand(paisaInteger)} Paisa` : "";
  const englishFullText = `${signStrEn}${wordEn} ${currency}${paisaWordEn} Only`;

  // --- NEPALI DEVANAGARI WORDS TRANSLATION IN LAKH/CRORE ---
  let tempRupeesNp = rupeesInteger;
  let wordNp = "";

  if (tempRupeesNp >= 10000000) {
    const croreVal = Math.floor(tempRupeesNp / 10000000);
    wordNp +=
      (croreVal >= 100
        ? translateUnderThousand(croreVal) + " "
        : translateUnderHundredNep(croreVal)) + " करोड ";
    tempRupeesNp %= 10000000;
  }

  if (tempRupeesNp >= 100000) {
    const lakhVal = Math.floor(tempRupeesNp / 100000);
    wordNp += translateUnderHundredNep(lakhVal) + " लाख ";
    tempRupeesNp %= 100000;
  }

  if (tempRupeesNp >= 1000) {
    const thousandVal = Math.floor(tempRupeesNp / 1000);
    wordNp += translateUnderHundredNep(thousandVal) + " हजार ";
    tempRupeesNp %= 1000;
  }

  if (tempRupeesNp >= 100) {
    const hundredVal = Math.floor(tempRupeesNp / 100);
    wordNp += translateUnderHundredNep(hundredVal) + " सय ";
    tempRupeesNp %= 100;
  }

  if (tempRupeesNp > 0) {
    wordNp += translateUnderHundredNep(tempRupeesNp);
  }

  wordNp = wordNp.trim();
  if (wordNp === "") {
    wordNp = "शून्य";
  }

  const paisaWordNp = paisaInteger > 0 ? ` र ${translateUnderHundredNep(paisaInteger)} पैसा` : "";
  const nepaliFullText = `${signStrNp}${wordNp} रुपैयाँ${paisaWordNp} मात्र`;

  return {
    english: englishFullText,
    nepali: nepaliFullText,
  };
}

export function parseFlexibleDate(dateStr: string): string {
  if (!dateStr) return "";
  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  // Attempt parse via Date
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  } catch {}
  return dateStr; // Return as-is if can't parse
}
