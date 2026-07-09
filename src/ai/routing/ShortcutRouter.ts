/** SUTRA AI — slash commands and quick shortcuts */

import type { AIResponse, LanguageCode } from "../types";

export interface ShortcutResult {
  handled: boolean;
  rewrittenInput?: string;
  shortcutAction?: "clear_history" | "dismiss_digest" | "snooze_digest" | "show_digest";
  snoozeHours?: number;
  response?: AIResponse;
}

const HELP_TEXT = {
  nepali:
    "SUTRA AI छोटो आदेशहरू:\n" +
    "• `/help` — यो सूची\n" +
    "• `/clear` — कुराकानी मेटाउनुहोस्\n" +
    "• `/balance ram` — पार्टी ब्यालेन्स\n" +
    "• `/stock kakro` — स्टक स्तर\n" +
    "• `/profit` — यो महिनाको नाफा\n" +
    "• `/insights` — व्यापार सारांश\n" +
    "• `/repeat` — अघिल्लो लेनदेन दोहोर्याउनुहोस्\n" +
    "• `/compare` — आज र हिजो बिक्री तुलना\n" +
    "• `/receivable` — लिनु बाँकी सूची\n" +
    "• `/expense` — खर्च entry\n" +
    "• `/digest` — आजको सारांश\n" +
    "• `/digest dismiss` — digest हटाउनुहोस्\n" +
    "• `/digest snooze 4` — ४ घण्टा snooze\n" +
    "• `/digest show` — digest फेरि देखाउनुहोस्\n" +
    "• `/examples` — उदाहरण वाक्यहरू\n" +
    "• `/search ram` — ERP खोज\n" +
    "• `/search supplier ram` — supplier खोज\n" +
    "• `/rate kakro` — वस्तु दर\n" +
    "• `/fy` — चालु आ.व. नाफा\n" +
    "• `/overdue` — ढिला उधार सूची\n" +
    "• `/overdue supplier` — ढिला payable\n" +
    "• `/create party ram` — नयाँ पार्टी\n" +
    "• `/reminder ram` — WhatsApp सम्झना\n" +
    "• `/phone ram` — पार्टी फोन\n" +
    "• `/setphone ram 9841234567` — फोन अपडेट\n" +
    "• `/share invoice` — बिल WhatsApp मा\n" +
    "• `/cache stats` — LLM cache जानकारी",
  english:
    "SUTRA AI shortcuts:\n" +
    "• `/help` — this list\n" +
    "• `/clear` — clear chat\n" +
    "• `/balance ram` — party balance\n" +
    "• `/stock kakro` — stock level\n" +
    "• `/profit` — monthly profit\n" +
    "• `/insights` — business summary\n" +
    "• `/repeat` — repeat last transaction\n" +
    "• `/compare` — today vs yesterday sales\n" +
    "• `/receivable` — receivable list\n" +
    "• `/expense` — expense entry\n" +
    "• `/digest` — daily digest\n" +
    "• `/digest dismiss` — hide digest today\n" +
    "• `/digest snooze 4` — snooze 4 hours\n" +
    "• `/digest show` — show digest again\n" +
    "• `/examples` — example phrases\n" +
    "• `/search ram` — ERP search\n" +
    "• `/search supplier ram` — search suppliers\n" +
    "• `/rate kakro` — item rate\n" +
    "• `/fy` — current FY profit\n" +
    "• `/overdue` — overdue list\n" +
    "• `/overdue supplier` — overdue payables\n" +
    "• `/create party ram` — new party\n" +
    "• `/reminder ram` — WhatsApp reminder\n" +
    "• `/phone ram` — party phone\n" +
    "• `/setphone ram 9841234567` — update phone\n" +
    "• `/share invoice` — share bill on WhatsApp\n" +
    "• `/cache stats` — LLM cache info",
  roman:
    "SUTRA AI shortcuts:\n" +
    "• `/help` — yo suchi\n" +
    "• `/clear` — kura metau\n" +
    "• `/balance ram` — party balance\n" +
    "• `/stock kakro` — stock level\n" +
    "• `/profit` — mahina ko nafa\n" +
    "• `/insights` — business summary\n" +
    "• `/repeat` — pachillo len den dohoryau\n" +
    "• `/compare` — aaja vs hijo bikri\n" +
    "• `/receivable` — udhaar list\n" +
    "• `/expense` — kharcha entry\n" +
    "• `/digest` — aajko summary\n" +
    "• `/digest dismiss` — digest hatau\n" +
    "• `/digest snooze 4` — 4 ghanta snooze\n" +
    "• `/digest show` — digest feri dekhaau\n" +
    "• `/examples` — example phrases\n" +
    "• `/search ram` — ERP khoj\n" +
    "• `/search supplier ram` — supplier khoj\n" +
    "• `/rate kakro` — item rate\n" +
    "• `/fy` — chalu a.v. nafa\n" +
    "• `/overdue` — dhila udhaar list\n" +
    "• `/overdue supplier` — dhila payable\n" +
    "• `/create party ram` — naya party\n" +
    "• `/reminder ram` — WhatsApp reminder\n" +
    "• `/phone ram` — party phone\n" +
    "• `/setphone ram 9841234567` — phone update\n" +
    "• `/share invoice` — bill WhatsApp ma\n" +
    "• `/cache stats` — LLM cache info",
};

import { buildExamplesResponse } from "./ExamplesRouter";

export class ShortcutRouter {
  route(input: string, outputLanguage: LanguageCode): ShortcutResult {
    const trimmed = input.trim();

    if (/^\/help\b/i.test(trimmed) || trimmed.toLowerCase() === "help") {
      return {
        handled: true,
        response: this.staticResponse(trimmed, outputLanguage, HELP_TEXT),
      };
    }

    if (/^\/clear\b/i.test(trimmed)) {
      return { handled: true, shortcutAction: "clear_history" };
    }

    const bal = trimmed.match(/^\/balance\s+(.+)/i);
    if (bal) {
      return { handled: false, rewrittenInput: `${bal[1].trim()} ko balance kati` };
    }

    const stk = trimmed.match(/^\/stock\s+(.+)/i);
    if (stk) {
      return { handled: false, rewrittenInput: `${stk[1].trim()} kati baki cha` };
    }

    if (/^\/profit\b/i.test(trimmed)) {
      return { handled: false, rewrittenInput: "yo mahina ko profit" };
    }

    const sales = trimmed.match(/^\/sales\b/i);
    if (sales) {
      return { handled: false, rewrittenInput: "aaja ko bikri kati" };
    }

    if (/^\/insights\b/i.test(trimmed)) {
      return { handled: false, rewrittenInput: "business summary" };
    }

    if (/^\/compare\b/i.test(trimmed)) {
      return { handled: false, rewrittenInput: "aaja vs hijo bikri" };
    }

    if (/^\/receivable\b/i.test(trimmed)) {
      return { handled: false, rewrittenInput: "sabai udhaar list" };
    }

    if (/^\/examples\b/i.test(trimmed)) {
      return {
        handled: true,
        response: buildExamplesResponse(trimmed, outputLanguage),
      };
    }

    if (/^\/digest\b/i.test(trimmed)) {
      const snooze = trimmed.match(/^\/digest\s+snooze\s+(\d+)/i);
      if (snooze) {
        const hours = Math.min(72, Math.max(1, parseInt(snooze[1], 10) || 4));
        return { handled: true, shortcutAction: "snooze_digest", snoozeHours: hours };
      }
      if (/^\/digest\s+dismiss\b/i.test(trimmed) || /^\/snooze\s+digest\b/i.test(trimmed)) {
        return { handled: true, shortcutAction: "dismiss_digest" };
      }
      if (/^\/digest\s+show\b/i.test(trimmed)) {
        return { handled: true, shortcutAction: "show_digest" };
      }
      return { handled: false, rewrittenInput: "aaja ko business digest" };
    }

    if (/^\/expense\b/i.test(trimmed)) {
      return { handled: false, rewrittenInput: "500 ko kharcha" };
    }

    const search = trimmed.match(/^\/search\s+(.+)/i);
    if (search) {
      return { handled: false, rewrittenInput: `/search ${search[1].trim()}` };
    }

    const rate = trimmed.match(/^\/rate\s+(.+)/i);
    if (rate) {
      return { handled: false, rewrittenInput: `${rate[1].trim()} ko rate` };
    }

    if (/^\/fy\b/i.test(trimmed)) {
      return { handled: false, rewrittenInput: "chalu a.v. ko profit" };
    }

    if (/^\/overdue\b/i.test(trimmed)) {
      return { handled: false, rewrittenInput: trimmed.includes("supplier") ? "overdue supplier payable" : "overdue udhaar list" };
    }

    const createParty = trimmed.match(/^\/create\s+party\s+(.+)/i);
    if (createParty) {
      const name = createParty[1].trim();
      return {
        handled: true,
        response: {
          understood_input: trimmed,
          confidence: 1,
          needs_clarification: false,
          suggestions: [],
          response: {
            nepali: `${name} थप्न पार्टी मास्टर खोल्दैछु।`,
            english: `Opening party master to add ${name}.`,
            roman: `${name} thapna party master khuldai chu.`,
          },
          actions: [
            {
              id: `create-party-${Date.now().toString(36)}`,
              type: "navigate",
              page: "parties",
              label: `Create ${name}`,
              labelNepali: `${name} थप्नुहोस्`,
            },
          ],
        },
      };
    }

    const reminder = trimmed.match(/^\/reminder\s+(.+)/i);
    if (reminder) {
      return { handled: false, rewrittenInput: `${reminder[1].trim()} lai udhaar reminder pathau` };
    }

    const phone = trimmed.match(/^\/phone\s+(.+)/i);
    if (phone) {
      return { handled: false, rewrittenInput: trimmed };
    }

    const setPhone = trimmed.match(/^\/setphone\s+(\S+)\s+(\S+)/i);
    if (setPhone) {
      return { handled: false, rewrittenInput: trimmed };
    }

    if (/^\/share\s+invoice\b/i.test(trimmed)) {
      return { handled: false, rewrittenInput: "pachillo bill share garnu whatsapp ma" };
    }

    return { handled: false };
  }

  private staticResponse(
    understood: string,
    lang: LanguageCode,
    texts: typeof HELP_TEXT,
  ): AIResponse {
    return {
      understood_input: understood,
      confidence: 1,
      needs_clarification: false,
      suggestions: [],
      response: texts,
    };
  }
}

export const shortcutRouter = new ShortcutRouter();
