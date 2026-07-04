import { isNativePlatform } from "./platform";

interface OcrResult {
  text: string;
  confidence: number;
}

async function captureImageNative(): Promise<File | null> {
  try {
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
    });

    if (!photo.dataUrl) return null;

    const response = await fetch(photo.dataUrl);
    const blob = await response.blob();
    return new File([blob], "capture.jpg", { type: "image/jpeg" });
  } catch {
    return null;
  }
}

export async function extractAmountFromImage(
  file: File,
): Promise<OcrResult> {
  const Tesseract = await import("tesseract.js");
  const result = await Tesseract.recognize(file, "nep+eng");
  const text = result.data.text.replace(/\s+/g, " ").trim();
  const confidence = result.data.confidence ?? 0;
  const amountMatch = text.match(/(?:rs\.?|npr\.?|₨)?\s*(\d+(?:\.\d+)?)/i);
  return {
    text: amountMatch?.[1] ?? text,
    confidence,
  };
}

export async function captureAndExtract(): Promise<OcrResult | null> {
  if (!isNativePlatform()) return null;

  const file = await captureImageNative();
  if (!file) return null;

  return extractAmountFromImage(file);
}
