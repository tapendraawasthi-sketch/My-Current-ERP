import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CloudOff,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import {
  onSyncStatusChange,
  retryFailedSync,
  syncNow,
  type SyncStatus,
} from "../../lib/syncEngine";
import { runEventSyncCycle } from "@/platform/sync/syncCoordinator";
import {
  getAggregatedSyncStatus,
  type AggregatedSyncStatus,
  type UiSyncState,
} from "@/platform/sync/syncStatusAggregate";

const SyncStatusControl: React.FC = () => {
  const [legacyStatus, setLegacyStatus] = useState<SyncStatus>("synced");
  const [agg, setAgg] = useState<AggregatedSyncStatus | null>(null);
  const [manualSyncing, setManualSyncing] = useState(false);
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  const refreshAgg = (legacy?: SyncStatus) => {
    void getAggregatedSyncStatus(online, legacy ?? legacyStatus).then(setAgg);
  };

  useEffect(() => {
    refreshAgg();
    return onSyncStatusChange((nextStatus) => {
      setLegacyStatus(nextStatus);
      refreshAgg(nextStatus);
      if (nextStatus !== "syncing") setManualSyncing(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshAgg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const busy = manualSyncing || agg?.state === "syncing";
  const effective: UiSyncState = agg?.state ?? (online ? "synced" : "offline");

  const metaMap: Record<
    UiSyncState,
    { label: string; icon: typeof CheckCircle2; className: string; detail: string }
  > = {
    synced: {
      label: "Synced",
      icon: CheckCircle2,
      className:
        "text-[var(--ds-status-success)] bg-[var(--ds-status-success-surface)] border-[color:rgba(5,150,105,0.25)]",
      detail: agg?.detail ?? "All local changes are synced.",
    },
    syncing: {
      label: "Syncing",
      icon: Loader2,
      className:
        "text-[var(--ds-status-warning)] bg-[var(--ds-status-warning-surface)] border-[color:rgba(217,119,6,0.25)]",
      detail: agg?.detail ?? "Synchronizing pending changes…",
    },
    pending: {
      label: agg && agg.pendingCount > 0 ? `${agg.pendingCount} pending` : "Pending changes",
      icon: RefreshCw,
      className:
        "text-[var(--ds-status-warning)] bg-[var(--ds-status-warning-surface)] border-[color:rgba(217,119,6,0.25)]",
      detail: agg?.detail ?? "Changes waiting to sync.",
    },
    failed: {
      label: "Sync failed",
      icon: AlertCircle,
      className:
        "text-[var(--ds-status-danger)] bg-[var(--ds-status-danger-surface)] border-[color:rgba(220,38,38,0.25)]",
      detail: agg?.detail ?? "Sync failed — local records are safe.",
    },
    retry_scheduled: {
      label: "Retry scheduled",
      icon: RefreshCw,
      className:
        "text-[var(--ds-status-warning)] bg-[var(--ds-status-warning-surface)] border-[color:rgba(217,119,6,0.25)]",
      detail: agg?.detail ?? "Retry scheduled — remote acknowledgement pending.",
    },
    stale: {
      label: "Possibly stale",
      icon: CloudOff,
      className:
        "text-[var(--ds-text-muted)] bg-[var(--ds-surface-muted)] border-[var(--ds-border-default)]",
      detail: agg?.detail ?? "Last remote acknowledgement is aged.",
    },
    conflict: {
      label: "Conflict detected",
      icon: ShieldAlert,
      className:
        "text-[var(--ds-status-danger)] bg-[var(--ds-status-danger-surface)] border-[color:rgba(220,38,38,0.25)]",
      detail: agg?.detail ?? "Conflict detected — review required.",
    },
    action_required: {
      label: "Action required",
      icon: ShieldAlert,
      className:
        "text-[var(--ds-status-danger)] bg-[var(--ds-status-danger-surface)] border-[color:rgba(220,38,38,0.25)]",
      detail: agg?.detail ?? "Dead-letter events require attention.",
    },
    offline: {
      label: "Offline",
      icon: CloudOff,
      className:
        "text-[var(--ds-text-muted)] bg-[var(--ds-surface-muted)] border-[var(--ds-border-default)]",
      detail: agg?.detail ?? "Offline — will sync later.",
    },
    local_only: {
      label: "Local-only",
      icon: CloudOff,
      className:
        "text-[var(--ds-text-muted)] bg-[var(--ds-surface-muted)] border-[var(--ds-border-default)]",
      detail: agg?.detail ?? "Local-only company.",
    },
  };

  const meta = metaMap[effective];
  const Icon = meta.icon;

  const handlePrimary = () => {
    if (!online) {
      setOpen((v) => !v);
      return;
    }
    if (effective === "failed" || effective === "action_required" || effective === "retry_scheduled") {
      void retryFailedSync();
      void runEventSyncCycle();
      return;
    }
    if (busy) return;
    setManualSyncing(true);
    void Promise.all([syncNow(), runEventSyncCycle()]).finally(() => {
      setManualSyncing(false);
      refreshAgg();
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="sync-status-control"
        data-sync-state={effective}
        onClick={() => {
          setOpen((v) => !v);
          refreshAgg();
        }}
        onDoubleClick={handlePrimary}
        className={`inline-flex h-8 items-center gap-1.5 rounded-[var(--ds-radius-md)] border px-2.5 text-[12px] font-medium transition-colors duration-150 ${meta.className}`}
        title={`${meta.detail} Click for details.`}
        aria-label={`Sync status: ${meta.label}`}
        aria-expanded={open}
      >
        <Icon className={`h-3.5 w-3.5 ${effective === "syncing" ? "animate-spin" : ""}`} />
        <span className="hidden sm:inline">{meta.label}</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close sync panel"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Sync details"
            data-testid="sync-status-panel"
            className="absolute right-0 top-full z-[var(--ds-z-dropdown)] mt-2 w-80 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-raised)] p-3 shadow-[var(--ds-shadow-2)]"
          >
            <div className="flex items-start gap-2">
              <Icon className={`mt-0.5 h-4 w-4 ${effective === "syncing" ? "animate-spin" : ""}`} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[var(--ds-text-default)]">{meta.label}</p>
                <p className="mt-0.5 text-[12px] text-[var(--ds-text-muted)]">{meta.detail}</p>
                <div className="mt-2 space-y-0.5 text-[12px] text-[var(--ds-text-subtle)]">
                  <p>Connection: {online ? "Online" : "Offline"}</p>
                  <p>
                    Device: {agg?.deviceIdShort ?? agg?.deviceId?.slice(0, 8) ?? "—"}
                    {agg?.registrationStatus ? ` · ${agg.registrationStatus}` : ""}
                  </p>
                  <p>
                    Pending {agg?.pendingCount ?? 0} · In-flight {agg?.syncingCount ?? 0} · Failed{" "}
                    {agg?.failedCount ?? 0}
                  </p>
                  <p>
                    Conflicts {agg?.conflictCount ?? 0} · Dead letter {agg?.deadLetterCount ?? 0}
                  </p>
                  {agg?.lastSuccessfulSync ? (
                    <p>Last sync: {new Date(agg.lastSuccessfulSync).toLocaleString()}</p>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={!online || busy || effective === "local_only"}
                onClick={() => {
                  handlePrimary();
                  setOpen(false);
                }}
                className="h-8 flex-1 rounded-[var(--ds-radius-md)] bg-[var(--ds-action-primary)] px-3 text-[12px] font-medium text-white hover:bg-[var(--ds-action-primary-hover)] disabled:opacity-50"
              >
                {effective === "failed" || effective === "action_required"
                  ? "Retry sync"
                  : "Sync now"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-3 text-[12px] font-medium text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-muted)]"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SyncStatusControl;
