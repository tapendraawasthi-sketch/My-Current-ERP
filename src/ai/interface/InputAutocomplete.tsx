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
    <ul className="absolute left-0 right-0 bottom-full mb-1 z-10 bg-white border border-gray-200 rounded-md shadow-lg max-h-36 overflow-y-auto">
      {suggestions.map((s, i) => (
        <li key={s.text}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(s.text);
            }}
            className={`w-full text-left px-2.5 py-1.5 text-[11px] flex items-center justify-between gap-2 ${
              i === activeIndex ? "bg-[#eef2ff] text-[var(--ds-action-primary)]" : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span className="truncate">{s.text}</span>
            <span className="text-[9px] uppercase text-gray-400 flex-shrink-0">{s.category}</span>
          </button>
        </li>
      ))}
    </ul>
  );
};

export default InputAutocomplete;
