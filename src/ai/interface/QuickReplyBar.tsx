/** SUTRA AI — one-tap quick reply chips */

import React from "react";
import type { QuickReply } from "../types";

interface QuickReplyBarProps {
  replies: QuickReply[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}

const QuickReplyBar: React.FC<QuickReplyBarProps> = ({ replies, onSelect, disabled }) => {
  if (!replies.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2.5">
      {replies.map((r) => (
        <button
          key={r.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(r.value)}
          className={`h-7 px-3 text-[11px] font-medium rounded-lg border transition-all ${
            r.kind === "confirm"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
              : r.kind === "reject"
                ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
          } disabled:opacity-40`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
};

export default QuickReplyBar;
