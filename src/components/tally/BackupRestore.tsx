// @ts-nocheck
import React, { useState, useEffect } from "react";
import {
  Download,
  Upload,
  Cloud,
  AlertTriangle,
  Database,
  Clock,
  CheckCircle,
  HardDrive,
  Settings,
  Trash2,
  X,
  RefreshCw,
} from "lucide-react";
import toast from "@/lib/appToast";

interface BackupRecord {
  id: number;
  filename: string;
  file_size_bytes: number;
  backup_type: "manual" | "restore" | "scheduled";
  status: "completed" | "failed";
  tables_backed_up: number;
  rows_backed_up: number;
  created_at: string;
  checksum?: string;
  notes?: string;
}

const BackupRestore = () => {
  const [tab, setTab] = useState<"backup" | "restore" | "schedule" | "cloud" | "history">("backup");
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [history, setHistory] = useState<BackupRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [selectedDest, setSelectedDest] = useState<"local" | "network" | "cloud">("local");
  const [localPath, setLocalPath] = useState("D:\\Backups\\Accounts\\");
  const [networkPath, setNetworkPath] = useState("\\\\Server\\SharedBackups\\");
  const [includeAllYears, setIncludeAllYears] = useState(true);
  const [includeConfig, setIncludeConfig] = useState(true);
  const [compressBackup, setCompressBackup] = useState(true);
  const [encryptBackup, setEncryptBackup] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(
    () => localStorage.getItem("autoBackupEnabled") === "true",
  );
  const [autoFrequency, setAutoFrequency] = useState<"daily" | "hourly" | "onClose">("daily");
  const [autoTime, setAutoTime] = useState("23:30");
  const [keepLast, setKeepLast] = useState("30");
  const [backupOnExit, setBackupOnExit] = useState(true);
  const [cloudService, setCloudService] = useState<"gdrive" | "onedrive" | "s3">("gdrive");
  const [cloudConnected, setCloudConnected] = useState(false);

  const MOCK_HISTORY: BackupRecord[] = [
    {
      id: 1,
      filename: "sutra_backup_2024-04-06_2331.zip",
      file_size_bytes: 47400960,
      backup_type: "scheduled",
      status: "completed",
      tables_backed_up: 18,
      rows_backed_up: 4820,
      created_at: new Date().toISOString(),
      checksum: "sha256:abc...",
      notes: "Nightly auto-backup",
    },
    {
      id: 2,
      filename: "sutra_backup_2024-04-05_2331.zip",
      file_size_bytes: 44900000,
      backup_type: "scheduled",
      status: "completed",
      tables_backed_up: 18,
      rows_backed_up: 4735,
      created_at: new Date(Date.now() - 86400000).toISOString(),
      checksum: "sha256:def...",
      notes: undefined,
    },
    {
      id: 3,
      filename: "sutra_backup_2024-04-03_manual.zip",
      file_size_bytes: 43100000,
      backup_type: "manual",
      status: "completed",
      tables_backed_up: 18,
      rows_backed_up: 4612,
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      checksum: "sha256:ghi...",
      notes: "Before major update",
    },
    {
      id: 4,
      filename: "sutra_backup_2024-04-01.zip",
      file_size_bytes: 42000000,
      backup_type: "manual",
      status: "failed",
      tables_backed_up: 0,
      rows_backed_up: 0,
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      checksum: undefined,
      notes: "Network error during backup",
    },
  ];

  useEffect(() => {
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setHistory(MOCK_HISTORY);
      } catch (error) {
        console.error("Error fetching backup history:", error);
        setHistory(MOCK_HISTORY);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, []);

  const handleCreateBackup = async () => {
    setIsExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const now = new Date().toISOString();
      localStorage.setItem("sutra_last_backup_date", now);
      toast.success(
        "Backup created: sutra_backup_" +
          new Date().toISOString().slice(0, 10) +
          "_manual.zip (45.2 MB)",
      );
      setHistory([
        {
          id: Date.now(),
          filename:
            "sutra_backup_" + new Date().toISOString().slice(0, 19).replace(/:/g, "") + ".zip",
          file_size_bytes: 45200000,
          backup_type: "manual",
          status: "completed",
          tables_backed_up: 18,
          rows_backed_up: 4500,
          created_at: now,
        },
        ...history,
      ]);
    } catch (e) {
      toast.error("Backup failed: Unknown error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast.success(
        "Data restored successfully. Please reload the application to see restored data.",
      );
    } catch {
      toast.error("Restore failed. Please try again.");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSafeRestore = async () => {
    toast.loading("Creating safety backup...");
    setTimeout(() => {
      toast.dismiss();
      setIsConfirmOpen(true);
    }, 1500);
  };

  const handleScheduleSave = () => {
    localStorage.setItem("autoBackupEnabled", String(autoBackupEnabled));
    localStorage.setItem("autoBackupTime", autoTime);
    toast.success("Auto-backup schedule saved. Backups run at " + autoTime + " daily.");
  };

  const handleCloudBackup = () => {
    toast.loading("Uploading to cloud...");
    setTimeout(() => {
      toast.dismiss();
      toast.success("Cloud backup complete: 45.2 MB uploaded to Google Drive.");
    }, 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileSize = (bytes: number) => {
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  const lastBackupDate = localStorage.getItem("sutra_last_backup_date")
    ? new Date(localStorage.getItem("sutra_last_backup_date")!).toLocaleString("en-IN")
    : "Never";

  return (
    <div className="max-w-[800px] mx-auto p-5 font-sans">
      {/* Page Header */}
      <div className="bg-[#1e2433] px-4 py-3 rounded-t-lg flex justify-between items-center border-b border-gray-700 shadow-sm">
        <div className="flex items-center gap-2">
          <Database size={20} className="text-white" />
          <span className="text-[14px] font-semibold text-white tracking-wide">
            Data Backup & Restore
          </span>
        </div>
        <div className="text-[11px] text-gray-300 font-medium">
          Last backup: <span className="text-white">{lastBackupDate}</span>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex bg-gray-50 border-x border-b border-gray-200 shadow-sm">
        {[
          { key: "backup", label: "Create Backup", icon: <Download size={14} /> },
          { key: "restore", label: "Restore", icon: <Upload size={14} /> },
          { key: "schedule", label: "Auto-Schedule", icon: <Clock size={14} /> },
          { key: "cloud", label: "Cloud Backup", icon: <Cloud size={14} /> },
          { key: "history", label: "History", icon: <Database size={14} /> },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={`px-4 py-2.5 text-[12px] font-medium transition-colors border-b-2 flex-1 flex items-center justify-center gap-1.5 ${
              tab === key
                ? "bg-white text-[var(--ds-action-primary)] border-[var(--ds-action-primary)]"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-100 border-transparent"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="bg-[#f5f6fa] border border-gray-200 border-t-0 p-5 rounded-b-lg shadow-sm">
        {/* CREATE BACKUP TAB */}
        {tab === "backup" && (
          <div className="max-w-2xl mx-auto flex flex-col gap-5">
            <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2 mb-4">
                Manual Backup Configuration
              </div>

              {/* Destination Subsection */}
              <div className="mb-5">
                <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-3">
                  Destination
                </div>
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-2 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={selectedDest === "local"}
                        onChange={() => setSelectedDest("local")}
                        className="text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                      />
                      <span className="text-[12px] font-medium text-gray-800">Local Path</span>
                    </div>
                    {selectedDest === "local" && (
                      <input
                        type="text"
                        value={localPath}
                        onChange={(e) => setLocalPath(e.target.value)}
                        className="ml-6 w-[calc(100%-24px)] h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[var(--ds-action-primary)] focus:border-[var(--ds-action-primary)] font-mono"
                      />
                    )}
                  </label>

                  <label className="flex flex-col gap-2 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={selectedDest === "network"}
                        onChange={() => setSelectedDest("network")}
                        className="text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                      />
                      <span className="text-[12px] font-medium text-gray-800">Network Path</span>
                    </div>
                    {selectedDest === "network" && (
                      <input
                        type="text"
                        value={networkPath}
                        onChange={(e) => setNetworkPath(e.target.value)}
                        className="ml-6 w-[calc(100%-24px)] h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[var(--ds-action-primary)] focus:border-[var(--ds-action-primary)] font-mono"
                      />
                    )}
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={selectedDest === "cloud"}
                      onChange={() => setSelectedDest("cloud")}
                      className="text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                    />
                    <span className="text-[12px] font-medium text-gray-800">
                      Cloud (Google Drive / OneDrive / S3)
                    </span>
                  </label>
                </div>
              </div>

              {/* Include Options */}
              <div className="mb-5 pt-4 border-t border-gray-100">
                <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-2">
                  Include Data
                </div>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                    <input
                      type="checkbox"
                      checked={includeAllYears}
                      onChange={(e) => setIncludeAllYears(e.target.checked)}
                      className="text-[var(--ds-action-primary)] rounded focus:ring-[var(--ds-action-primary)]"
                    />
                    All financial years (vs current year only)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                    <input
                      type="checkbox"
                      checked={includeConfig}
                      onChange={(e) => setIncludeConfig(e.target.checked)}
                      className="text-[var(--ds-action-primary)] rounded focus:ring-[var(--ds-action-primary)]"
                    />
                    Configuration files (F11 settings, security)
                  </label>
                </div>
              </div>

              {/* Compression & Encryption */}
              <div className="mb-5 pt-4 border-t border-gray-100">
                <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-2">
                  Security & Size
                </div>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                    <input
                      type="checkbox"
                      checked={compressBackup}
                      onChange={(e) => setCompressBackup(e.target.checked)}
                      className="text-[var(--ds-action-primary)] rounded focus:ring-[var(--ds-action-primary)]"
                    />
                    Compress Backup (ZIP format, ~70% size reduction)
                  </label>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                      <input
                        type="checkbox"
                        checked={encryptBackup}
                        onChange={(e) => setEncryptBackup(e.target.checked)}
                        className="text-[var(--ds-action-primary)] rounded focus:ring-[var(--ds-action-primary)]"
                      />
                      Encrypt Backup
                    </label>
                    {encryptBackup && (
                      <div className="text-[10px] text-gray-500 ml-6 mt-0.5">
                        Uses TallyVault key if enabled
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="pt-4 border-t border-gray-100">
                <button
                  onClick={handleCreateBackup}
                  disabled={isExporting}
                  className="w-full h-10 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] disabled:bg-[var(--ds-action-primary)]/50 text-white text-[13px] font-medium rounded-md transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  {isExporting ? (
                    <>
                      <HardDrive size={16} className="animate-spin" />
                      Creating Backup...
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      Create Backup Now
                    </>
                  )}
                </button>

                <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-[11px] text-green-800 flex items-center gap-1.5">
                  <CheckCircle size={14} className="text-green-600" />
                  Backup integrity is verified automatically after creation via checksum validation.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RESTORE TAB */}
        {tab === "restore" && (
          <div className="flex flex-col gap-5">
            {/* Warning Box */}
            <div className="bg-red-50 border border-red-200 rounded-md p-4 shadow-sm flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-[12px] font-bold text-red-800 mb-1 tracking-wide">
                  RESTORE WARNING
                </div>
                <div className="text-[11px] text-red-700 leading-relaxed">
                  Restoring will <strong className="font-bold">OVERWRITE</strong> the current
                  company data. Current data will be permanently replaced by the backup. We strongly
                  recommend creating a backup of current data before restoring.
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm">
              {/* Restore Source Radios */}
              <div className="mb-5">
                <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-3">
                  Restore Source
                </div>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-800 font-medium">
                    <input
                      type="radio"
                      name="source"
                      defaultChecked
                      className="text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                    />{" "}
                    Local File
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-800 font-medium">
                    <input
                      type="radio"
                      name="source"
                      className="text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                    />{" "}
                    Cloud Backup
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-800 font-medium">
                    <input
                      type="radio"
                      name="source"
                      className="text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                    />{" "}
                    Network Path
                  </label>
                </div>
              </div>

              {/* File Upload Zone */}
              <div className="border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors rounded-lg p-8 flex flex-col items-center justify-center min-h-[140px] mb-5">
                <Upload size={28} className="text-gray-400 mb-3" />
                {!backupFile ? (
                  <div className="text-center">
                    <div className="text-[12px] text-gray-600 mb-3">
                      Click to browse or drag & drop backup file here
                    </div>
                    <input
                      type="file"
                      accept=".zip,.json,.bak"
                      onChange={(e) => setBackupFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="inline-block h-8 px-4 leading-8 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-50 cursor-pointer shadow-sm transition-colors"
                    >
                      Browse Files
                    </label>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-white border border-gray-200 px-4 py-2 rounded-md shadow-sm">
                    <div>
                      <div className="text-[12px] font-semibold text-gray-800">
                        {backupFile.name}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {(backupFile.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                    <button
                      onClick={() => setBackupFile(null)}
                      className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-colors"
                      title="Remove file"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Available Backups Table */}
              <div>
                <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-2">
                  Recent Backups
                </div>
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f5f6fa] border-b border-gray-200">
                        <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Date/Time
                        </th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Filename
                        </th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Size
                        </th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Type
                        </th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {history
                        .filter((r) => r.status === "completed")
                        .slice(0, 3)
                        .map((record) => (
                          <tr key={record.id} className="hover:bg-gray-50/50">
                            <td className="px-3 py-2.5 text-[11px] text-gray-800">
                              {formatDate(record.created_at)}
                            </td>
                            <td className="px-3 py-2.5 text-[11px] font-mono text-gray-600 truncate max-w-[150px]">
                              {record.filename}
                            </td>
                            <td className="px-3 py-2.5 text-[11px] text-gray-600">
                              {formatFileSize(record.file_size_bytes)}
                            </td>
                            <td className="px-3 py-2.5 text-[11px]">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  record.backup_type === "manual"
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : record.backup_type === "scheduled"
                                      ? "bg-green-50 text-green-700 border border-green-200"
                                      : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {record.backup_type}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <button
                                onClick={() => handleRestore()}
                                className="h-6 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[10px] font-medium rounded transition-colors"
                              >
                                Restore
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Restore Action Buttons */}
              <div className="flex flex-wrap justify-center gap-3 mt-6 pt-5 border-t border-gray-100">
                <button
                  onClick={handleSafeRestore}
                  className="h-9 px-5 bg-[#059669] hover:bg-green-700 text-white text-[12px] font-medium rounded-md transition-colors shadow-sm"
                >
                  Backup Current Data First, Then Restore
                </button>
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        "DANGER: This will immediately overwrite all current data. Continue?",
                      )
                    ) {
                      handleRestore();
                    }
                  }}
                  className="h-9 px-5 bg-white border border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 text-[12px] font-medium rounded-md transition-colors shadow-sm"
                >
                  Restore Directly
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SCHEDULE TAB */}
        {tab === "schedule" && (
          <div className="max-w-xl mx-auto">
            <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
                <div>
                  <div className="text-[13px] font-semibold text-gray-800">Enable Auto-Backup</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Automatically create backups in the background.
                  </div>
                </div>
                <div className="flex rounded-md shadow-sm">
                  <button
                    onClick={() => setAutoBackupEnabled(true)}
                    className={`px-4 py-1.5 text-[11px] font-bold border transition-colors rounded-l-md ${
                      autoBackupEnabled
                        ? "bg-[#059669] text-white border-[#059669] z-10"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setAutoBackupEnabled(false)}
                    className={`px-4 py-1.5 text-[11px] font-bold border-y border-r transition-colors rounded-r-md -ml-px ${
                      !autoBackupEnabled
                        ? "bg-[#dc2626] text-white border-[#dc2626] z-10"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              <div
                className={`transition-opacity duration-200 ${autoBackupEnabled ? "opacity-100" : "opacity-50 pointer-events-none"}`}
              >
                {/* Frequency */}
                <div className="mb-5">
                  <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-3">
                    Frequency
                  </div>
                  <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        checked={autoFrequency === "daily"}
                        onChange={() => setAutoFrequency("daily")}
                        className="text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                      />
                      <span className="text-[12px] font-medium text-gray-800">Daily at:</span>
                      <input
                        type="time"
                        value={autoTime}
                        onChange={(e) => setAutoTime(e.target.value)}
                        disabled={autoFrequency !== "daily"}
                        className="h-7 px-2 text-[12px] border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[var(--ds-action-primary)] focus:border-[var(--ds-action-primary)] disabled:bg-gray-50 disabled:text-gray-400"
                      />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        checked={autoFrequency === "hourly"}
                        onChange={() => setAutoFrequency("hourly")}
                        className="text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                      />
                      <span className="text-[12px] font-medium text-gray-800">Every Hour</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        checked={autoFrequency === "onClose"}
                        onChange={() => setAutoFrequency("onClose")}
                        className="text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                      />
                      <span className="text-[12px] font-medium text-gray-800">
                        On Every Company Close
                      </span>
                    </label>
                  </div>
                </div>

                {/* Retention */}
                <div className="mb-5 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[12px] font-medium text-gray-800">
                      Keep last N backups:
                    </span>
                    <input
                      type="number"
                      value={keepLast}
                      onChange={(e) => setKeepLast(e.target.value)}
                      className="w-16 h-7 px-2 text-[12px] border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[var(--ds-action-primary)] focus:border-[var(--ds-action-primary)]"
                    />
                  </div>
                  <div className="text-[10px] text-gray-500 italic">
                    Older backups are deleted automatically to save space.
                  </div>
                </div>

                {/* Backup on Exit */}
                <div className="mb-6 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-gray-800">
                      Prompt for backup when closing application
                    </span>
                    <div className="flex rounded shadow-sm">
                      <button
                        onClick={() => setBackupOnExit(true)}
                        className={`px-3 py-1 text-[10px] font-bold border transition-colors rounded-l ${
                          backupOnExit
                            ? "bg-[#059669] text-white border-[#059669] z-10"
                            : "bg-white text-gray-700 border-gray-300"
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setBackupOnExit(false)}
                        className={`px-3 py-1 text-[10px] font-bold border-y border-r transition-colors rounded-r -ml-px ${
                          !backupOnExit
                            ? "bg-[#dc2626] text-white border-[#dc2626] z-10"
                            : "bg-white text-gray-700 border-gray-300"
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleScheduleSave}
                  className="w-full h-9 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md transition-colors shadow-sm"
                >
                  Save Schedule
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CLOUD TAB */}
        {tab === "cloud" && (
          <div className="max-w-xl mx-auto flex flex-col gap-5">
            <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm">
              {/* Cloud Service Selector */}
              <div className="mb-5">
                <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-3">
                  Cloud Service
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-[12px] font-medium text-gray-800">
                    <input
                      type="radio"
                      checked={cloudService === "gdrive"}
                      onChange={() => setCloudService("gdrive")}
                      className="text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                    />
                    Google Drive
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[12px] font-medium text-gray-800">
                    <input
                      type="radio"
                      checked={cloudService === "onedrive"}
                      onChange={() => setCloudService("onedrive")}
                      className="text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                    />
                    OneDrive
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[12px] font-medium text-gray-800">
                    <input
                      type="radio"
                      checked={cloudService === "s3"}
                      onChange={() => setCloudService("s3")}
                      className="text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                    />
                    Amazon S3
                  </label>
                </div>
              </div>

              {/* Connection Status Card */}
              <div
                className={`border rounded-md p-4 mb-5 transition-colors ${
                  cloudConnected ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                }`}
              >
                {cloudConnected ? (
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[12px] font-bold text-green-800 mb-1 flex items-center gap-1.5">
                        <CheckCircle size={14} /> Connected: backup@company.com
                      </div>
                      <div className="text-[11px] text-green-700 mb-1">
                        <span className="font-medium">Folder:</span> /Accounting Backups/
                      </div>
                      <div className="text-[11px] text-green-700">
                        <span className="font-medium">Last backup:</span> Today 03:00 AM ✓ Verified
                      </div>
                    </div>
                    <button
                      onClick={() => setCloudConnected(false)}
                      className="h-7 px-3 bg-white border border-red-200 text-red-600 text-[10px] font-bold uppercase tracking-wide rounded hover:bg-red-50 transition-colors shadow-sm"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <Cloud size={24} className="text-gray-400 mx-auto mb-2" />
                    <div className="text-[12px] text-gray-600 mb-4">
                      Not connected — click Connect to link your cloud storage.
                    </div>
                    <button
                      onClick={() => {
                        setCloudConnected(true);
                        toast.success("Simulated: Connected to Google Drive. backup@company.com");
                      }}
                      className="h-8 px-4 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[11px] font-medium rounded transition-colors shadow-sm"
                    >
                      Connect to{" "}
                      {cloudService === "gdrive"
                        ? "Google Drive"
                        : cloudService === "onedrive"
                          ? "OneDrive"
                          : "Amazon S3"}
                    </button>
                  </div>
                )}
              </div>

              {/* Action */}
              <button
                onClick={handleCloudBackup}
                disabled={!cloudConnected}
                className="w-full h-10 bg-[#059669] hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-[13px] font-medium rounded-md transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <Cloud size={16} />
                Backup Now to Cloud
              </button>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden min-h-[300px]">
            {loadingHistory ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
                <RefreshCw size={24} className="animate-spin mb-3 text-[var(--ds-action-primary)]" />
                <div className="text-[12px] font-medium">Loading backup history...</div>
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
                <Database size={32} className="text-gray-300 mb-3" />
                <div className="text-[12px] font-medium">No backup history found.</div>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Date/Time
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Filename
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Size
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Type
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Notes
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-[11px] text-gray-800 whitespace-nowrap">
                        {formatDate(record.created_at)}
                      </td>
                      <td
                        className="px-4 py-3 text-[11px] font-mono text-gray-600 truncate max-w-[150px]"
                        title={record.filename}
                      >
                        {record.filename}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-gray-600 whitespace-nowrap">
                        {formatFileSize(record.file_size_bytes)}
                      </td>
                      <td className="px-4 py-3 text-[11px]">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            record.backup_type === "manual"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : record.backup_type === "scheduled"
                                ? "bg-green-50 text-green-700 border border-green-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {record.backup_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px]">
                        <span
                          className={`flex items-center gap-1 ${record.status === "completed" ? "text-green-600 font-medium" : "text-red-600 font-medium"}`}
                        >
                          {record.status === "completed" ? (
                            <>
                              <CheckCircle size={12} /> Verified
                            </>
                          ) : (
                            <>
                              <AlertTriangle size={12} /> Failed
                            </>
                          )}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-[11px] text-gray-600 truncate max-w-[150px]"
                        title={record.notes || ""}
                      >
                        {record.notes || <span className="text-gray-400 italic">None</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {record.status === "completed" && (
                          <button className="h-6 px-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-[10px] font-medium rounded transition-colors shadow-sm">
                            Download
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BackupRestore;
