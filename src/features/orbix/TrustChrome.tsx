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
  preview: "Authoritative preview — confirm to post",
  posted_local: "Posted locally",
  pending_sync: "Posted locally · waiting to sync",
  synced: "Posted and synced",
  conflict: "Conflict — review required",
  failed: "Failed — no new posting",
  restricted: "Restricted — no posting",
  unavailable: "Unavailable — ERP remains usable",
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
      className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)]"
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
