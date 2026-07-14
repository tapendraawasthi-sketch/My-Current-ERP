/**
 * Presentation helpers for session, device and access states.
 * Does not change authentication authority — display only.
 */
import React from "react";
import { Alert, Banner, Button, RecoveryPanel } from "@/design-system";
import { PreWorkspaceShell } from "./PreWorkspaceShell";
// RecoveryPanel: presentation only — does not alter auth authority.

export type AuthAccessReason =
  | "session-expired"
  | "signed-out"
  | "account-disabled"
  | "password-change-required"
  | "device-pending"
  | "device-not-authorised"
  | "company-access-revoked"
  | "no-company"
  | "permission-changed"
  | "fiscal-unavailable"
  | "setup-incomplete"
  | "maintenance"
  | "backend-unavailable"
  | "offline"
  | "local-session-available"
  | "reauthentication-required";

const COPY: Record<
  AuthAccessReason,
  { title: string; body: string; tone: "info" | "warning" | "danger" | "success" | "neutral" }
> = {
  "session-expired": {
    title: "Session expired",
    body: "Your session ended for security. Sign in again to continue. Unsent local work remains on this device according to existing sync rules.",
    tone: "warning",
  },
  "signed-out": {
    title: "Signed out",
    body: "You have been signed out of this company workspace.",
    tone: "info",
  },
  "account-disabled": {
    title: "Account unavailable",
    body: "This account cannot sign in. Contact your administrator.",
    tone: "danger",
  },
  "password-change-required": {
    title: "Password change required",
    body: "Your administrator requires a new password before you can continue.",
    tone: "warning",
  },
  "device-pending": {
    title: "Device registration pending",
    body: "This device is waiting for authorisation. Ask an administrator to approve it.",
    tone: "warning",
  },
  "device-not-authorised": {
    title: "Device not authorised",
    body: "This device is not authorised for company access. No client-side bypass is available.",
    tone: "danger",
  },
  "company-access-revoked": {
    title: "Company access removed",
    body: "You no longer have access to this company. Local records are not deleted. Return to the company list or contact an administrator.",
    tone: "danger",
  },
  "no-company": {
    title: "No company assigned",
    body: "No company is available for your account on this device.",
    tone: "warning",
  },
  "permission-changed": {
    title: "Permissions updated",
    body: "Your access changed. Privileged screens were closed. Continue from an allowed area.",
    tone: "warning",
  },
  "fiscal-unavailable": {
    title: "Fiscal year unavailable",
    body: "The selected fiscal context is not available. Choose another period or contact an administrator.",
    tone: "warning",
  },
  "setup-incomplete": {
    title: "Setup incomplete",
    body: "Required company setup is not finished. Continue setup before posting.",
    tone: "warning",
  },
  "maintenance": {
    title: "Maintenance",
    body: "The service is temporarily unavailable for maintenance. Try again later.",
    tone: "info",
  },
  "backend-unavailable": {
    title: "Service unavailable",
    body: "The remote service could not be reached. Local company data may still be available on this device.",
    tone: "warning",
  },
  offline: {
    title: "Offline",
    body: "Network appears unavailable. Sign-in uses the local company database when present. Full remote features remain limited.",
    tone: "warning",
  },
  "local-session-available": {
    title: "Local session available",
    body: "A previously authorised local session can continue on this device. Synchronization may be pending.",
    tone: "info",
  },
  "reauthentication-required": {
    title: "Sign in again",
    body: "Reauthentication is required before continuing.",
    tone: "warning",
  },
};

export function AuthAccessSurface({
  reason,
  onPrimary,
  primaryLabel = "Return to sign in",
  onSecondary,
  secondaryLabel,
}: {
  reason: AuthAccessReason;
  onPrimary: () => void;
  primaryLabel?: string;
  onSecondary?: () => void;
  secondaryLabel?: string;
}) {
  const copy = COPY[reason];
  return (
    <PreWorkspaceShell title={copy.title} showBrandPanel={false}>
      <div
        className="w-full max-w-lg space-y-3 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-raised)] p-6 shadow-[var(--ds-shadow-1)]"
        data-testid={`auth-access-${reason}`}
      >
        <RecoveryPanel
          title={copy.title}
          whatFailed={copy.body}
          whatRemains="Local records are retained according to existing architecture. No client-side bypass is offered."
          onRetry={onPrimary}
          onDismiss={onSecondary}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={onPrimary}>
            {primaryLabel}
          </Button>
          {onSecondary && secondaryLabel ? (
            <Button variant="secondary" onClick={onSecondary}>
              {secondaryLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </PreWorkspaceShell>
  );
}

export function SessionRestoringScreen() {
  return (
    <PreWorkspaceShell title="Restoring session" showBrandPanel={false}>
      <div
        className="w-full max-w-sm rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-raised)] p-6 text-center shadow-[var(--ds-shadow-1)]"
        data-testid="session-restoring"
        role="status"
        aria-live="polite"
      >
        <div
          className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[var(--ds-action-primary)] border-t-transparent"
          aria-hidden
        />
        <h2 className="text-[15px] font-semibold text-[var(--ds-text-strong)]">Restoring session</h2>
        <p className="mt-1 text-[13px] text-[var(--ds-text-muted)]">
          Checking company access and local continuity…
        </p>
      </div>
    </PreWorkspaceShell>
  );
}

export function CompanyOpeningPanel({
  companyName,
  stage,
}: {
  companyName: string;
  stage: "verifying" | "loading-settings" | "restoring-local" | "checking-sync" | "opening";
}) {
  const labels: Record<typeof stage, string> = {
    verifying: "Verifying access",
    "loading-settings": "Loading company settings",
    "restoring-local": "Restoring local data",
    "checking-sync": "Checking synchronization",
    opening: "Opening workspace",
  };
  return (
    <div
      className="mt-4 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-subtle)] p-4"
      data-testid="company-opening-panel"
      role="status"
      aria-live="polite"
    >
      <p className="text-[14px] font-semibold text-[var(--ds-text-strong)]">{companyName}</p>
      <p className="mt-1 text-[13px] text-[var(--ds-text-muted)]">{labels[stage]}…</p>
      <p className="mt-2 text-[12px] text-[var(--ds-text-subtle)]">
        Local workspace opening is not labelled as fully synchronized until sync authority confirms it.
      </p>
    </div>
  );
}

export function TrustSyncHint({
  lastSyncedAt,
  pending,
}: {
  lastSyncedAt?: string | null;
  pending?: boolean;
}) {
  if (!lastSyncedAt && pending == null) {
    return (
      <Banner
        tone="neutral"
        title="Synchronization"
        description="Synchronization status is shown after company open from the authoritative sync source."
        className="mb-3 rounded-[var(--ds-radius-md)] border"
      />
    );
  }
  return (
    <Alert tone={pending ? "warning" : "info"} title="Synchronization" className="mb-3">
      {pending
        ? "Pending local work may exist. Status is confirmed only from the sync authority after open."
        : lastSyncedAt
          ? `Last reported sync: ${lastSyncedAt}`
          : "No authoritative sync timestamp is available yet."}
    </Alert>
  );
}
