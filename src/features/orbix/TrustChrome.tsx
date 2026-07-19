/**
 * Phase UI-6 — trust / heading chrome for structured Orbix responses.
 * Labels only; does not invent accounting facts.
 */
import React from "react";
import { getPresentationMeta, type OrbixTrustLabel } from "./presentation";
import type { OrbixResponse } from "@/lib/ekhata/orbixResponseTypes";

const TRUST_COPY: Record<OrbixTrustLabel, string> = {
  explanation: "Explanation — no posting",
  clarification: "Clarification — nothing posted",
  preview: "Confirm preview — domain engine posts on confirm",
  posted_local: "Posted locally",
  pending_sync: "Posted locally · waiting to sync",
  synced: "Posted and synced",
  conflict: "Conflict — review required",
  failed: "Failed — no new posting",
  restricted: "Restricted — no posting",
  unavailable: "Unavailable — ERP remains usable",
};

/** Left accent: visual trust state without inventing money/sync facts. */
const TRUST_ACCENT: Record<OrbixTrustLabel, string> = {
  explanation: "border-l-[var(--ds-intelligence)]",
  clarification: "border-l-[var(--ds-status-info)]",
  preview: "border-l-[var(--ds-action-primary)]",
  posted_local: "border-l-[var(--ds-status-success)]",
  pending_sync: "border-l-[var(--ds-status-warning)]",
  synced: "border-l-[var(--ds-status-success)]",
  conflict: "border-l-[var(--ds-status-danger)]",
  failed: "border-l-[var(--ds-status-danger)]",
  restricted: "border-l-[var(--ds-status-neutral)]",
  unavailable: "border-l-[var(--ds-status-warning)]",
};

export function TrustChrome({
  response,
  children,
}: {
  response: OrbixResponse;
  children: React.ReactNode;
}) {
  const meta = getPresentationMeta(response);
  return (
    <section
      className={`rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] border-l-4 bg-[var(--ds-surface)] ${TRUST_ACCENT[meta.trust]}`}
      data-testid={`orbix-presentation-${meta.responseType}`}
      data-trust={meta.trust}
      data-allows-confirm={meta.allowsConfirm ? "true" : "false"}
      aria-labelledby={`orbix-heading-${response.response_type}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ds-border-default)] px-3.5 py-2">
        <h2
          id={`orbix-heading-${response.response_type}`}
          className="text-[13px] font-semibold text-[var(--ds-text-default)]"
        >
          {meta.heading}
        </h2>
        <span
          className="text-[12px] text-[var(--ds-text-muted)]"
          data-testid="orbix-trust-label"
        >
          {TRUST_COPY[meta.trust]}
        </span>
      </header>
      <div className="px-3.5 py-3">{children}</div>
    </section>
  );
}
