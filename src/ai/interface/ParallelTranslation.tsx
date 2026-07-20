/** SUTRA AI — parallel translation display (blueprint §7.1 / §6.1) */

import React from "react";
import type { LanguageCode, ParallelTranslation } from "../types";

interface ParallelTranslationViewProps {
  parallel: ParallelTranslation;
  primaryLanguage: LanguageCode;
  compact?: boolean;
  inverted?: boolean;
}

const LANG_LABELS: Record<LanguageCode, string> = {
  english: "EN",
  nepali: "नेप",
  roman: "Roman",
};

const ParallelTranslationView: React.FC<ParallelTranslationViewProps> = ({
  parallel,
  primaryLanguage,
  compact = false,
  inverted = false,
}) => {
  const secondary = (["english", "nepali", "roman"] as LanguageCode[]).filter(
    (l) => l !== primaryLanguage,
  );

  const borderColor = inverted ? "border-white/20" : "border-gray-100";
  const labelColor = inverted ? "text-white/60" : "text-gray-400";
  const textColor = inverted ? "text-white/80" : "text-gray-600";

  if (compact) {
    return (
      <div className={`mt-1 pt-1 border-t ${borderColor} space-y-0.5`}>
        {secondary.map((lang) => {
          const text = parallel[lang];
          if (!text || text === parallel[primaryLanguage]) return null;
          return (
            <p key={lang} className={`text-[10px] ${textColor}`}>
              <span className={`${labelColor} font-semibold uppercase mr-1`}>
                {LANG_LABELS[lang]}:
              </span>
              {text}
            </p>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`mt-2 rounded-lg border ${borderColor} overflow-hidden`}>
      <div className={`px-2 py-1 ${inverted ? "bg-white/10" : "bg-gray-50"} border-b ${borderColor}`}>
        <span className={`text-[8px] font-bold uppercase tracking-widest ${labelColor}`}>
          Parallel translation
        </span>
      </div>
      <div className="divide-y divide-gray-100">
        {secondary.map((lang) => {
          const text = parallel[lang];
          if (!text) return null;
          return (
            <div key={lang} className="px-2.5 py-1.5 flex gap-2">
              <span
                className={`flex-shrink-0 w-10 text-[8px] font-bold uppercase ${labelColor} pt-0.5`}
              >
                {LANG_LABELS[lang]}
              </span>
              <span className={`text-[11px] ${textColor} leading-snug`}>{text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ParallelTranslationView;
