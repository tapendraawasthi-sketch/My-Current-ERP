import { describe, expect, it } from "vitest";
import {
  buildOrbixComposerFromInterpretation,
  buildOrbixComposerFromOcr,
  parseDocumentLlmJson,
} from "../../lib/ekhata/orbixDocumentCamera";

describe("orbixDocumentCamera composer", () => {
  it("builds a reviewable accounting draft from OCR fields", () => {
    const text = buildOrbixComposerFromOcr({
      ok: true,
      fields: {
        partyName: "ABC Traders",
        invoiceNumber: "INV-9",
        grandTotal: 1300,
        lines: [{ itemName: "Rice", qty: 1, rate: 1300, amount: 1300 }],
      },
    });
    expect(text).toContain("ABC Traders");
    expect(text).toContain("INV-9");
    expect(text).toContain("1300");
    expect(text.toLowerCase()).toContain("confirm");
    expect(text.toLowerCase()).toContain("do not post");
  });

  it("never pretends OCR succeeded when empty", () => {
    const text = buildOrbixComposerFromOcr({
      ok: false,
      error: "OCR engine unavailable",
    });
    expect(text.toLowerCase()).toContain("photographed");
    expect(text.toLowerCase()).toContain("confirm");
  });

  it("parses LLM JSON meaning and builds richer composer text", () => {
    const answer = JSON.stringify({
      document_type: "purchase_invoice",
      what_was_written: "Purchase bill from Himalayan Traders for rice bags totaling Rs 13000 with VAT.",
      party_name: "Himalayan Traders",
      our_role: "buyer",
      invoice_number: "B-442",
      date: "2082-03-15",
      currency: "NPR",
      grand_total: 13000,
      vat_amount: 1500,
      line_items: [{ name: "Rice 25kg", qty: 10, rate: 1150, amount: 11500 }],
      corrected_ocr_reading: "Bill No B-442 Himalayan Traders Total 13000",
      accounting_intent: "record_purchase",
      confidence: 0.86,
      uncertainties: [],
    });
    const interp = parseDocumentLlmJson(answer);
    expect(interp?.partyName).toBe("Himalayan Traders");
    expect(interp?.accountingIntent).toBe("record_purchase");
    expect(interp?.whatWasWritten).toMatch(/Purchase bill/i);

    const text = buildOrbixComposerFromInterpretation(interp!);
    expect(text).toContain("Himalayan Traders");
    expect(text).toContain("Meaning:");
    expect(text).toMatch(/purchase/i);
    expect(text.toLowerCase()).toContain("do not post");
  });

  it("parses fenced JSON from LLM answers", () => {
    const answer = "Here you go:\n```json\n{\"what_was_written\":\"Cash receipt Rs 500\",\"accounting_intent\":\"record_receipt\",\"confidence\":0.7}\n```";
    const interp = parseDocumentLlmJson(answer);
    expect(interp?.whatWasWritten).toMatch(/Cash receipt/i);
    expect(interp?.accountingIntent).toBe("record_receipt");
  });
});
