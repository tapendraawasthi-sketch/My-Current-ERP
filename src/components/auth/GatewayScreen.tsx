// @ts-nocheck
import React, { useRef, useEffect } from "react";
import { Building2, ChevronRight } from "lucide-react";
import { useStore } from "@/store/useStore";

function formatLoginDate(isoString: string): string {
  const d = new Date(isoString);
  return (
    d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) +
    " at " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );
}

export default function GatewayScreen() {
  const { companySettings, lastLoginInfo, selectCompanyForLogin, setAuthStage } = useStore();
  const openBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    openBtnRef.current?.focus();
  }, []);

  const handleOpen = () => {
    const companyId = companySettings?.id || "main";
    selectCompanyForLogin(companyId);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f5f6fa" }}>
      <div
        className="w-full max-w-md rounded-xl shadow-lg p-8"
        style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
      >
        {/* Logo + Title */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center font-bold text-[22px] mx-auto mb-4"
            style={{ background: "#1557b0", color: "#ffffff" }}
          >
            S
          </div>
          <h1 className="text-[22px] font-bold text-gray-800">Sutra ERP</h1>
          <p className="text-[12px] text-gray-500 mt-1">Select a company to open</p>
        </div>

        {/* Company Card */}
        {companySettings ? (
          <div
            className="rounded-lg p-4 flex items-center gap-3 mb-6"
            style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "#e0e7ff" }}
            >
              <Building2 className="w-5 h-5" style={{ color: "#3730a3" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[13px] text-gray-800 truncate">
                {companySettings.companyNameEn || companySettings.name || "My Company"}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                PAN: {companySettings.panNumber || "—"}
              </div>
              {lastLoginInfo && (
                <div className="text-[10px] text-gray-400 mt-0.5">
                  Last: {formatLoginDate(lastLoginInfo.loginAt)} by {lastLoginInfo.username}
                </div>
              )}
            </div>
            <button
              ref={openBtnRef}
              onClick={handleOpen}
              className="flex items-center gap-1 px-3 h-8 rounded-md text-[12px] font-medium shrink-0 transition-colors"
              style={{ background: "#1557b0", color: "#ffffff", border: "none" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#0f4a96"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1557b0"; }}
            >
              Open
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div
            className="rounded-lg p-6 text-center mb-6"
            style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}
          >
            <p className="text-[12px] text-gray-500">Loading company data…</p>
          </div>
        )}

        {/* Divider */}
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "16px", textAlign: "center" }}>
          <button
            onClick={() => setAuthStage("no-company")}
            className="text-[12px] font-medium transition-colors"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#1557b0" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#0f4a96"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#1557b0"; }}
          >
            + Create New Company
          </button>
        </div>
      </div>
    </div>
  );
}
