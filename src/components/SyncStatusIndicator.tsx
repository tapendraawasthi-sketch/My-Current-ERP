import React, { useEffect, useState } from "react";
import {
  getPendingSyncCount,
  onSyncStatusChange,
  retryFailedSync,
  type SyncStatus,
} from "../lib/syncEngine";

const SyncStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<SyncStatus>("synced");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    void getPendingSyncCount().then(setPendingCount);
    return onSyncStatusChange((nextStatus, pending) => {
      setStatus(nextStatus);
      setPendingCount(pending);
    });
  }, []);

  const label =
    status === "synced"
      ? "All changes synced"
      : status === "syncing"
        ? "Syncing..."
        : status === "error"
          ? "Sync error - click to retry"
          : `${pendingCount} change${pendingCount === 1 ? "" : "s"} pending`;

  const colorClass =
    status === "error"
      ? "text-red-600 cursor-pointer hover:underline"
      : status === "pending"
        ? "text-amber-600"
        : status === "syncing"
          ? "text-amber-600"
          : "text-[11px] text-gray-500";

  const handleClick = () => {
    if (status === "error") {
      void retryFailedSync();
    }
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
