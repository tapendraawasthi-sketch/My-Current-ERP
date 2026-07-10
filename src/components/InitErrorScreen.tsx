import React from "react";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { useStore } from "../store/useStore";

const primaryBtn =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md inline-flex items-center justify-center gap-1.5 disabled:opacity-50";
const outlineBtn =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center justify-center gap-1.5 disabled:opacity-50";
const dangerBtn =
  "h-8 px-3 bg-red-600 hover:bg-red-700 text-white text-[12px] font-medium rounded-md inline-flex items-center justify-center gap-1.5 disabled:opacity-50";

export default function InitErrorScreen() {
  const { initError, isInitializing, retryInitializeApp, clearDatabaseAndRetryInit } = useStore();

  const message =
    initError?.message ||
    "The application could not initialize its local database. Financial data may be unavailable until this is resolved.";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "#f5f6fa" }}
    >
      <div className="bg-white border border-gray-200 rounded-md shadow-sm max-w-lg w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="mt-0.5 text-red-600">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Unable to start Sutra ERP</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Database initialization failed. Posting and reports are disabled until recovery
              succeeds.
            </p>
          </div>
        </div>

        <div className="bg-red-50 text-red-700 border border-red-200 rounded-md px-3 py-2 text-[12px] mb-4">
          {message}
        </div>

        {initError?.code ? (
          <p className="text-[10px] text-gray-500 mb-4 font-mono">Code: {initError.code}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={primaryBtn}
            disabled={isInitializing}
            onClick={() => void retryInitializeApp()}
          >
            <RefreshCw size={14} className={isInitializing ? "animate-spin" : ""} />
            {isInitializing ? "Retrying…" : "Retry initialization"}
          </button>
          <button
            type="button"
            className={dangerBtn}
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
            <Trash2 size={14} />
            Clear local data &amp; retry
          </button>
          <button
            type="button"
            className={outlineBtn}
            disabled={isInitializing}
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>

        <p className="text-[11px] text-gray-500 mt-4">
          If the problem persists, restore from Backup &amp; Restore or contact support with the
          error code above.
        </p>
      </div>
    </div>
  );
}
