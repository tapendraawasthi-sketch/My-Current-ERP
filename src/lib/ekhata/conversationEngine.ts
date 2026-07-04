import type { KhataConfirmationCard, KhataIntent, KhataParseResult } from "./types";
import { KHATA_INTENT_LABELS } from "./types";
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
  return "Swagat cha! Aru entry cha bhane sodhnus. Khata safa rakhna ma tayar chu.";
}

export function replyHelp(): string {
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

export function replyBalance(snapshot?: LedgerBalanceSnapshot): string {
  if (!snapshot) {
    return "Abhi balance herna khata account load hudai cha. Feri sodhnus.";
  }
  return (
    `Tapai ko khata snapshot:\n` +
    `• Udharo baahir (dainu baki): NPR ${snapshot.udhaarOut.toLocaleString()}\n` +
    `• Udharo bhitra (linu baki): NPR ${snapshot.udhaarIn.toLocaleString()}\n\n` +
    "Naya entry garna sidhai transaction lekhna milcha."
  );
}

export function replyBye(): string {
  return "Ram ram! Khata entry chaiyo bhane feri sodhnus hai.";
}

export function replyClarify(question: string): string {
  if (question.includes("Aaple")) {
    return `${question}\n\n(Udhaar dine ho ki payment dine? Ram lai 500 diye = udhaar; Shyam le 500 diye = payment.)`;
  }
  if (question.includes("Rakam")) {
    return `${question}\n\nJastai: 500, paanch saya, 1 hajar, 1.5k`;
  }
  return (
    `${question}\n\nThora clear lekhda ni huncha. Udaharan: \`aaja 200 ko nagad bikri vayo\`, \`Ram lai 500 udhaar diye\`.`
  );
}

export function replyConfirmPrompt(card: KhataConfirmationCard): string {
  const label = KHATA_INTENT_LABELS[card.intent as KhataIntent];
  const party = card.party ? `**${card.party}**` : "(party chaina)";
  return (
    `Maile yo transaction bujhe:\n` +
    `• Prakar: ${label}\n` +
    `• Party: ${party}\n` +
    `• Rakam: NPR ${card.amount}\n` +
    `• Miti: ${card.date}\n\n` +
    `Sahi cha bhane **Confirm** thichnus.`
  );
}

export function replySaved(voucherNo: string): string {
  return `Safalta! Entry save bhayo ✓ (${voucherNo}). Aru kehi chaincha?`;
}

export function replyCancel(): string {
  return "Thik cha, yo entry cancel gare. Aru lekhna milcha.";
}

export function replyParseError(message: string): string {
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
