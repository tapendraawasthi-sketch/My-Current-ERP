import React from "react";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { useStore } from "../store/useStore";
import { Button, Alert } from "@/design-system";
import { PreWorkspaceShell } from "./auth/PreWorkspaceShell";

export default function InitErrorScreen() {
  const { initError, isInitializing, retryInitializeApp, clearDatabaseAndRetryInit } = useStore();

  const message =
    initError?.message ||
    "The application could not initialize its local database. Financial data may be unavailable until this is resolved.";

  return (
    <PreWorkspaceShell title="Unable to start" showBrandPanel={false}>
      <div
        className="w-full max-w-lg rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-raised)] p-6 shadow-[var(--ds-shadow-1)]"
        data-testid="init-error-screen"
      >
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--ds-status-danger)]" aria-hidden />
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--ds-text-strong)]">Unable to start Orbix ERP</h2>
            <p className="mt-0.5 text-[13px] text-[var(--ds-text-muted)]">
              Local database initialization failed. Posting and reports stay unavailable until recovery succeeds.
            </p>
          </div>
        </div>

        <Alert tone="danger" title="Initialization failed" className="mb-4">
          {message}
        </Alert>

        {initError?.code ? (
          <p className="mb-4 font-mono text-[12px] text-[var(--ds-text-muted)]">Reference: {initError.code}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            disabled={isInitializing}
            loading={isInitializing}
            onClick={() => void retryInitializeApp()}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            {isInitializing ? "Retrying…" : "Retry initialization"}
          </Button>
          <Button
            variant="destructive"
            disabled={isInitializing}
            onClick={() => {
              if (
                window.confirm(
                  "This will delete all local ERP data on this device and recreate an empty database. Continue?",
                )
              ) {
                void clearDatabaseAndRetryInit();
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Clear local data & retry
          </Button>
          <Button variant="secondary" disabled={isInitializing} onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      </div>
    </PreWorkspaceShell>
  );
}
