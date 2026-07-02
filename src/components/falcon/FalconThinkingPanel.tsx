import React, { useState } from 'react';
import { Brain, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

export interface FalconThinkingPanelProps {
  steps: Array<{
    stepNumber: number;
    title: string;
    thinking: string;
    conclusion: string;
  }>;
  category?: string;
  isLive?: boolean;
  defaultExpanded?: boolean;
}

const getCategoryBadge = (category?: string) => {
  switch (category) {
    case 'erp-how-to':
    case 'erp-troubleshoot':
      return { text: "ERP Assistant Mode", color: "bg-blue-100 text-blue-700 border-blue-200" };
    case 'accounting-concept':
    case 'erp-explain':
      return { text: "Finance Expert Mode", color: "bg-green-100 text-green-700 border-green-200" };
    case 'web-search-needed':
    case 'current-events':
      return { text: "Web Search Mode", color: "bg-orange-100 text-orange-700 border-orange-200" };
    case 'math-calculation':
      return { text: "Calculator Mode", color: "bg-teal-100 text-teal-700 border-teal-200" };
    default:
      return { text: "General Knowledge Mode", color: "bg-purple-100 text-purple-700 border-purple-200" };
  }
};

export const FalconThinkingPanel: React.FC<FalconThinkingPanelProps> = ({
  steps,
  category,
  isLive = false,
  defaultExpanded = false
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!steps || steps.length === 0) return null;

  const badge = getCategoryBadge(category);

  return (
    <div className="mt-2 mb-2 w-full font-sans">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-gray-700 transition-colors"
      >
        <Brain size={12} className={isLive ? "animate-pulse text-blue-500" : ""} />
        <span>{expanded ? 'Hide reasoning' : `View reasoning (${steps.length} steps)`}</span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 overflow-hidden transition-all duration-300">
          {category && (
            <div className={`inline-block px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded border ${badge.color}`}>
              {badge.text}
            </div>
          )}
          
          <div className="space-y-2">
            {steps.map((step, index) => {
              const isCurrentLive = isLive && index === steps.length - 1;
              return (
                <div key={index} className="bg-gray-50 border border-gray-100 rounded-md p-2 text-[11px]">
                  <div className="flex items-center gap-1.5 font-medium text-gray-700 mb-1 border-b border-gray-200 pb-1">
                    <span>Step {step.stepNumber} &middot; {step.title}</span>
                    {isCurrentLive && <Loader2 size={10} className="animate-spin text-blue-500 ml-auto" />}
                  </div>
                  <div className="text-gray-500 italic mb-1.5 flex gap-1.5">
                    <span className="opacity-50">💭</span>
                    <span>{step.thinking}</span>
                  </div>
                  <div className="text-gray-800 flex gap-1.5">
                    <span className="text-green-600 opacity-80">✓</span>
                    <span>{step.conclusion}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
