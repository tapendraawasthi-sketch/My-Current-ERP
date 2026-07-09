/** SUTRA AI — "Did you mean?" suggestion card (blueprint §3.3) */

import React, { useState } from "react";
import { AlertTriangle, Check, Package, X } from "lucide-react";
import type { Suggestion } from "../types";

interface SuggestionCardProps {
  originalInput: string;
  suggestions: Suggestion[];
  unknownWords?: string[];
  onSelect: (suggestion: Suggestion) => void;
  onReject: () => void;
  onCustomInput: (text: string) => void;
}

function confidenceBadge(confidence: number): string {
  if (confidence >= 0.9) return "bg-green-100 text-green-700";
  if (confidence >= 0.75) return "bg-blue-100 text-blue-700";
  if (confidence >= 0.5) return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-700";
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
  originalInput,
  suggestions,
  unknownWords,
  onSelect,
  onReject,
  onCustomInput,
}) => {
  const [customText, setCustomText] = useState("");

  const best = suggestions.find((s) => s.correctionType !== "new_product") ?? suggestions[0];
  const alternatives = suggestions.filter((s) => s !== best);

  if (!best) return null;

  const isNewProduct = best.correctionType === "new_product";

  return (
    <div className="mx-3 mb-2 rounded-md border border-amber-200 bg-amber-50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-100 border-b border-amber-200">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
        <span className="text-[11px] font-medium text-amber-800">
          {unknownWords?.length ? `Unknown word: "${unknownWords[0]}"` : "Possible correction detected"}
        </span>
      </div>

      <div className="px-3 py-2 space-y-2">
        <p className="text-[11px] text-gray-600">
          Your input: <span className="font-mono text-gray-800">"{originalInput}"</span>
        </p>

        {!isNewProduct && (
          <div className="rounded-md border border-[#c7d2fe] bg-white p-2.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-[#1557b0] uppercase tracking-wide">
                ✨ Best match
              </p>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${confidenceBadge(best.confidence)}`}
              >
                {Math.round(best.confidence * 100)}%
              </span>
            </div>

            <p className="text-[13px] text-gray-900 font-medium whitespace-pre-line leading-snug">
              {best.displayText.split("\n")[0]}
            </p>
            {best.displayText.includes("\n") && (
              <p className="text-[11px] text-gray-500 mt-0.5 italic">
                {best.displayText.split("\n")[1]}
              </p>
            )}

            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {best.metadata?.product && (
                <span className="px-1.5 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-[9px] font-semibold uppercase">
                  🥒 {best.metadata.product}
                </span>
              )}
              {best.metadata?.amount && (
                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[9px] font-semibold uppercase">
                  💰 Rs. {best.metadata.amount}
                </span>
              )}
              {best.metadata?.transactionType && (
                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded text-[9px] font-semibold uppercase">
                  📝 {best.metadata.transactionType}
                </span>
              )}
            </div>

            <p className="text-[10px] text-gray-500 mt-1.5">{best.explanation}</p>

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => onSelect(best)}
                className="h-7 px-2.5 flex items-center gap-1 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[11px] font-medium rounded-md"
              >
                <Check className="h-3 w-3" /> Use This
              </button>
              <button
                type="button"
                onClick={onReject}
                className="h-7 px-2.5 flex items-center gap-1 bg-white border border-gray-300 text-gray-600 text-[11px] font-medium rounded-md hover:bg-gray-50"
              >
                <X className="h-3 w-3" /> Not This
              </button>
            </div>
          </div>
        )}

        {alternatives.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Other possibilities
            </p>
            {alternatives.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelect(s)}
                className={`w-full text-left px-2.5 py-1.5 rounded-md border text-[11px] flex items-center gap-2 ${
                  s.correctionType === "new_product"
                    ? "border-dashed border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {s.correctionType === "new_product" && <Package className="h-3 w-3 flex-shrink-0" />}
                <span className="flex-1">{s.displayText.split("\n")[0]}</span>
                <span className="text-[9px] text-gray-400">{Math.round(s.confidence * 100)}%</span>
              </button>
            ))}
          </div>
        )}

        <div className="pt-1 border-t border-amber-200">
          <p className="text-[10px] text-gray-500 mb-1">💬 Or type your correction:</p>
          <div className="flex gap-1">
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customText.trim()) {
                  onCustomInput(customText.trim());
                  setCustomText("");
                }
              }}
              className="flex-1 h-7 px-2 text-[11px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              placeholder="Type what you meant..."
            />
            <button
              type="button"
              disabled={!customText.trim()}
              onClick={() => {
                if (customText.trim()) {
                  onCustomInput(customText.trim());
                  setCustomText("");
                }
              }}
              className="h-7 px-2.5 bg-[#1557b0] hover:bg-[#0f4a96] disabled:opacity-40 text-white text-[11px] font-medium rounded-md"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuggestionCard;
