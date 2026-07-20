/**
 * Mobile document camera for Orbix composer.
 * Capture → OCR → LLM meaning → composer draft (user still sends / confirms).
 */
import React, { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import {
  captureDocumentNative,
  extractDocumentForOrbix,
  fileToPreviewUrl,
  isNativeCameraPlatform,
  type DocumentExtractStage,
} from "../../lib/ekhata/orbixDocumentCamera";

export interface OrbixDocumentCameraButtonProps {
  disabled?: boolean;
  /** Insert OCR+LLM draft into the composer (user still sends / confirms). */
  onDraftReady: (
    composerText: string,
    meta: {
      previewUrl: string;
      fileName: string;
      status: string;
      llmUsed?: boolean;
    },
  ) => void;
  /** Live stage updates while processing. */
  onStage?: (stage: DocumentExtractStage, detail?: string) => void;
  className?: string;
}

const OrbixDocumentCameraButton: React.FC<OrbixDocumentCameraButtonProps> = ({
  disabled,
  onDraftReady,
  onStage,
  className = "",
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const processFile = async (file: File, preview: string) => {
    setBusy(true);
    onStage?.("ocr", "Reading text from photo…");
    try {
      const ocr = await extractDocumentForOrbix(file, {
        useLlm: true,
        orbixMode: "ask",
        onStage: (stage, detail) => onStage?.(stage, detail),
      });
      const status =
        ocr.llmUsed
          ? ocr.hint || "AI understood the document — review and send"
          : ocr.ok
            ? ocr.hint || "OCR draft ready — review and send"
            : ocr.hint || "Add details, then send";
      onDraftReady(ocr.composerText, {
        previewUrl: preview,
        fileName: file.name,
        status,
        llmUsed: ocr.llmUsed,
      });
    } catch {
      onStage?.("error", "Could not read document");
      onDraftReady(
        "I photographed a bill/invoice. Please help draft a purchase or sales entry. I will confirm before posting.",
        {
          previewUrl: preview,
          fileName: file.name,
          status: "Could not read document. Type the bill details instead.",
          llmUsed: false,
        },
      );
    } finally {
      setBusy(false);
    }
  };

  const handleNative = async () => {
    setBusy(true);
    onStage?.("capturing", "Opening camera…");
    try {
      const captured = await captureDocumentNative();
      if (!captured) {
        fileRef.current?.click();
        return;
      }
      await processFile(captured.file, captured.previewUrl);
    } finally {
      setBusy(false);
    }
  };

  const handleClick = () => {
    if (disabled || busy) return;
    if (isNativeCameraPlatform()) {
      void handleNative();
    } else {
      fileRef.current?.click();
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = fileToPreviewUrl(file);
    void processFile(file, url);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || busy}
        title="Photograph bill / invoice — OCR + AI meaning for accounting"
        aria-label="Photograph document for AI accounting"
        data-testid="orbix-document-camera"
        className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--ds-radius-md)] border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 ${className}`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#1557b0]" />
        ) : (
          <Camera className="h-4 w-4 text-[#1557b0]" />
        )}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        data-testid="orbix-document-camera-input"
        onChange={onFileChange}
      />
    </>
  );
};

export default OrbixDocumentCameraButton;
