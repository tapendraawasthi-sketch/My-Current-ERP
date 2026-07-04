// src/components/falcon/FalconThinkingPanel.tsx
// Falcon AI — Reasoning Steps Visualization Panel
// Polished timeline UI with phase icons and staggered animation.

import React, { useState, useEffect, memo } from "react";
import {
  Brain,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
  BookOpen,
  PenLine,
  CheckCircle,
  Lightbulb,
  Globe,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface StepData {
  stepNumber: number;
  phase?: "analyze" | "retrieve" | "construct" | "verify" | "suggest";
  title: string;
  thinking: string;
  conclusion: string;
  duration?: number;
}

export interface FalconThinkingPanelProps {
  steps: StepData[];
  domain?: string;
  category?: string; // backward-compat alias for domain
  isLive?: boolean;
  defaultExpanded?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Determine the phase icon + colors from phase field or title heuristic. */
function resolveStepIcon(step: StepData): {
  Icon: React.ComponentType<{ className?: string }>;
  circleCls: string;
  iconCls: string;
} {
  // Phase → icon map
  if (step.phase) {
    const map: Record<
      NonNullable<StepData["phase"]>,
      { Icon: React.ComponentType<any>; circleCls: string; iconCls: string }
    > = {
      analyze: { Icon: Search, circleCls: "bg-blue-100 border-blue-300", iconCls: "text-blue-600" },
      retrieve: {
        Icon: BookOpen,
        circleCls: "bg-green-100 border-green-300",
        iconCls: "text-green-600",
      },
      construct: {
        Icon: PenLine,
        circleCls: "bg-orange-100 border-orange-300",
        iconCls: "text-orange-600",
      },
      verify: {
        Icon: CheckCircle,
        circleCls: "bg-purple-100 border-purple-300",
        iconCls: "text-purple-600",
      },
      suggest: {
        Icon: Lightbulb,
        circleCls: "bg-yellow-100 border-yellow-300",
        iconCls: "text-yellow-600",
      },
    };
    return map[step.phase];
  }

  // Title-based fallback
  const t = step.title.toLowerCase();
  if (t.includes("search") || t.includes("web"))
    return { Icon: Globe, circleCls: "bg-teal-100 border-teal-300", iconCls: "text-teal-600" };
  if (t.includes("analyz"))
    return { Icon: Search, circleCls: "bg-blue-100 border-blue-300", iconCls: "text-blue-600" };
  if (t.includes("retriev") || t.includes("knowledge"))
    return {
      Icon: BookOpen,
      circleCls: "bg-green-100 border-green-300",
      iconCls: "text-green-600",
    };
  if (t.includes("construct") || t.includes("building") || t.includes("response"))
    return {
      Icon: PenLine,
      circleCls: "bg-orange-100 border-orange-300",
      iconCls: "text-orange-600",
    };
  if (t.includes("verify") || t.includes("check") || t.includes("accur"))
    return {
      Icon: CheckCircle,
      circleCls: "bg-purple-100 border-purple-300",
      iconCls: "text-purple-600",
    };
  if (t.includes("suggest") || t.includes("follow"))
    return {
      Icon: Lightbulb,
      circleCls: "bg-yellow-100 border-yellow-300",
      iconCls: "text-yellow-600",
    };

  return { Icon: Brain, circleCls: "bg-gray-100 border-gray-300", iconCls: "text-gray-500" };
}

/** Map domain or category string to a badge. */
function resolveDomainBadge(domain?: string, category?: string): { text: string; cls: string } {
  const key = (domain || category || "general").toLowerCase();
  if (key.includes("erp"))
    return { text: "🏢 ERP Expert Mode", cls: "bg-blue-50 text-blue-700 border-blue-200" };
  if (key.includes("account") || key.includes("financ") || key.includes("explain"))
    return { text: "📊 Finance Mode", cls: "bg-green-50 text-green-700 border-green-200" };
  if (key.includes("web") || key.includes("search") || key.includes("event"))
    return { text: "🌐 Web Search Mode", cls: "bg-orange-50 text-orange-700 border-orange-200" };
  if (key.includes("math") || key.includes("calc"))
    return { text: "🧮 Calculator Mode", cls: "bg-teal-50 text-teal-700 border-teal-200" };
  if (key.includes("code") || key.includes("program"))
    return { text: "💻 Code Mode", cls: "bg-violet-50 text-violet-700 border-violet-200" };
  return { text: "💡 General Knowledge", cls: "bg-purple-50 text-purple-700 border-purple-200" };
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP CARD
// ─────────────────────────────────────────────────────────────────────────────

const StepCard = memo(
  ({
    step,
    index,
    isLastLive,
    isLive,
  }: {
    step: StepData;
    index: number;
    isLastLive: boolean;
    isLive: boolean;
  }) => {
    const { Icon, circleCls, iconCls } = resolveStepIcon(step);
    const liveStep = isLive && isLastLive;

    return (
      <div
        className="flex gap-2.5 opacity-0 animate-fadeIn"
        style={{
          animationDelay: `${index * 100}ms`,
          animationFillMode: "forwards",
        }}
      >
        {/* Timeline node */}
        <div className="flex flex-col items-center flex-shrink-0">
          <div
            className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 z-10 ${circleCls}`}
          >
            {liveStep ? (
              <Loader2 className={`h-2.5 w-2.5 animate-spin ${iconCls}`} />
            ) : (
              <Icon className={`h-2.5 w-2.5 ${iconCls}`} />
            )}
          </div>
          {/* Vertical line (except after last) */}
          <div className="w-px flex-1 bg-gray-200 mt-0.5" />
        </div>

        {/* Content card */}
        <div className="flex-1 mb-3 min-w-0">
          <div
            className={`rounded-lg border p-2.5 text-[11px] shadow-sm ${
              liveStep ? "border-blue-200 bg-blue-50/50" : "border-gray-200 bg-white"
            }`}
          >
            {/* Card header */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-semibold text-gray-700 text-[11px] leading-tight">
                Step {step.stepNumber} · {step.title}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {liveStep && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                )}
                {step.duration && !liveStep && (
                  <span className="text-[10px] text-gray-400">~${step.duration}ms</span>
                )}
              </div>
            </div>

            {/* Thinking */}
            {step.thinking && (
              <div className="text-[11px] text-gray-500 italic leading-relaxed mb-1.5 whitespace-pre-line">
                <span className="not-italic mr-1">💭</span>
                {step.thinking}
              </div>
            )}

            {/* Conclusion */}
            {step.conclusion && !liveStep && (
              <div className="text-[11px] text-gray-700 leading-relaxed flex gap-1 items-start">
                <span className="text-green-500 font-bold flex-shrink-0">✓</span>
                <span>{step.conclusion}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);
StepCard.displayName = "StepCard";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const FalconThinkingPanel: React.FC<FalconThinkingPanelProps> = ({
  steps,
  domain,
  category,
  isLive = false,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Auto-expand when live mode activates or defaultExpanded flips
  useEffect(() => {
    if (isLive || defaultExpanded) setExpanded(true);
  }, [isLive, defaultExpanded]);

  if (!steps || steps.length === 0) return null;

  const badge = resolveDomainBadge(domain, category);
  const completedCount = isLive ? Math.max(0, steps.length - 1) : steps.length;

  return (
    <div className="w-full rounded-lg border border-gray-200 bg-gray-50/80 overflow-hidden text-[11px]">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {/* Live pulsing brain or static brain */}
          {isLive ? (
            <Brain className="h-3.5 w-3.5 text-blue-500 animate-pulse flex-shrink-0" />
          ) : (
            <Brain className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          )}
          <span className="text-[11px] font-semibold text-gray-600">
            {expanded
              ? "Hide reasoning"
              : `▶ View reasoning (${steps.length} step${steps.length !== 1 ? "s" : ""})`}
          </span>
          {/* Progress indicator */}
          {isLive && (
            <span className="text-[10px] text-blue-500">
              {completedCount}/{steps.length} steps
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Domain badge (collapsed) */}
          {!expanded && (
            <span className={`px-1.5 py-0.5 rounded border text-[10px] ${badge.cls}`}>
              {badge.text}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-3 w-3 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="h-3 w-3 text-gray-400 flex-shrink-0" />
          )}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-3 pt-2 pb-1 border-t border-gray-200">
          {/* Domain badge (expanded) */}
          <div className="mb-2">
            <span className={`px-2 py-0.5 rounded border text-[10px] ${badge.cls}`}>
              {badge.text}
            </span>
          </div>

          {/* Step timeline */}
          <div className="relative">
            {steps.map((step, i) => (
              <StepCard
                key={step.stepNumber ?? i}
                step={step}
                index={i}
                isLastLive={isLive && i === steps.length - 1}
                isLive={isLive}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FalconThinkingPanel;
