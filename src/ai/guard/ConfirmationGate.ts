/** SUTRA AI — hold risky transactions until user confirms */

import type {
  AIResponse,
  ExtractedEntities,
  IntentClassification,
  IntentType,
  LanguageCode,
  PendingSutraAction,
  SessionState,
} from "../types";
import { actionExecutor } from "../actions/ActionExecutor";

const CONFIRM_PROMPT = {
  nepali: "⚠️ यो लेनदेन असामान्य वा दोहोरिएको देखिन्छ। के यो सही हो? `ho` वा `hoina` भन्नुहोस्।",
  english: "⚠️ This transaction looks unusual or duplicate. Is it correct? Reply `yes` or `no`.",
  roman: "⚠️ Yo len den unusual cha. Sahi ho? `ho` ya `hoina` bhannus.",
};

const CONFIRMED = {
  nepali: "ठीक छ — तलको बटनबाट रेकर्ड गर्नुहोस्।",
  english: "Confirmed — use the button below to record.",
  roman: "Thik cha — button bata record garnus.",
};

const REJECTED = {
  nepali: "रद्द गरियो। केही परिवर्तन छ भने फेरि लेख्नुहोस्।",
  english: "Cancelled. Type again if you need to change something.",
  roman: "Radda gariyo. Feri lekhnuhos.",
};

export class ConfirmationGate {
  needsGate(response: AIResponse, erpQueryResolved: boolean): boolean {
    if (erpQueryResolved || response.needs_clarification) return false;
    return Boolean(
      response.duplicateWarning ||
        response.anomalyWarning ||
        response.stockWarning ||
        response.creditLimitWarning,
    );
  }

  gate(
    response: AIResponse,
    entities: ExtractedEntities,
    intent: IntentClassification,
    outputLanguage: LanguageCode,
    understoodInput: string,
  ): { response: AIResponse; pending: PendingSutraAction } {
    const warnings = [
      response.duplicateWarning,
      response.anomalyWarning,
      response.stockWarning,
      response.creditLimitWarning,
    ].filter(Boolean) as string[];

    const prompt =
      outputLanguage === "english"
        ? CONFIRM_PROMPT.english
        : outputLanguage === "roman"
          ? CONFIRM_PROMPT.roman
          : CONFIRM_PROMPT.nepali;

    const gated: AIResponse = {
      ...response,
      actions: undefined,
      needs_clarification: false,
      followUp: [response.followUp, prompt].filter(Boolean).join("\n"),
      quickReplies: [
        { id: "confirm-ho", label: "हो", value: "ho", kind: "confirm" },
        { id: "confirm-no", label: "होइन", value: "hoina", kind: "reject" },
      ],
    };

    return {
      response: gated,
      pending: {
        understoodInput,
        entities,
        intent: intent.intent,
        warnings,
        outputLanguage,
      },
    };
  }

  buildConfirmedResponse(
    pending: PendingSutraAction,
    session: SessionState,
  ): AIResponse {
    const lang = pending.outputLanguage;
    const msg =
      lang === "english" ? CONFIRMED.english : lang === "roman" ? CONFIRMED.roman : CONFIRMED.nepali;

    const actions = actionExecutor.resolve(
      pending.intent,
      pending.entities,
      pending.understoodInput,
      false,
    );

    return {
      understood_input: pending.understoodInput,
      confidence: 0.9,
      needs_clarification: false,
      suggestions: [],
      response: {
        nepali: msg,
        english: CONFIRMED.english,
        roman: CONFIRMED.roman,
      },
      followUp: pending.warnings.join("\n"),
      actions: actions.length > 0 ? actions : undefined,
      transaction: pending.entities.transactionType
        ? {
            type: pending.entities.transactionType,
            party: pending.entities.party,
            amount: pending.entities.amount,
            product: pending.entities.productEnglish ?? pending.entities.product,
          }
        : undefined,
    };
  }

  buildRejectedResponse(outputLanguage: LanguageCode): AIResponse {
    const msg =
      outputLanguage === "english"
        ? REJECTED.english
        : outputLanguage === "roman"
          ? REJECTED.roman
          : REJECTED.nepali;

    return {
      understood_input: "",
      confidence: 1,
      needs_clarification: false,
      suggestions: [],
      response: { nepali: msg, english: REJECTED.english, roman: REJECTED.roman },
    };
  }

  isConfirmIntent(intent: IntentType, session: SessionState): boolean {
    return intent === "CONFIRMATION" && Boolean(session.pendingAction);
  }

  isRejectIntent(intent: IntentType, session: SessionState): boolean {
    return intent === "REJECTION" && Boolean(session.pendingAction);
  }
}

export const confirmationGate = new ConfirmationGate();
