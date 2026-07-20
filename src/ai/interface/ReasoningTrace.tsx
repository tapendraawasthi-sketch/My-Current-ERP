/** SUTRA AI — expandable reasoning trace UI (Sprint 5) */

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";
import type { ReasoningStep } from "../types";

interface ReasoningTraceProps {
  steps: ReasoningStep[];
  confidence?: number;
}

function stepAccent(name: string): string {
  if (/ERP|HANDLER/i.test(name)) return "text-[var(--ds-action-primary)]";
  if (/LLM/i.test(name)) return "text-[#0284c7]";
  if (/GUARD/i.test(name)) return "text-[#d97706]";
  if (/CONFIDENCE/i.test(name)) return "text-[#059669]";
  return "text-gray-500";
}

const ReasoningTrace: React.FC<ReasoningTraceProps> = ({ steps, confidence }) => {
  const [open, setOpen] = useState(false);

  if (!steps.length) return null;

  return (
    <div className="mb-2 rounded-lg border border-gray-100 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50/80 hover:bg-gray-100 text-left transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-gray-500 flex-shrink-0" />
        )}
        <Brain className="h-3 w-3 text-[var(--ds-action-primary)] flex-shrink-0" />
        <span className="text-[10px] font-medium text-gray-500">
          Reasoning ({steps.length} steps
          {confidence !== undefined ? ` · ${Math.round(confidence * 100)}%` : ""})
        </span>
      </button>

      {open && (
        <div className="px-3 py-2.5 space-y-2 max-h-48 overflow-y-auto">
          {steps.map((s) => (
            <div key={s.step} className="text-[10px]">
              <p className={`text-[9px] font-bold uppercase tracking-wider ${stepAccent(s.name)}`}>
                {s.step}. {s.name}
              </p>
              <p className="text-gray-500 mt-0.5 leading-snug">{s.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReasoningTrace;
