// @ts-nocheck
import React, { useRef, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { useStore } from "@/store/useStore";

function formatLoginDate(isoString: string): string {
  const d = new Date(isoString);
  return (
    d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) +
    " at " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );
}

// Inline logotype — no external dependency, no cartoon icons
const SutraLogotype: React.FC<{ size?: number }> = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="10" fill="#1557b0" />
    <path
      d="M30 13C30 13 28 11 24 11C19 11 16 13.5 16 17C16 20.5 19 22 24 23C29 24 32 25.5 32 29C32 32.5 29 37 24 37C19 37 16 35 16 35"
      stroke="white"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <line x1="13" y1="41" x2="35" y2="41" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="16" y1="44.5" x2="32" y2="44.5" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeLinecap="round" />
  </svg>
);

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

  const companyName = companySettings?.companyNameEn || companySettings?.name || "My Company";

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f5f6fa" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 36,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        {/* Logotype + title */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <SutraLogotype size={52} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>Sutra ERP</h1>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Select a company to open</p>
        </div>

        {/* Company card */}
        {companySettings ? (
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 20,
            }}
          >
            {/* Company initial circle — no cartoon Building2 icon */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: "#1557b010",
                border: "1px solid #1557b030",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: 16,
                fontWeight: 700,
                color: "#1557b0",
              }}
            >
              {(companyName.charAt(0) || "C").toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {companyName}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                PAN: {companySettings.panNumber || "—"}
              </div>
              {lastLoginInfo && (
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>
                  Last: {formatLoginDate(lastLoginInfo.loginAt)} by {lastLoginInfo.username}
                </div>
              )}
            </div>
            <button
              ref={openBtnRef}
              onClick={handleOpen}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                height: 32,
                padding: "0 14px",
                background: "#1557b0",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                flexShrink: 0,
                transition: "background 150ms ease",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#0f4a96"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1557b0"; }}
            >
              Open <ChevronRight size={13} />
            </button>
          </div>
        ) : (
          <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 12, color: "#9ca3af" }}>
            Loading company data…
          </div>
        )}

        {/* Create new */}
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, textAlign: "center" }}>
          <button
            onClick={() => setAuthStage("no-company")}
            style={{
              background: "none",
              border: "none",
              fontSize: 12,
              fontWeight: 600,
              color: "#1557b0",
              cursor: "pointer",
              transition: "color 150ms ease",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#0f4a96"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#1557b0"; }}
          >
            + Create New Company
          </button>
        </div>

        {/* Copyright footer */}
        <div style={{ marginTop: 20, textAlign: "center", fontSize: 10, color: "#9ca3af" }}>
          Sutra ERP v2.0 &nbsp;·&nbsp; All activity is logged for compliance
        </div>
      </div>
    </div>
  );
}
