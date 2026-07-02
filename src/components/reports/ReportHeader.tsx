// src/components/reports/ReportHeader.tsx
import React from "react";

interface ReportHeaderProps {
  companyName: string;
  companyNameNepali?: string;
  address?: string;
  pan?: string;
  phone?: string;
  email?: string;
  reportTitle: string;
  reportSubtitle?: string;
  period?: string;              // "For the period 2081 Shrawan 1 to 2081 Ashadh 32"
  asAt?: string;                // "As at 2081 Ashadh 32 (July 16, 2025)" — for point-in-time reports
  // Screen vs print behavior
  screenMode?: "always" | "print-only"; // default: "print-only"
  companyLogo?: string;         // base64 or URL
}

const ReportHeader: React.FC<ReportHeaderProps> = ({
  companyName,
  companyNameNepali,
  address,
  pan,
  phone,
  email,
  reportTitle,
  reportSubtitle,
  period,
  asAt,
  screenMode = "print-only",
  companyLogo,
}) => {
  const isAlwaysVisible = screenMode === "always";

  return (
    <div
      className={isAlwaysVisible ? "" : "print-only hidden"}
      style={{
        textAlign: "center",
        paddingBottom: 14,
        marginBottom: 16,
        borderBottom: "2px solid #111827",
      }}
    >
      {/* Company logo (if provided) */}
      {companyLogo && (
        <div style={{ marginBottom: 8 }}>
          <img
            src={companyLogo}
            alt="Company Logo"
            style={{ maxHeight: 60, maxWidth: 180, objectFit: "contain" }}
          />
        </div>
      )}

      {/* Company name — primary */}
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "#111827",
          letterSpacing: "-0.01em",
          lineHeight: 1.2,
        }}
      >
        {companyName}
      </div>

      {/* Nepali name if different */}
      {companyNameNepali && companyNameNepali !== companyName && (
        <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginTop: 2 }}>
          {companyNameNepali}
        </div>
      )}

      {/* Address */}
      {address && (
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
          {address}
        </div>
      )}

      {/* Contact line: PAN | Phone | Email */}
      <div
        style={{
          fontSize: 10,
          color: "#6b7280",
          marginTop: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {pan && (
          <span>
            <strong style={{ color: "#374151" }}>PAN/VAT:</strong> {pan}
          </span>
        )}
        {phone && (
          <span>
            <strong style={{ color: "#374151" }}>Tel:</strong> {phone}
          </span>
        )}
        {email && (
          <span>
            <strong style={{ color: "#374151" }}>Email:</strong> {email}
          </span>
        )}
      </div>

      {/* Divider */}
      <div style={{ margin: "10px auto", borderTop: "1px solid #d1d5db", maxWidth: "80%" }} />

      {/* Report title */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#111827",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {reportTitle}
      </div>

      {/* Subtitle (e.g., "Schedule III Format") */}
      {reportSubtitle && (
        <div style={{ fontSize: 11, color: "#374151", marginTop: 2 }}>
          {reportSubtitle}
        </div>
      )}

      {/* Period or As-At — mandatory, never omit */}
      {(period || asAt) && (
        <div
          style={{
            fontSize: 11,
            color: "#6b7280",
            marginTop: 4,
            fontStyle: "italic",
          }}
        >
          {period || asAt}
        </div>
      )}
    </div>
  );
};

export default ReportHeader;
