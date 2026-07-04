/**
 * TypeScript customer NLU fallback — mirrors erp_bot/src/customer/intent_classifier.py.
 * Used when erp_bot is offline or for instant client-side preview.
 */

import type { CustomerIntent, CustomerParseResult, CustomerSlots } from "./types";

const GREETING = /^(hi|hello|hey|namaste|namaskar|help|madat|sahayata)\b/i;
const REMINDER = /\b(samjhaideu|samjhaune|yaad dilau|tirna vanne|magne)\b/i;
const QUERY_BALANCE_ALL =
  /\b(kasle kasle|kun kun|kasko kati|kasle paisa tirna baki|kul kati baki|herchu|dekhau)\b/i;
const QUERY_BALANCE_ONE = /\b(\w+\s+ko\s+kati\s+baki|kati\s+baki\s+cha|baki\s+kati)\b/i;
const QUERY_DAILY =
  /\b(aja\s+kati|kati\s+kamayo|kati\s+bikri|bikri\s+kati\s+vayo|mahina.*kati)\b/i;
const QUERY_STOCK = /\b(kati\s+bacheko|stock\s+kati|\w+\s+ko\s+stock\s+kati|khatam\s+huna)\b/i;
const CREDIT = /\b(udharo|udhaaro|udharoma|khatama|rakhya|rakhe)\b/i;
const CASH = /\b(nagad|cash)\b/i;
const PAID = /\b(tirin|tirya|tirey|tirera)\b/i;
const PURCHASE = /\b(kinya|kinye|kinna|mangaye|lyayeko|lyaye)\b/i;
const SALE = /\b(becha|bechyo|beche|becera|bikri)\b/i;
const EXPENSE =
  /\b(kharcha\s+vayo|bhada|talab|bijuli\s+bill|internet\s+bill|petrol)\b/i;
const DISCOUNT = /\b(chhut|discount|ghatai)\b/i;
const RETURN = /\b(pharkayo|return|farkayo)\b/i;

function parseAmount(text: string): number | undefined {
  const lakh = text.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lakha)\b/i);
  if (lakh) return parseFloat(lakh[1]) * 100_000;
  const digit = text.match(/\b(\d+(?:,\d{3})*(?:\.\d+)?)\b/);
  if (digit) return parseFloat(digit[1].replace(/,/g, ""));
  return undefined;
}

function parseParty(text: string): string | undefined {
  const role = text.match(
    /\b(dealer|supplier|distributor|kisan|factory|hostel|teacher|contractor|retailer)\s+lai\b/i,
  );
  if (role) return role[1].charAt(0).toUpperCase() + role[1].slice(1).toLowerCase();

  const m = text.match(/\b([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s]{0,25}?)\s+lai\b/i);
  if (m) {
    const name = m[1].trim();
    if (name.length >= 2) return name.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  const ko = text.match(/\b([A-Za-z\u0900-\u097F][\w\u0900-\u097F]{0,20}?)\s+ko\s+kati\s+baki\b/i);
  if (ko) return ko[1].charAt(0).toUpperCase() + ko[1].slice(1);
  return undefined;
}

export function classifyCustomerIntent(text: string): CustomerIntent {
  const q = text.trim().toLowerCase();
  if (GREETING.test(q)) return "GENERAL";
  if (REMINDER.test(q)) return "REMINDER_REQUEST";
  if (QUERY_BALANCE_ALL.test(q)) return "QUERY_BALANCE_ALL";
  if (QUERY_STOCK.test(q)) return "QUERY_STOCK";
  if (QUERY_BALANCE_ONE.test(q)) return "QUERY_BALANCE_ONE";
  if (QUERY_DAILY.test(q)) return "QUERY_DAILY_TOTAL";
  if (RETURN.test(q)) return "RETURN_SALES";
  if (DISCOUNT.test(q)) return "DISCOUNT_GIVEN";
  if (/उधार/.test(q) && /दिए/.test(q)) return "SALE_CREDIT";
  if (/\b(dealer|supplier|distributor|kisan)\s+lai\b/.test(q) && (PAID.test(q) || q.includes("advance")))
    return "PAYMENT_MADE";
  if (CASH.test(q) && /\b(liye|liyo|payo)\b/.test(q)) return "SALE_CASH";
  if (PURCHASE.test(q) && /\bkinna\b/.test(q)) return "PURCHASE_CASH";
  if (EXPENSE.test(q)) return "EXPENSE";
  if (PAID.test(q)) return "PAYMENT_RECEIVED";
  if (PURCHASE.test(q)) return CREDIT.test(q) ? "PURCHASE_CREDIT" : "PURCHASE_CASH";
  if (CREDIT.test(q) && /\b(diye|rakhe|rakhya)\b/.test(q)) return "SALE_CREDIT";
  if (SALE.test(q) || /\b(kamayo|aayo)\b/.test(q)) return "SALE_CASH";
  return "GENERAL";
}

function formatRs(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;
}

export function parseCustomerMessage(text: string): CustomerParseResult {
  const intent = classifyCustomerIntent(text);
  const slots: CustomerSlots = {
    party: parseParty(text),
    amount: parseAmount(text),
  };

  if (intent === "GENERAL" && GREETING.test(text.trim())) {
    return {
      intent,
      slots,
      action: "greet",
      answer:
        "Namaste! Ma Falcon — tapai ko digital khata. Udharo, payment, bikri — Nepali ma bhannus. Jastai: 'Ram lai 500 udharo diye'.",
    };
  }

  if (intent === "QUERY_BALANCE_ONE" && !slots.party) {
    return { intent, slots, action: "clarify", answer: "Kasko baki hernu ho? naam bhannus." };
  }

  if (intent === "SALE_CREDIT" && slots.party && slots.amount) {
    return {
      intent,
      slots,
      action: "post",
      answer: `Thik cha — ${slots.party} lai ${formatRs(slots.amount)} udharo diye.`,
    };
  }

  if (intent === "PAYMENT_RECEIVED" && slots.amount) {
    return {
      intent,
      slots,
      action: "post",
      answer: `Thik cha — ${slots.party ?? "customer"} le ${formatRs(slots.amount)} tiryo.`,
    };
  }

  if (intent === "QUERY_DAILY_TOTAL") {
    return { intent, slots, action: "query", answer: "Aja jamma bikri/kamai: Rs. 0" };
  }

  if (intent === "QUERY_BALANCE_ALL") {
    return { intent, slots, action: "query", answer: "Ahile koi sanga pani baki chaina." };
  }

  return {
    intent,
    slots,
    action: "fallback",
    answer:
      "Maile bujhina — udharo, payment, bikri, wa kharcha jastai ek line ma bhannus.",
  };
}
