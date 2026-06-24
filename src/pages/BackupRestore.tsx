import React, { useState, useEffect } from "react";
import { Download, Upload, Cloud, AlertTriangle, Database, Clock, CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { ADToBSString } from "../lib/nepaliDate";
import { ConfirmDialog, Spinner, ActionToolbar } from "../components/ui";
 
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
 
interface BackupPreview {
  companySettings: number;
  fiscalYears: number;
  shortcuts: number;
  auditLogs: number;
  meta?: { version: string; created_at: string; total_rows: number };
}
 
export default function BackupRestore() {
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null);
  const [lastBackupDate, setLastBackupDate] = useState("Never");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [history, setHistory] = useState<BackupRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
 
  useEffect(() => {
    const rawDate = localStorage.getItem("sutra_last_backup_date");
    if (rawDate) setLastBackupDate(new Date(rawDate).toLocaleString());
    fetchHistory();
  }, []);
 
  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch("/api/backup/history");
      const json = await res.json();
      if (json.success) setHistory(json.data || []);
    } catch {
      // Silent — history is non-critical
    } finally {
      setLoadingHistory(false);
    }
  };
 
  const handleCreateBackup = async () => {
    try {
      setIsExporting(true);
      const res = await fetch("/api/backup/export");
 
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Server error" }));
        throw new Error(err.error || `Server responded with ${res.status}`);
      }
 
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
 
      const today = new Date().toISOString().split("T")[0];
      const bsDateStr = ADToBSString(today) || today;
 
      const a = document.createElement("a");
      a.href = url;
      a.download = `sutra_backup_${bsDateStr.replace(/\//g, "-")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
 
      const nowStr = new Date().toISOString();
      localStorage.setItem("sutra_last_backup_date", nowStr);
      setLastBackupDate(new Date(nowStr).toLocaleString());
      toast.success("Backup downloaded successfully");
      fetchHistory();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create backup");
    } finally {
      setIsExporting(false);
    }
  };
 
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
 
    if (!file.name.endsWith(".json")) {
      toast.error("Please select a .json backup file");
      return;
    }
 
    setBackupFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        setBackupPreview({
          meta: data._meta,
          companySettings: Array.isArray(data.company_settings) ? data.company_settings.length : 0,
          fiscalYears: Array.isArray(data.fiscal_years) ? data.fiscal_years.length : 0,
          shortcuts: Array.isArray(data.keyboard_shortcuts) ? data.keyboard_shortcuts.length : 0,
          auditLogs: Array.isArray(data.audit_logs) ? data.audit_logs.length : 0,
        });
      } catch {
        toast.error("Invalid backup file. Must be a valid Sutra ERP JSON backup.");
        setBackupFile(null);
        setBackupPreview(null);
      }
    };
    reader.readAsText(file);
  };
 
  const handleRestore = async () => {
    if (!backupFile) return;
 
    try {
      setIsRestoring(true);
      const formData = new FormData();
      formData.append("file", backupFile);
 
      const res = await fetch("/api/backup/import", { method: "POST", body: formData });
      const json = await res.json();
 
      if (json.success) {
        toast.success(json.message || "Restore complete. Reloading...");
        if (json.errors?.length) {
          toast.error(`Some tables had errors: ${json.errors.map((e: any) => e.table).join(", ")}`);
        }
        setBackupFile(null);
        setBackupPreview(null);
        fetchHistory();
        setTimeout(() => window.location.reload(), 2500);
      } else {
        toast.error(json.error || "Restore failed");
        setIsRestoring(false);
      }
    } catch (error: any) {
      toast.error(error?.message || "Network error during restore");
      setIsRestoring(false);
    }
  };
 
  const formatFileSize = (bytes: number) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };
 
  const formatBSDate = (isoStr: string) => {
    try {
      const adPart = isoStr.split("T")[0];
      const bs = ADToBSString(adPart);
      const time = isoStr.split("T")[1]?.substring(0, 8) || "";
      return `${bs || adPart} ${time}`;
    } catch {
      return isoStr;
    }
  };
 
  return (
    <div className="space-y-6">
      <ActionToolbar title="Backup & Restore" subtitle="Data backup and recovery management" />
 
      <div className="grid grid-cols-2 gap-6">
        {/* BACKUP */}
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <div className="flex items-center space-x-3">
            <Download className="w-6 h-6 text-[#1557b0]" />
            <h2 className="text-lg font-semibold">Create Backup</h2>
          </div>
          <p className="text-sm text-gray-600">
            Download a complete JSON backup of all your company data including fiscal years,
            settings, shortcuts, and audit logs.
          </p>
          <div className="border-t pt-4">
            <button
              onClick={handleCreateBackup}
              disabled={isExporting}
              className="w-full flex items-center justify-center space-x-2 h-9 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md disabled:opacity-50 transition-colors"
            >
              {isExporting ? <Spinner size="sm" /> : <Download className="w-4 h-4" />}
              <span>{isExporting ? "Exporting…" : "Download Backup Now"}</span>
            </button>
            <div className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last backup: {lastBackupDate}
            </div>
          </div>
        </div>
 
        {/* RESTORE */}
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <div className="flex items-center space-x-3">
            <Upload className="w-6 h-6 text-orange-600" />
            <h2 className="text-lg font-semibold">Restore Backup</h2>
          </div>
 
          <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded">
            <div className="flex gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-700 font-semibold">Danger Zone</p>
                <p className="text-xs text-red-600 mt-0.5">
                  This will overwrite ALL current data. Make a fresh backup before restoring.
                </p>
              </div>
            </div>
          </div>
 
          <div className="border-t pt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload Backup File (.json)</label>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="w-full text-[12px] text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-[#1557b0] file:text-white file:text-[11px] file:cursor-pointer"
              />
            </div>
 
            {backupPreview && (
              <div className="bg-blue-50 p-4 rounded space-y-2 border border-blue-100">
                <h3 className="font-semibold text-[13px] text-blue-800">Backup Preview</h3>
                {backupPreview.meta && (
                  <p className="text-[11px] text-blue-600">
                    Created: {formatBSDate(backupPreview.meta.created_at)} · v{backupPreview.meta.version} · {backupPreview.meta.total_rows} rows total
                  </p>
                )}
                <div className="text-[12px] space-y-1 text-gray-700">
                  <p><span className="font-medium">Company Settings:</span> {backupPreview.companySettings} record(s)</p>
                  <p><span className="font-medium">Fiscal Years:</span> {backupPreview.fiscalYears} record(s)</p>
                  <p><span className="font-medium">Keyboard Shortcuts:</span> {backupPreview.shortcuts} record(s)</p>
                  <p><span className="font-medium">Audit Logs:</span> {backupPreview.auditLogs} record(s)</p>
                </div>
              </div>
            )}
 
            <button
              onClick={() => setIsConfirmOpen(true)}
              disabled={!backupFile || isRestoring}
              className="w-full flex items-center justify-center space-x-2 h-9 px-3 bg-orange-600 hover:bg-orange-700 text-white text-[12px] font-medium rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isRestoring ? <Spinner size="sm" /> : <Upload className="w-4 h-4" />}
              <span>{isRestoring ? "Restoring…" : "Restore from Backup"}</span>
            </button>
          </div>
        </div>
      </div>
 
      {/* BACKUP HISTORY */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <div className="flex items-center space-x-3">
          <Clock className="w-6 h-6 text-gray-500" />
          <h2 className="text-lg font-semibold">Backup History</h2>
          <button onClick={fetchHistory} className="text-[11px] text-[#1557b0] hover:underline ml-auto">Refresh</button>
        </div>
 
        {loadingHistory ? (
          <div className="text-center py-6 text-gray-400 text-sm">Loading history…</div>
        ) : history.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">No backup records yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-[#f5f6fa] border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Date (BS)</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Filename</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Type</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Size</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Rows</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((rec) => (
                  <tr key={rec.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-600">{formatBSDate(rec.created_at)}</td>
                    <td className="px-3 py-2 text-gray-700 max-w-[200px] truncate font-mono text-[10px]" title={rec.filename}>{rec.filename}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        rec.backup_type === "restore" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                      }`}>{rec.backup_type}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{formatFileSize(rec.file_size_bytes)}</td>
                    <td className="px-3 py-2 text-gray-500">{rec.rows_backed_up?.toLocaleString() || "—"}</td>
                    <td className="px-3 py-2">
                      {rec.status === "completed"
                        ? <CheckCircle className="w-4 h-4 text-green-500" />
                        : <XCircle className="w-4 h-4 text-red-500" />
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
 
      {/* CLOUD BACKUP (Coming Soon) */}
      <div className="bg-white p-6 rounded-lg shadow opacity-60">
        <div className="flex items-center space-x-3 mb-3">
          <Cloud className="w-6 h-6 text-blue-600" />
          <h2 className="text-lg font-semibold">Cloud Backup</h2>
          <span className="px-2 py-0.5 text-[10px] bg-amber-100 text-amber-800 rounded-full font-semibold uppercase">Coming Soon</span>
        </div>
        <p className="text-sm text-gray-500">Automatically backup to Google Drive or AWS S3.</p>
      </div>
 
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleRestore}
        title="Confirm Backup Restore"
        message="This will OVERWRITE all current database records with the backup data. This cannot be undone. Type RESTORE to confirm."
        confirmText="Yes, Restore Now"
        cancelText="Cancel"
        danger={true}
        confirmValidationText="RESTORE"
        reasonLabel="Type RESTORE to confirm"
        reasonPlaceholder="RESTORE"
      />
    </div>
  );
}
