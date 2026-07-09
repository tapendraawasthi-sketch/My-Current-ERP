/** SUTRA AI — Zod validation gate before user-facing responses */

import { z } from "zod";
import type { AIResponse, ExtractedEntities, ValidationResult } from "../types";

const MAX_AMOUNT = 10_000_000;

const AIResponseSchema = z.object({
  understood_input: z.string().min(1),
  confidence: z.number().min(0).max(1),
  needs_clarification: z.boolean(),
  suggestions: z.array(
    z.object({
      text: z.string(),
      confidence: z.number(),
      explanation: z.string(),
    }),
  ),
  response: z.object({
    english: z.string(),
    nepali: z.string(),
    roman: z.string(),
  }),
  transaction: z
    .object({
      type: z.string().optional(),
      product: z.string().optional(),
      amount: z.number().optional(),
      quantity: z.number().optional(),
      party: z.string().optional(),
    })
    .optional(),
});

export class ResponseValidator {
  validate(response: AIResponse, entities?: ExtractedEntities): ValidationResult {
    const issues: string[] = [];

    const parsed = AIResponseSchema.safeParse(response);
    if (!parsed.success) {
      issues.push("Response structure invalid");
    }

    const amount = entities?.amount ?? response.transaction?.amount;
    if (amount !== undefined) {
      if (!Number.isFinite(amount) || amount <= 0) {
        issues.push("Amount must be a positive number");
      } else if (amount > MAX_AMOUNT) {
        issues.push(`Amount exceeds reasonable limit (Rs. ${MAX_AMOUNT.toLocaleString()})`);
      }
    }

    const qty = entities?.quantity ?? response.transaction?.quantity;
    if (qty !== undefined && (!Number.isFinite(qty) || qty <= 0)) {
      issues.push("Quantity must be positive");
    }

    if (
      response.transaction?.type &&
      ["sales", "purchase", "return"].includes(response.transaction.type) &&
      !entities?.product &&
      !response.transaction.product &&
      !response.needs_clarification
    ) {
      issues.push("Product not identified for transaction");
    }

    if (response.confidence < 0.4 && !response.needs_clarification) {
      issues.push("Confidence too low without clarification");
    }

    const clarificationQuestion = this.buildClarification(issues, entities);

    return {
      valid: issues.length === 0,
      issues,
      clarificationQuestion: issues.length > 0 ? clarificationQuestion : undefined,
    };
  }

  private buildClarification(issues: string[], entities?: ExtractedEntities): string {
    if (issues.some((i) => i.includes("Amount"))) {
      return "रकम सही छ? कृपया फेरि लेख्नुहोस् — जस्तै: `500 ko kakro bechye`";
    }
    if (issues.some((i) => i.includes("Product"))) {
      return "कुन सामान? उत्पादनको नाम लेख्नुहोस् — जस्तै: kakro, aalu, pyaj";
    }
    if (issues.some((i) => i.includes("Confidence"))) {
      return "मैले पूर्ण रूपमा बुझिन। के तपाईं फेरि स्पष्ट गर्न सक्नुहुन्छ?";
    }
    if (entities?.product && entities?.amount && !entities?.party) {
      return "कसलाई बेच्नुभयो? नगद कि उधार? — जस्तै: `ram lai udhaar`";
    }
    return "कृपया थप विवरण दिनुहोस् ताकि म सही बुझ्न सकूँ।";
  }
}

export const responseValidator = new ResponseValidator();
