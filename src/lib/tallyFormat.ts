import { ADToBSString } from "@/lib/nepaliDate";

export const formatMoney = (n: number) => {
  if (n === 0 || n === undefined || n === null) return "";
  const [int, dec] = Number(n).toFixed(2).split(".");
  const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${formatted}.${dec}`;
};

export const parseMoney = (raw: string) => {
  const cleaned = raw.replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
};

export const formatDate = (iso: string) => {
  if (!iso) return "";
  return iso; // YYYY-MM-DD display
};

export const formatDateBS = (iso: string) => {
  if (!iso) return "";
  try {
    return ADToBSString(iso);
  } catch {
    return iso;
  }
};

const ones = [
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
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const convertLessThanOneThousand = (n: number): string => {
  if (n === 0) return "";
  if (n < 20) return ones[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const r = n % 10;
    return `${tens[t]}${r ? " " + ones[r] : ""}`;
  }
  const h = Math.floor(n / 100);
  const r = n % 100;
  return `${ones[h]} Hundred${r ? " " + convertLessThanOneThousand(r) : ""}`;
};

export const amountInWords = (amount: number): string => {
  if (amount === 0) return "Zero Rupees Only";
  const isNegative = amount < 0;
  let n = Math.abs(Math.round(amount * 100));
  const paise = n % 100;
  n = Math.floor(n / 100);

  const parts: string[] = [];
  const units = ["", "Thousand", "Lakh", "Crore"];
  let unitIndex = 0;

  while (n > 0) {
    let chunk: number;
    if (unitIndex === 0) chunk = n % 1000;
    else chunk = n % 100;
    if (chunk > 0) {
      const chunkText = convertLessThanOneThousand(chunk);
      parts.unshift(`${chunkText}${units[unitIndex] ? " " + units[unitIndex] : ""}`);
    }
    n = unitIndex === 0 ? Math.floor(n / 1000) : Math.floor(n / 100);
    unitIndex++;
  }

  let rupees = parts.join(", ");
  if (isNegative) rupees = "Negative " + rupees;
  const paiseText = paise > 0 ? ` and ${convertLessThanOneThousand(paise)} Paisa` : "";
  return `${rupees} Rupees${paiseText} Only`.replace(/\s+/g, " ").trim();
};

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
