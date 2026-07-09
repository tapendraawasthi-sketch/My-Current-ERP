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
    <div className="flex flex-wrap gap-1.5 mt-2">
      {replies.map((r) => (
        <button
          key={r.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(r.value)}
          className={`h-7 px-2.5 text-[11px] font-medium rounded-md border ${
            r.kind === "confirm"
              ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
              : r.kind === "reject"
                ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          } disabled:opacity-50`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
};

export default QuickReplyBar;
