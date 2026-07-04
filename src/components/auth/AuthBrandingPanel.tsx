import React from "react";

// ─── Sutra SVG Logotype ──────────────────────────────────────────────────────
// A geometric "S" with two thin horizontal ledger lines below, rendered in pure
// SVG. The ledger lines reference the double-entry accounting motif.
// No external images, no emoji, no plain letter-in-box.

const SutraLogotype: React.FC<{ size?: number }> = ({ size = 48 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Sutra ERP"
  >
    {/* Background rounded square */}
    <rect width="48" height="48" rx="10" fill="#1557b0" />

    {/* Geometric S — built from two arcs forming a clean typographic S */}
    {/* Top arc of S */}
    <path
      d="M30 13C30 13 28 11 24 11C19 11 16 13.5 16 17C16 20.5 19 22 24 23C29 24 32 25.5 32 29C32 32.5 29 37 24 37C19 37 16 35 16 35"
      stroke="white"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />

    {/* Ledger lines — double-entry accounting motif, below the S */}
    <line
      x1="13"
      y1="41"
      x2="35"
      y2="41"
      stroke="rgba(255,255,255,0.45)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="16"
      y1="44.5"
      x2="32"
      y2="44.5"
      stroke="rgba(255,255,255,0.25)"
      strokeWidth="1"
      strokeLinecap="round"
    />
  </svg>
);

export default function AuthBrandingPanel() {
  const features = [
    {
      title: "Nepal-First Design",
      desc: "Bikram Sambat dates, 13% VAT, TDS withholding, and IRD compliance built in from day one.",
    },
    {
      title: "Complete Accounting",
      desc: "Journal entries, invoicing, inventory, multi-currency support, and full financial reporting.",
    },
    {
      title: "Secure & Auditable",
      desc: "Role-based access, immutable audit trail, period locking, and encrypted data at rest.",
    },
  ];

  return (
    <div
      className="flex-1 p-12 flex-col justify-between hidden lg:flex"
      style={{
        background: "linear-gradient(145deg, #0d1f3c 0%, #1557b0 55%, #1a6bcc 100%)",
        color: "#ffffff",
      }}
    >
      {/* Logotype + wordmark */}
      <div>
        <div className="flex items-center gap-4 mb-12">
          <SutraLogotype size={52} />
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              Sutra ERP
            </h1>
            <p
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.6)",
                marginTop: 3,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Professional Accounting for Nepal
            </p>
          </div>
        </div>

        {/* Feature list — clean, no decorative icons, just well-spaced rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {features.map(({ title, desc }) => (
            <div
              key={title}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                padding: "14px 16px",
                background: "rgba(255,255,255,0.06)",
                borderRadius: 8,
                borderLeft: "3px solid rgba(255,255,255,0.25)",
              }}
            >
              {/* Tick mark — minimal, no cartoon icons */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                style={{ marginTop: 1, flexShrink: 0 }}
              >
                <circle
                  cx="8"
                  cy="8"
                  r="7"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth="1"
                  fill="none"
                />
                <path
                  d="M5 8l2 2 4-4"
                  stroke="#22c55e"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", lineHeight: 1.3 }}>
                  {title}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.65)",
                    marginTop: 3,
                    lineHeight: 1.5,
                  }}
                >
                  {desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 40 }}>
        © 2081 B.S. Sutra Software Pvt. Ltd. &nbsp;·&nbsp; Kathmandu, Nepal
        <br />
        <span style={{ marginTop: 3, display: "block" }}>
          Version 2.0 &nbsp;·&nbsp; All data stored locally and securely
        </span>
      </div>
    </div>
  );
}
