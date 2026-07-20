/**
 * Document camera capture for Orbix / Ask MokXya (mobile-first).
 * Pipeline: capture → OCR → LLM meaning pass → composer draft (never auto-posts).
 *
 * Ported patterns from khata-app/src/lib/ocrInput.ts + InputBar camera flow.
 */

import { askOrbixQwen } from "./orbixQwenClient";
import { getEKhataSessionId } from "./ekhataLlmClient";
import { isSelfContainedAi } from "../selfContainedAi";

export interface DocumentCaptureResult {
  file: File;
  previewUrl: string;
}

export interface DocumentOcrFields {
  partyName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  grandTotal?: string | number;
  subtotal?: string | number;
  vatAmount?: string | number;
  sellerPan?: string;
  buyerPan?: string;
  rawText?: string;
  lines?: Array<{
    itemName?: string;
    description?: string;
    qty?: number;
    rate?: number;
    amount?: number;
  }>;
}

/** Structured meaning from the LLM after reading OCR text. */
export interface DocumentLlmInterpretation {
  documentType?: string;
  whatWasWritten?: string;
  partyName?: string;
  ourRole?: string;
  invoiceNumber?: string;
  date?: string;
  currency?: string;
  grandTotal?: number | string | null;
  vatAmount?: number | string | null;
  lineItems?: Array<{ name?: string; qty?: number; rate?: number; amount?: number }>;
  correctedOcrReading?: string;
  accountingIntent?: string;
  confidence?: number;
  uncertainties?: string[];
  rawAnswer?: string;
}

export interface DocumentOcrResult {
  ok: boolean;
  engine?: string;
  fields?: DocumentOcrFields;
  draft?: Record<string, unknown> | null;
  error?: string;
  hint?: string;
  composerText: string;
  /** Present when LLM meaning-pass succeeded. */
  interpretation?: DocumentLlmInterpretation | null;
  llmUsed?: boolean;
}

export type DocumentExtractStage =
  | "capturing"
  | "ocr"
  | "understanding"
  | "ready"
  | "error";

export interface ExtractDocumentOptions {
  /** Run LLM meaning pass after OCR (default true when LLM reachable). */
  useLlm?: boolean;
  orbixMode?: "ask" | "accountant";
  sessionId?: string;
  onStage?: (stage: DocumentExtractStage, detail?: string) => void;
  signal?: AbortSignal;
}

/** True when running inside a Capacitor native shell (khata-app pattern). */
export function isNativeCameraPlatform(): boolean {
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}

/** Prefer showing the camera control on coarse pointers / narrow viewports. */
export function preferMobileDocumentCamera(): boolean {
  if (typeof window === "undefined") return false;
  if (isNativeCameraPlatform()) return true;
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
  const narrow = window.matchMedia?.("(max-width: 768px)")?.matches;
  return Boolean(coarse || narrow);
}

/** Dynamic import that Vite will not try to resolve at build time. */
async function importOptional(moduleId: string): Promise<Record<string, unknown> | null> {
  try {
    const dyn = new Function("id", "return import(id)") as (
      id: string,
    ) => Promise<Record<string, unknown>>;
    return await dyn(moduleId);
  } catch {
    return null;
  }
}

export async function captureDocumentNative(): Promise<DocumentCaptureResult | null> {
  if (!isNativeCameraPlatform()) return null;
  try {
    const mod = await importOptional("@capacitor/camera");
    if (!mod) return null;
    const Camera = mod.Camera as {
      getPhoto: (opts: Record<string, unknown>) => Promise<{ dataUrl?: string }>;
    };
    const CameraResultType = mod.CameraResultType as { DataUrl: string };
    const CameraSource = mod.CameraSource as { Camera: string };
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
    });
    if (!photo.dataUrl) return null;
    const response = await fetch(photo.dataUrl);
    const blob = await response.blob();
    const file = new File([blob], `orbix-doc-${Date.now()}.jpg`, {
      type: blob.type || "image/jpeg",
    });
    return { file, previewUrl: photo.dataUrl };
  } catch {
    return null;
  }
}

export function fileToPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

function fieldStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function evidencePack(fields: DocumentOcrFields, draft?: Record<string, unknown> | null): string {
  const lines =
    fields.lines
      ?.slice(0, 20)
      .map((l) => {
        const name = fieldStr(l.itemName) || fieldStr(l.description) || "item";
        return `${name} | qty=${l.qty ?? ""} | rate=${l.rate ?? ""} | amt=${l.amount ?? ""}`;
      })
      .join("\n") || "";

  const bits = [
    fields.rawText ? `RAW_OCR:\n${fields.rawText.slice(0, 4500)}` : null,
    fields.partyName ? `OCR_PARTY: ${fields.partyName}` : null,
    fields.invoiceNumber ? `OCR_INVOICE_NO: ${fields.invoiceNumber}` : null,
    fields.invoiceDate ? `OCR_DATE: ${fields.invoiceDate}` : null,
    fields.grandTotal != null ? `OCR_TOTAL: ${fields.grandTotal}` : null,
    fields.vatAmount != null ? `OCR_VAT: ${fields.vatAmount}` : null,
    fields.sellerPan ? `OCR_SELLER_PAN: ${fields.sellerPan}` : null,
    fields.buyerPan ? `OCR_BUYER_PAN: ${fields.buyerPan}` : null,
    lines ? `OCR_LINES:\n${lines}` : null,
    draft ? `OCR_DRAFT_JSON:\n${JSON.stringify(draft).slice(0, 2000)}` : null,
  ].filter(Boolean);

  return bits.join("\n\n");
}

/** Parse LLM JSON (allows fenced ```json blocks). */
export function parseDocumentLlmJson(answer: string): DocumentLlmInterpretation | null {
  if (!answer?.trim()) return null;
  let raw = answer.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const lineItems = Array.isArray(obj.line_items)
      ? (obj.line_items as Array<Record<string, unknown>>).map((l) => ({
          name: fieldStr(l.name || l.itemName || l.description) || undefined,
          qty: typeof l.qty === "number" ? l.qty : Number(l.qty) || undefined,
          rate: typeof l.rate === "number" ? l.rate : Number(l.rate) || undefined,
          amount: typeof l.amount === "number" ? l.amount : Number(l.amount) || undefined,
        }))
      : Array.isArray(obj.lineItems)
        ? (obj.lineItems as Array<Record<string, unknown>>).map((l) => ({
            name: fieldStr(l.name) || undefined,
            qty: typeof l.qty === "number" ? l.qty : undefined,
            rate: typeof l.rate === "number" ? l.rate : undefined,
            amount: typeof l.amount === "number" ? l.amount : undefined,
          }))
        : undefined;

    return {
      documentType: fieldStr(obj.document_type || obj.documentType) || undefined,
      whatWasWritten: fieldStr(obj.what_was_written || obj.whatWasWritten) || undefined,
      partyName: fieldStr(obj.party_name || obj.partyName) || undefined,
      ourRole: fieldStr(obj.our_role || obj.ourRole) || undefined,
      invoiceNumber: fieldStr(obj.invoice_number || obj.invoiceNumber) || undefined,
      date: fieldStr(obj.date || obj.invoice_date) || undefined,
      currency: fieldStr(obj.currency) || "NPR",
      grandTotal: (obj.grand_total ?? obj.grandTotal ?? null) as number | string | null,
      vatAmount: (obj.vat_amount ?? obj.vatAmount ?? null) as number | string | null,
      lineItems,
      correctedOcrReading:
        fieldStr(obj.corrected_ocr_reading || obj.correctedOcrReading) || undefined,
      accountingIntent: fieldStr(obj.accounting_intent || obj.accountingIntent) || undefined,
      confidence:
        typeof obj.confidence === "number"
          ? obj.confidence
          : Number(obj.confidence) || undefined,
      uncertainties: Array.isArray(obj.uncertainties)
        ? obj.uncertainties.map((u) => String(u))
        : undefined,
      rawAnswer: answer.slice(0, 4000),
    };
  } catch {
    return null;
  }
}

export function buildOrbixComposerFromInterpretation(
  interp: DocumentLlmInterpretation,
  ocrFallback?: DocumentOcrFields,
): string {
  const party = interp.partyName || ocrFallback?.partyName || "";
  const inv = interp.invoiceNumber || ocrFallback?.invoiceNumber || "";
  const date = interp.date || ocrFallback?.invoiceDate || "";
  const total =
    interp.grandTotal != null && interp.grandTotal !== ""
      ? String(interp.grandTotal)
      : fieldStr(ocrFallback?.grandTotal);
  const vat =
    interp.vatAmount != null && interp.vatAmount !== ""
      ? String(interp.vatAmount)
      : fieldStr(ocrFallback?.vatAmount);
  const intent = interp.accountingIntent || "unclear";
  const docType = interp.documentType || "document";
  const role = interp.ourRole || "unclear";

  const lineBits =
    interp.lineItems
      ?.slice(0, 12)
      .map((l) => {
        const name = fieldStr(l.name) || "item";
        const qty = l.qty != null ? ` x${l.qty}` : "";
        const rate = l.rate != null ? ` @ ${l.rate}` : "";
        const amt = l.amount != null ? ` = ${l.amount}` : "";
        return `- ${name}${qty}${rate}${amt}`;
      })
      .filter(Boolean) || [];

  const uncertain =
    interp.uncertainties && interp.uncertainties.length
      ? `Uncertainties: ${interp.uncertainties.slice(0, 5).join("; ")}`
      : null;

  const meaning =
    interp.whatWasWritten ||
    interp.correctedOcrReading ||
    "Document meaning inferred from OCR + LLM.";

  const intentHint =
    intent === "record_purchase"
      ? "Please draft a purchase entry from this document."
      : intent === "record_sale"
        ? "Please draft a sales invoice from this document."
        : intent === "record_payment"
          ? "Please draft a payment voucher from this document."
          : intent === "record_receipt"
            ? "Please draft a receipt voucher from this document."
            : "Please draft the matching accounting entry from this document.";

  return [
    "Document understood for accounting (LLM + OCR — review before posting):",
    `Meaning: ${meaning}`,
    `Document type: ${docType}`,
    `Our role: ${role}`,
    `Intended action: ${intent}`,
    party ? `Party: ${party}` : null,
    inv ? `Invoice/Bill no: ${inv}` : null,
    date ? `Date: ${date}` : null,
    total ? `Amount: Rs. ${total}` : null,
    vat ? `VAT: Rs. ${vat}` : null,
    lineBits.length ? `Items:\n${lineBits.join("\n")}` : null,
    uncertain,
    interp.confidence != null ? `AI confidence: ${Math.round(Number(interp.confidence) * 100)}%` : null,
    "",
    intentHint,
    "I will edit and confirm — do not post yet.",
  ]
    .filter((x) => x != null && x !== "")
    .join("\n");
}

/** Build a shopkeeper-friendly composer draft from NIOS OCR / local extract. */
export function buildOrbixComposerFromOcr(result: {
  ok: boolean;
  fields?: DocumentOcrFields | null;
  draft?: Record<string, unknown> | null;
  error?: string;
  hint?: string;
  engine?: string;
  rawFallbackText?: string;
}): string {
  const draft = (result.draft || {}) as Record<string, unknown>;
  const fields = result.fields || {};
  const party =
    fieldStr(fields.partyName) ||
    fieldStr(draft.partyName) ||
    fieldStr((draft as { party?: string }).party);
  const invNo =
    fieldStr(fields.invoiceNumber) ||
    fieldStr(draft.invoiceNo) ||
    fieldStr(draft.invoice_number);
  const date =
    fieldStr(fields.invoiceDate) || fieldStr(draft.date) || fieldStr(draft.invoice_date);
  const total =
    fieldStr(fields.grandTotal) ||
    fieldStr(draft.grandTotal) ||
    fieldStr(draft.grand_total) ||
    fieldStr(fields.subtotal);
  const vat = fieldStr(fields.vatAmount) || fieldStr(draft.vatAmount);
  const lines = Array.isArray(fields.lines)
    ? fields.lines
    : Array.isArray(draft.lines)
      ? (draft.lines as DocumentOcrFields["lines"])
      : [];

  const lineBits =
    lines
      ?.slice(0, 12)
      .map((l) => {
        const name = fieldStr(l?.itemName) || fieldStr(l?.description) || "item";
        const qty = l?.qty != null ? String(l.qty) : "";
        const rate = l?.rate != null ? String(l.rate) : "";
        const amt = l?.amount != null ? String(l.amount) : "";
        return `- ${name}${qty ? ` x${qty}` : ""}${rate ? ` @ ${rate}` : ""}${amt ? ` = ${amt}` : ""}`;
      })
      .filter(Boolean) || [];

  const raw = fieldStr(fields.rawText) || fieldStr(result.rawFallbackText) || "";

  if (!result.ok && !party && !total && !raw) {
    return [
      "I photographed a bill/invoice for accounting.",
      result.error ? `(OCR note: ${result.error})` : "",
      result.hint || "Please help me draft a purchase or sales entry from this document.",
      "I will review the preview and confirm before posting.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const parts = [
    "Document scan for accounting (OCR only — review before posting):",
    party ? `Party: ${party}` : null,
    invNo ? `Invoice no: ${invNo}` : null,
    date ? `Date: ${date}` : null,
    total ? `Amount: Rs. ${total}` : null,
    vat ? `VAT: Rs. ${vat}` : null,
    lineBits.length ? `Items:\n${lineBits.join("\n")}` : null,
    raw ? `OCR text:\n${raw.slice(0, 1200)}` : null,
    "",
    "Please draft the matching purchase or sales entry. I will edit and confirm — do not post yet.",
  ].filter((x) => x != null) as string[];

  return parts.join("\n");
}

function normalizeOcrFields(
  fields: Record<string, unknown> | null | undefined,
  draft: Record<string, unknown> | null | undefined,
  rawTextTop?: string,
): DocumentOcrFields {
  const f = fields || {};
  const d = draft || {};
  return {
    partyName: fieldStr(f.partyName || f.party_name || d.partyName || d.party_name),
    invoiceNumber: fieldStr(
      f.invoiceNumber || f.invoice_number || d.invoiceNo || d.invoice_number,
    ),
    invoiceDate: fieldStr(f.invoiceDate || f.invoice_date || d.date || d.invoice_date),
    grandTotal: (f.grandTotal ?? f.grand_total ?? d.grandTotal ?? d.grand_total) as
      | string
      | number
      | undefined,
    subtotal: (f.subtotal ?? d.subtotal) as string | number | undefined,
    vatAmount: (f.vatAmount ?? f.vat_amount ?? d.vatAmount) as string | number | undefined,
    sellerPan: fieldStr(f.sellerPan || f.seller_pan || d.sellerPan),
    buyerPan: fieldStr(f.buyerPan || f.buyer_pan || d.buyerPan),
    rawText: fieldStr(f.rawText || f.raw_text || rawTextTop || d.raw_text),
    lines: (Array.isArray(f.lines) ? f.lines : Array.isArray(d.lines) ? d.lines : undefined) as
      | DocumentOcrFields["lines"]
      | undefined,
  };
}

function buildLlmPrompt(pack: string): string {
  return [
    "You are helping Nepal ERP accounting. A user photographed a document.",
    "Below is noisy OCR text and heuristic fields. Read carefully for MEANING —",
    "what was actually written — correcting obvious OCR mistakes (0/O, l/1,",
    "Devanagari, Romanized Nepali, missing spaces).",
    "",
    "Return ONLY valid JSON (no markdown, no posting instructions):",
    "{",
    '  "document_type": "purchase_invoice|sales_invoice|receipt|payment|challan|credit_note|other",',
    '  "what_was_written": "1-3 sentences: plain meaning of the document",',
    '  "party_name": "string or empty",',
    '  "our_role": "buyer|seller|payer|payee|unclear",',
    '  "invoice_number": "string or empty",',
    '  "date": "string or empty",',
    '  "currency": "NPR",',
    '  "grand_total": number or null,',
    '  "vat_amount": number or null,',
    '  "line_items": [{"name":"","qty":0,"rate":0,"amount":0}],',
    '  "corrected_ocr_reading": "cleaned readable text of key facts",',
    '  "accounting_intent": "record_purchase|record_sale|record_payment|record_receipt|unclear",',
    '  "confidence": 0.0,',
    '  "uncertainties": ["..."]',
    "}",
    "",
    "Rules:",
    "- Prefer meaning over literal OCR garbage.",
    "- Do not invent tax rates or legal conclusions.",
    "- Do not say to post or confirm entries.",
    "- If unclear, lower confidence and list uncertainties.",
    "",
    "=== DOCUMENT EVIDENCE ===",
    pack,
  ].join("\n");
}

/**
 * LLM meaning-pass: understand what the document says (not just OCR tokens).
 * Uses Orbix /chat in ask mode — interpretation only, never ledger authority.
 */
export async function interpretDocumentWithLlm(
  fields: DocumentOcrFields,
  options?: {
    draft?: Record<string, unknown> | null;
    sessionId?: string;
    orbixMode?: "ask" | "accountant";
    signal?: AbortSignal;
  },
): Promise<DocumentLlmInterpretation | null> {
  if (isSelfContainedAi()) return null;
  const pack = evidencePack(fields, options?.draft);
  if (!pack.trim()) return null;

  try {
    const sessionId = options?.sessionId || getEKhataSessionId();
    const { answer } = await askOrbixQwen(buildLlmPrompt(pack), sessionId, {
      signal: options?.signal,
      orbixMode: "ask",
      context: {
        document_camera: true,
        interpretation_only: true,
        source: "orbix_document_camera",
      },
    });
    const parsed = parseDocumentLlmJson(answer);
    if (parsed) return parsed;
    // Soft fallback: keep prose meaning if JSON parse fails
    if (answer.trim().length > 40) {
      return {
        whatWasWritten: answer.trim().slice(0, 800),
        correctedOcrReading: answer.trim().slice(0, 1200),
        accountingIntent: "unclear",
        confidence: 0.35,
        rawAnswer: answer.slice(0, 4000),
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function runOcrOnly(file: File): Promise<DocumentOcrResult> {
  // 1) Preferred: NIOS server OCR
  try {
    const { niosOcrInvoiceImage } = await import("../../nios/client/niosClient");
    const data = (await niosOcrInvoiceImage(file)) as {
      ok?: boolean;
      error?: string;
      hint?: string;
      ocr_engine?: string;
      fields?: Record<string, unknown>;
      draft?: Record<string, unknown> | null;
      raw_text?: string;
    };
    const fields = normalizeOcrFields(data.fields, data.draft ?? undefined, data.raw_text);
    const composerText = buildOrbixComposerFromOcr({
      ok: Boolean(data.ok),
      fields,
      draft: data.draft,
      error: data.error,
      hint: data.hint,
      engine: data.ocr_engine,
    });
    return {
      ok: Boolean(data.ok) || Boolean(fields.rawText),
      engine: data.ocr_engine,
      fields,
      draft: data.draft ?? null,
      error: data.error,
      hint: data.hint,
      composerText,
      llmUsed: false,
    };
  } catch {
    /* fall through */
  }

  // 2) Optional local Tesseract
  try {
    const Tesseract = await importOptional("tesseract.js");
    const recognize = Tesseract?.recognize as
      | ((f: File, lang: string) => Promise<{ data: { text?: string } }>)
      | undefined;
    if (recognize) {
      const result = await recognize(file, "nep+eng");
      const text = String(result.data.text || "")
        .replace(/\s+/g, " ")
        .trim();
      const fields: DocumentOcrFields = { rawText: text };
      return {
        ok: Boolean(text),
        engine: "tesseract-local",
        fields,
        composerText: buildOrbixComposerFromOcr({
          ok: Boolean(text),
          fields,
          rawFallbackText: text,
          engine: "tesseract-local",
          error: text ? undefined : "No text found in image",
        }),
        llmUsed: false,
      };
    }
  } catch {
    /* fall through */
  }

  return {
    ok: false,
    error: "OCR unavailable",
    hint: "Photo saved — type the bill details or try again when online.",
    composerText: buildOrbixComposerFromOcr({
      ok: false,
      error: "OCR unavailable offline",
      hint: "Describe the bill (party, amount, items) so Orbix can draft an entry for your confirmation.",
    }),
    llmUsed: false,
  };
}

/**
 * Full pipeline: OCR → LLM meaning → composer draft.
 * Never posts; user must send + confirm.
 */
export async function extractDocumentForOrbix(
  file: File,
  options?: ExtractDocumentOptions,
): Promise<DocumentOcrResult> {
  const onStage = options?.onStage;
  onStage?.("ocr", "Reading text from photo…");
  const ocr = await runOcrOnly(file);

  const wantLlm = options?.useLlm !== false;
  const hasEvidence = Boolean(
    ocr.fields?.rawText ||
      ocr.fields?.partyName ||
      ocr.fields?.grandTotal != null ||
      ocr.draft,
  );

  if (!wantLlm || !hasEvidence) {
    onStage?.(ocr.ok ? "ready" : "error", ocr.hint);
    return ocr;
  }

  onStage?.("understanding", "Understanding document meaning with AI…");
  const interpretation = await interpretDocumentWithLlm(ocr.fields || {}, {
    draft: ocr.draft,
    sessionId: options?.sessionId,
    orbixMode: options?.orbixMode || "ask",
    signal: options?.signal,
  });

  if (!interpretation) {
    onStage?.("ready", "OCR ready — AI meaning unavailable, review OCR draft");
    return { ...ocr, llmUsed: false };
  }

  const composerText = buildOrbixComposerFromInterpretation(interpretation, ocr.fields);
  onStage?.("ready", "Document understood — review and send");
  return {
    ...ocr,
    ok: true,
    interpretation,
    llmUsed: true,
    composerText,
    hint: "LLM interpreted document meaning from OCR — review before sending",
  };
}
