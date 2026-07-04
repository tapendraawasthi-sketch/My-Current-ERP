import React, { useEffect, useState } from "react";
import {
  getPendingSyncCount,
  onSyncStatusChange,
  retryFailedSync,
  syncNow,
  type SyncStatus,
} from "../lib/syncEngine";

const SyncStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<SyncStatus>("synced");
  const [pendingCount, setPendingCount] = useState(0);
  const [manualSyncing, setManualSyncing] = useState(false);

  useEffect(() => {
    void getPendingSyncCount().then(setPendingCount);
    return onSyncStatusChange((nextStatus, pending) => {
      setStatus(nextStatus);
      setPendingCount(pending);
      if (nextStatus !== "syncing") setManualSyncing(false);
    });
  }, []);

  const label = manualSyncing
    ? "Syncing..."
    : status === "synced"
      ? "All changes synced"
      : status === "syncing"
        ? "Syncing..."
        : status === "error"
          ? "Sync error - click to retry"
          : `${pendingCount} change${pendingCount === 1 ? "" : "s"} pending — click to sync`;

  const colorClass =
    status === "error"
      ? "text-red-600 cursor-pointer hover:underline"
      : status === "pending" || status === "syncing" || manualSyncing
        ? "text-amber-600 cursor-pointer hover:underline"
        : "text-[11px] text-gray-500 cursor-pointer hover:text-gray-700";

  const handleClick = () => {
    if (status === "error") {
      void retryFailedSync();
      return;
    }
    if (manualSyncing || status === "syncing") return;
    setManualSyncing(true);
    void syncNow().finally(() => setManualSyncing(false));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`text-[11px] font-medium whitespace-nowrap ${colorClass}`}
      title={label}
    >
      {label}
    </button>
  );
};

export default SyncStatusIndicator;
