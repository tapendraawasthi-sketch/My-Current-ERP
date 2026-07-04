import Tesseract from "tesseract.js";

export async function extractAmountFromImage(file: File): Promise<{ text: string; confidence: number }> {
  const result = await Tesseract.recognize(file, "nep+eng");
  const text = result.data.text.replace(/\s+/g, " ").trim();
  const confidence = result.data.confidence ?? 0;
  const amountMatch = text.match(/(?:rs\.?|npr\.?|₨)?\s*(\d+(?:\.\d+)?)/i);
  return {
    text: amountMatch?.[1] ?? text,
    confidence,
  };
}
