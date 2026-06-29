// @ts-nocheck
import React, { useRef, useEffect } from "react";
import { Building2, ChevronRight } from "lucide-react";
import { useStore } from "@/store/useStore";
import AuthBrandingPanel from "./AuthBrandingPanel";

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
    <div className="min-h-screen flex" style={{ background: "#E4F1D9" }}>
      {/* Left: Branding Panel */}
      <AuthBrandingPanel />

      {/* Right: Company Selection */}
      <div
        className="flex-1 flex items-center justify-center p-8"
        style={{ background: "#E4F1D9" }}
      >
        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="mb-8">
            <h2
              className="text-2xl font-bold tracking-tight"
              style={{ color: "#1f2937" }}
            >
              Select a Company
            </h2>
            <p className="text-sm mt-1" style={{ color: "#1f2937" }}>
              Select a company to open or create a new one.
            </p>
          </div>

          {/* Company Card */}
          {companySettings ? (
            <div
              style={{
                background: "#EBF5E2",
                border: "1px solid #000000",
                borderRadius: "4px",
                padding: "16px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              {/* Company Icon */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  background: "#D4EABD",
                  border: "1px solid #000000",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Building2 style={{ width: 20, height: 20 }} />
              </div>

              {/* Company Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "15px",
                    color: "#1f2937",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {companySettings.companyNameEn || companySettings.name || "My Company"}
                </div>
                <div style={{ fontSize: "11px", color: "#1f2937", marginTop: "2px" }}>
                  PAN: {companySettings.panNumber || "—"}
                </div>
                <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
                  {lastLoginInfo
                    ? `Last opened: ${formatLoginDate(lastLoginInfo.loginAt)} by ${lastLoginInfo.username}`
                    : "Not yet opened"}
                </div>
              </div>

              {/* Open Button */}
              <button
                ref={openBtnRef}
                onClick={handleOpen}
                className="btn-primary"
                style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "4px" }}
              >
                Open
                <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          ) : (
            <div
              style={{
                padding: "24px",
                textAlign: "center",
                border: "1px solid #000000",
                borderRadius: "4px",
                background: "#EBF5E2",
                fontSize: "13px",
                color: "#1f2937",
              }}
            >
              Loading company data…
            </div>
          )}

          {/* Divider */}
          <div
            style={{
              borderBottom: "1px solid #000000",
              margin: "24px 0",
            }}
          />

          {/* Create New Company */}
          <div style={{ textAlign: "center" }}>
            <button
              onClick={() => setAuthStage("no-company")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
                color: "#1f2937",
                textDecoration: "underline",
                padding: "4px 8px",
              }}
            >
              + Create New Company
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
