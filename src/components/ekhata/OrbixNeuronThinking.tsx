import React from "react";
import { InlineLoading } from "@/design-system";

interface OrbixNeuronThinkingProps {
  label?: string;
  tools?: string[];
  intent?: string;
}

/** Calm thinking status — no model names, glow, or decorative pulse (IMPLEMENT_NOW §4.AI). */
const OrbixNeuronThinking: React.FC<OrbixNeuronThinkingProps> = ({ label }) => {
  return (
    <div
      className="flex items-center gap-2 px-1 py-2 text-[13px] text-[var(--ds-text-muted)]"
      role="status"
      aria-live="polite"
    >
      <InlineLoading label={label || "Orbix is working…"} />
    </div>
  );
};

export default OrbixNeuronThinking;
