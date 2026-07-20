/** SUTRA AI — autocomplete dropdown for chat input */

import React from "react";
import type { AutocompleteSuggestion } from "./InputAutocompleteEngine";

interface InputAutocompleteProps {
  suggestions: AutocompleteSuggestion[];
  activeIndex: number;
  onSelect: (text: string) => void;
}

const InputAutocomplete: React.FC<InputAutocompleteProps> = ({
  suggestions,
  activeIndex,
  onSelect,
}) => {
  if (!suggestions.length) return null;

  return (
    <ul className="absolute left-0 right-0 bottom-full mb-1.5 z-10 bg-white border border-gray-100 rounded-lg shadow-xl max-h-40 overflow-y-auto">
      {suggestions.map((s, i) => (
        <li key={s.text}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(s.text);
            }}
            className={`w-full text-left px-3 py-2 text-[11px] flex items-center justify-between gap-2 transition-colors ${
              i === activeIndex ? "bg-blue-50 text-[var(--ds-action-primary)] font-medium" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span className="truncate">{s.text}</span>
            <span className="text-[8px] uppercase text-gray-300 flex-shrink-0 font-semibold tracking-wider">{s.category}</span>
          </button>
        </li>
      ))}
    </ul>
  );
};

export default InputAutocomplete;
