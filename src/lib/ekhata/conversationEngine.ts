import type { KhataConfirmationCard, KhataIntent, KhataParseResult } from "./types";
import {
  CHAT_BALANCE,
  CHAT_BYE,
  CHAT_CASUAL,
  CHAT_GREETING,
  CHAT_HELP,
  CHAT_THANKS,
  VOCABULARY,
} from "./nepaliLanguage";
import { normalizeNepaliText } from "./normalizeNepali";
import {
  confirmationTemplateIntent,
  renderResponseTemplate,
} from "../nepal-ai/responseTemplates";
import { sampleScenarioAiReply } from "../nepal-ai/conversationScenarios";
import { buildLocalizedEntryReply } from "./accountingLanguageBrain";

export type ChatIntent = "greeting" | "casual" | "thanks" | "help" | "balance" | "bye" | "unknown";

export interface LedgerBalanceSnapshot {
  udhaarOut: number;
  udhaarIn: number;
}

export function detectChatIntent(text: string): ChatIntent | null {
  const n = normalizeNepaliText(text);
  if (!n) return null;
  if (CHAT_GREETING.test(n)) return "greeting";
  if (CHAT_CASUAL.test(n.trim())) return "casual";
  if (CHAT_THANKS.test(n)) return "thanks";
  if (CHAT_HELP.test(n)) return "help";
  if (CHAT_BALANCE.test(n)) return "balance";
  if (CHAT_BYE.test(n)) return "bye";
  return null;
}

export function isLikelyKhataEntry(text: string): boolean {
  const n = normalizeNepaliText(text);
  if (!n) return false;
  const cues = [
    ...VOCABULARY.credit,
    ...VOCABULARY.cash,
    ...VOCABULARY.sale,
    ...VOCABULARY.purchase,
    ...VOCABULARY.paymentIn,
    ...VOCABULARY.paymentOut,
    ...VOCABULARY.expense,
    "diye",
    "lai",
    "le",
    "rs",
  ];
  if (/\d/.test(n)) return true;
  return cues.some((word) => n.includes(word));
}

export function replyGreeting(): string {
  return (
    renderResponseTemplate("greeting", "nepali") ??
    sampleScenarioAiReply("new_user_onboarding", { preferTurnIndex: 0 }) ??
    "Namaste! Ma e-Khata — tapai ko khata sakhi.\n\n" +
      "Nepali, Roman Nepali, aru Hindi-mixed bhasa ma lekhna milcha. " +
      "Jastai: `Ram lai 500 udhaar diye`, `aaja 200 ko nagad bikri vayo`, `Shyam le 200 tiryo`.\n\n" +
      "Entry confirm garnu agadi card dekhauchu. `madat` bhannu bhaye udaharan dinchu."
  );
}

export function replyCasual(): string {
  return (
    "Thik cha! Ma tayar chu.\n\n" +
    "Khata entry garna sidhai lekhna milcha — jastai `Ram lai 500 udhaar diye`, " +
    "`aaja 200 ko nagad bikri vayo`, `Shyam le 200 tiryo`.\n\n" +
    "Udaharan chaiyo bhane `madat` bhannus."
  );
}

export function replyThanks(): string {
  return (
    renderResponseTemplate("thanks", "nepali") ??
    "Swagat cha! Aru entry cha bhane sodhnus. Khata safa rakhna ma tayar chu."
  );
}

export function replyHelp(): string {
  const fromScenario = sampleScenarioAiReply("new_user_onboarding", {
    preferTurnIndex: 1,
  });
  if (fromScenario) return fromScenario;
  return (
    "**e-Khata bhasa udaharan:**\n\n" +
    "• Udharo: `Ram lai 500 udhaar diye` / `Ram lai paanch saya udharo diyo`\n" +
    "• Payment aayo: `Shyam le 200 tiryo` / `Hari bata hajar jama bhayo`\n" +
    "• Nagad bikri: `aaja 200 ko nagad bikri vayo` / `cash ma chai becheko 750`\n" +
    "• Kharid: `aja sabji kineko 1000` / `sabji kharid 500`\n" +
    "• Kharcha: `bijuli kharcha 300`\n" +
    "• Payment diye: `Gita lai 2000 payment gareko`\n\n" +
    "Spelling farak hun sakcha (udhar/udharo, nagad/nakad, vayo/bhayo/gyo) — ma bujhchu."
  );
}

export function replyBalance(snapshot?: LedgerBalanceSnapshot, query?: string): string {
  if (!snapshot) {
    return "Abhi balance herna khata account load hudai cha. Feri sodhnus.";
  }

  const q = (query ?? "").toLowerCase();
  if (/\b(payable|creditor|udhaar\s*bhitra|linu\s*baki|dine\s*baki|supplier\s*due)\b/i.test(q)) {
    return (
      `Tapai ko **payable** (udhaar bhitra / linu baki): NPR ${snapshot.udhaarIn.toLocaleString()}\n\n` +
      "Naya entry garna sidhai transaction lekhna milcha."
    );
  }
  if (/\b(receivable|debtor|udhaar\s*baahir|dainu\s*baki|customer\s*due)\b/i.test(q)) {
    return (
      `Tapai ko **receivable** (udhaar baahir / dainu baki): NPR ${snapshot.udhaarOut.toLocaleString()}\n\n` +
      "Naya entry garna sidhai transaction lekhna milcha."
    );
  }

  return (
    `Tapai ko khata snapshot:\n` +
    `• Udharo baahir (receivable / dainu baki): NPR ${snapshot.udhaarOut.toLocaleString()}\n` +
    `• Udharo bhitra (payable / linu baki): NPR ${snapshot.udhaarIn.toLocaleString()}\n\n` +
    "Naya entry garna sidhai transaction lekhna milcha."
  );
}

/** Live ledger balance queries — not balance-sheet definitions. */
export function isLedgerBalanceQuery(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || /\bbalance\s*sheet\b/i.test(trimmed)) return false;

  const n = normalizeNepaliText(trimmed);
  if (CHAT_BALANCE.test(n)) return true;

  const hasBalanceIntent =
    /\b(kati|kitna|total|balance|how\s*much|my|mero|current)\b/i.test(trimmed) ||
    /\b(kati|kitna|total)\b/i.test(n);

  if (!hasBalanceIntent) return false;

  return (
    /\b(receivable|debtor|payable|creditor|udhaar|udharo|udhar|dainu\s*baki|linu\s*baki|dine\s*baki)\b/i.test(
      trimmed,
    ) || /\b(my|mero)\s*(debtors?|receivables?|payables?|creditors?|udhaar)\b/i.test(trimmed)
  );
}

export function replyBye(): string {
  return "Ram ram! Khata entry chaiyo bhane feri sodhnus hai.";
}

export function replyClarify(question: string): string {
  const amtTpl = renderResponseTemplate("clarify_amount", "nepali", {
    detected_amount: "",
  });
  const partyTpl = renderResponseTemplate("clarify_party", "nepali", {
    detected_party: "",
  });

  if (question.includes("Aaple")) {
    return `${question}\n\n(Udhaar dine ho ki payment dine? Ram lai 500 diye = udhaar; Shyam le 500 diye = payment.)`;
  }
  if (/rakam|amount|Rs|paisa/i.test(question) && amtTpl) {
    return `${question}\n\n${amtTpl.replace(/\s*Rs\s*\{\w+\}|\{\w+\}/g, "").trim()}\nJastai: 500, paanch saya, 1 hajar, 1.5k`;
  }
  if (/party|naam|kasle|kaslai|kasko/i.test(question) && partyTpl) {
    return `${question}\n\n${partyTpl.replace(/\{[^}]+\}/g, "…")}`;
  }
  if (question.includes("Rakam")) {
    return `${question}\n\nJastai: 500, paanch saya, 1 hajar, 1.5k`;
  }
  return (
    `${question}\n\nThora clear lekhda ni huncha. Udaharan: \`aaja 200 ko nagad bikri vayo\`, \`Ram lai 500 udhaar diye\`.`
  );
}

export function replyConfirmPrompt(card: KhataConfirmationCard): string {
  const bucket = confirmationTemplateIntent(card.intent);
  if (bucket) {
    const prefer = [
      ...(card.party ? ["party"] : []),
      "amount",
      ...(card.item ? ["item"] : []),
    ];
    const rendered = renderResponseTemplate(
      bucket,
      "nepali",
      {
        party: card.party || "party",
        amount: card.amount,
        item: card.item || "saamaan",
        date: card.date,
      },
      { preferEntities: prefer },
    );
    if (rendered) return rendered;
  }
  return buildLocalizedEntryReply(card, "nepali");
}

export function replySaved(voucherNo: string): string {
  return `Safalta! Entry save bhayo ✓ (${voucherNo}). Aru kehi chaincha?`;
}

export function replyCancel(): string {
  return "Thik cha, yo entry cancel gare. Aru lekhna milcha.";
}

export function replyParseError(message: string): string {
  const tpl = renderResponseTemplate("error", "nepali");
  if (tpl) return `${tpl}\n\n${message}`;
  return `${message}\n\nRoman Nepali, Devanagari, athaba Hindi-mixed — sabai try garna milcha.`;
}

export function replyUnknownChat(): string {
  return (
    "Ma khata entry ra sadharan kura bujhchu. Transaction bhaye rakam sahit lekhnu hola.\n" +
    "Udaharan: `aaja 300 ko nagad bikri vayo`. Madat chai `help` bhannus."
  );
}

export function buildChatReply(intent: ChatIntent, balance?: LedgerBalanceSnapshot): string {
  switch (intent) {
    case "greeting":
      return replyGreeting();
    case "casual":
      return replyCasual();
    case "thanks":
      return replyThanks();
    case "help":
      return replyHelp();
    case "balance":
      return replyBalance(balance);
    case "bye":
      return replyBye();
    default:
      return replyUnknownChat();
  }
}

export function buildParseReply(result: KhataParseResult, card?: KhataConfirmationCard): string {
  if (result.clarifying_question) {
    return replyClarify(result.clarifying_question);
  }
  if (card) {
    return replyConfirmPrompt(card);
  }
  return replyUnknownChat();
}
