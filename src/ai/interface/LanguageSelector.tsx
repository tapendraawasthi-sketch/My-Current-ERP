/** SUTRA AI — language selection UI */

import React from "react";
import type { InputLanguage, LanguageCode } from "../types";

interface LanguageSelectorProps {
  inputLanguage: InputLanguage;
  outputLanguage: LanguageCode;
  showTranslation: boolean;
  autoDetect: boolean;
  autoSpeakResponses?: boolean;
  onInputChange: (lang: InputLanguage) => void;
  onOutputChange: (lang: LanguageCode) => void;
  onShowTranslationChange: (show: boolean) => void;
  onAutoDetectChange: (auto: boolean) => void;
  onAutoSpeakChange?: (auto: boolean) => void;
}

const INPUT_OPTIONS: { value: InputLanguage; label: string }[] = [
  { value: "english", label: "EN" },
  { value: "nepali", label: "नेप" },
  { value: "roman", label: "Roman" },
  { value: "auto", label: "Auto" },
];

const OUTPUT_OPTIONS: { value: LanguageCode; label: string }[] = [
  { value: "english", label: "EN" },
  { value: "nepali", label: "नेप" },
  { value: "roman", label: "Roman" },
];

function LangButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-6 px-2 text-[10px] font-medium rounded border transition-colors ${
        active
          ? "bg-[#1557b0] text-white border-[#1557b0]"
          : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  inputLanguage,
  outputLanguage,
  showTranslation,
  autoDetect,
  autoSpeakResponses = false,
  onInputChange,
  onOutputChange,
  onShowTranslationChange,
  onAutoDetectChange,
  onAutoSpeakChange,
}) => {
  return (
    <div className="flex gap-3 px-3 py-2 bg-[#f5f6fa] border-b border-gray-200 text-[10px]">
      <div className="flex-1">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Input
        </p>
        <div className="flex gap-1 flex-wrap">
          {INPUT_OPTIONS.map((opt) => (
            <LangButton
              key={opt.value}
              label={opt.label}
              active={inputLanguage === opt.value}
              onClick={() => onInputChange(opt.value)}
            />
          ))}
        </div>
        <label className="flex items-center gap-1 mt-1 text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={autoDetect}
            onChange={(e) => onAutoDetectChange(e.target.checked)}
            className="w-3 h-3"
          />
          Auto-detect
        </label>
      </div>
      <div className="flex-1">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Output
        </p>
        <div className="flex gap-1 flex-wrap">
          {OUTPUT_OPTIONS.map((opt) => (
            <LangButton
              key={opt.value}
              label={opt.label}
              active={outputLanguage === opt.value}
              onClick={() => onOutputChange(opt.value)}
            />
          ))}
        </div>
        <label className="flex items-center gap-1 mt-1 text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={showTranslation}
            onChange={(e) => onShowTranslationChange(e.target.checked)}
            className="w-3 h-3"
          />
          Show translation
        </label>
        {onAutoSpeakChange && (
          <label className="flex items-center gap-1 mt-0.5 text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={autoSpeakResponses}
              onChange={(e) => onAutoSpeakChange(e.target.checked)}
              className="w-3 h-3"
            />
            Auto-speak replies
          </label>
        )}
      </div>
    </div>
  );
};

export default LanguageSelector;
