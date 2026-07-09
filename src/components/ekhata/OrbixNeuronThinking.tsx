import React from "react";
import OrbixLogo from "./OrbixLogo";

interface OrbixNeuronThinkingProps {
  label?: string;
  tools?: string[];
  intent?: string;
}

const INTENT_LABELS: Record<string, { label: string; sub: string }> = {
  chitchat: { label: "Quick reply", sub: "Casual chat · qwen3:4b fast path" },
  general_qa: { label: "Thinking", sub: "General knowledge · qwen3:32b" },
  accounting_qa: { label: "Nepal tax lookup", sub: "RAG knowledge → qwen3:32b" },
  erp_howto: { label: "ERP navigation", sub: "Searching menus & screens" },
  khata_entry: { label: "Khata entry", sub: "Parsing transaction · validating Dr/Cr" },
  code_qa: { label: "Code search", sub: "Scanning source files" },
  cached: { label: "Instant recall", sub: "Cached answer" },
};

const OrbixNeuronThinking: React.FC<OrbixNeuronThinkingProps> = ({
  label,
  tools = [],
  intent,
}) => {
  const intentKey = intent || tools[0] || "";
  const mapped = INTENT_LABELS[intentKey];
  const displayLabel = label || mapped?.label || "Connecting Neurons";
  const subLabel = mapped?.sub || "Accounting Mode · Analyzing ledger data";

  return (
  <div className="flex items-start gap-2.5 px-1 py-1">
    <div className="relative mt-0.5 flex-shrink-0">
      <div className="absolute inset-0 rounded-full bg-cyan-500/30 blur-md animate-pulse" />
      <div className="relative h-8 w-8 flex items-center justify-center">
        <OrbixLogo size={28} variant="full" className="animate-[spin_8s_linear_infinite]" />
      </div>
      {/* Synaptic pulse rings */}
      <span className="absolute inset-0 rounded-full border border-cyan-400/40 animate-ping opacity-30" />
    </div>

    <div className="flex-1 min-w-0 rounded-xl rounded-tl-sm border border-cyan-500/20 bg-gradient-to-br from-cyan-500/8 to-violet-500/8 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-medium text-cyan-300">{displayLabel}</p>
        <div className="flex gap-0.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="h-1 w-1 rounded-full bg-orange-400"
              style={{
                animation: "pulse 1.2s ease-in-out infinite",
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Connection lines animation */}
      <div className="mt-2 flex items-center gap-1 h-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <React.Fragment key={i}>
            <span
              className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-cyan-400 to-violet-400 flex-shrink-0"
              style={{
                animation: "pulse 1.5s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`,
                opacity: 0.4 + (i % 3) * 0.2,
              }}
            />
            {i < 4 && (
              <span
                className="flex-1 h-px bg-gradient-to-r from-cyan-500/50 to-violet-500/30 min-w-[8px]"
                style={{
                  animation: "pulse 2s ease-in-out infinite",
                  animationDelay: `${i * 0.25}s`,
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      <p className="mt-1.5 text-[10px] text-slate-500">{subLabel}</p>

      {tools.length > 0 && (
        <p className="mt-1 text-[9px] text-slate-600 truncate">Tools: {tools.join(" · ")}</p>
      )}
    </div>
  </div>
  );
};

export default OrbixNeuronThinking;
