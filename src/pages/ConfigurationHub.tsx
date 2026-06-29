// @ts-nocheck
import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { Sliders, Calendar, Plus, Edit2, Trash2, X, Save } from "lucide-react";

const BORDER = "1px solid #000";
const BG_HEADER = "#D4EABD";
const BG_ROW_ALT = "#F5FAF0";
const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "5px 8px",
  border: BORDER,
  borderRadius: 3,
  fontSize: 12,
  background: "#fff",
  outline: "none",
};
const BTN = (bg: string): React.CSSProperties => ({
  padding: "5px 14px",
  background: bg,
  border: BORDER,
  borderRadius: 3,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  color: bg === "#fff" ? "#000" : "#fff",
});

const CONFIG_SECTIONS = [
  {
    id: "party-dashboard",
    label: "Party Dashboard Configuration",
    desc: "Configure what data shows on party dashboards.",
  },
  {
    id: "email",
    label: "Email Configuration",
    desc: "SMTP server, sender email, SSL/TLS settings for automated email dispatch.",
  },
  {
    id: "whatsapp-sms",
    label: "WhatsApp/SMS API Configuration",
    desc: "Third-party API keys, sender ID, gateway URL for automated messaging.",
  },
  {
    id: "backup",
    label: "Backup Configuration",
    desc: "Auto-backup folder, frequency, retention count, compression settings.",
  },
  {
    id: "invoice-print",
    label: "Invoice/Document Printing",
    desc: "Margins, fonts, column widths, header/footer content, logo placement.",
  },
  {
    id: "voucher-print",
    label: "Accounting Voucher Printing",
    desc: "Format and fields for payment, receipt, journal, contra vouchers.",
  },
  {
    id: "warning-alarms",
    label: "Warning Alarms",
    desc: "Credit limit exceeded, overdue payment, low stock, below minimum price.",
  },
  {
    id: "ageing-slabs",
    label: "Ageing Analysis Time Slabs",
    desc: "Define 0-30, 31-60, 61-90, 90+ day buckets for receivable/payable reports.",
  },
  {
    id: "interest-slabs",
    label: "Interest Calculation Slabs",
    desc: "Overdue interest rates and time slab configurations.",
  },
  {
    id: "max-voucher-entries",
    label: "Maximum Entries in Voucher",
    desc: "Set maximum number of line items allowed per voucher.",
  },
];

export default function ConfigurationHub() {
  const { currentPage, holidays, addHoliday, updateHoliday, deleteHoliday } = useStore();
  const [activeSection, setActiveSection] = useState("overview");
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<any>(null);
  const [holidayForm, setHolidayForm] = useState({ date: "", name: "" });

  const isHolidaysPage = currentPage === "holidays";

  const resetHolidayForm = () => {
    setHolidayForm({ date: "", name: "" });
    setSelectedHoliday(null);
    setShowHolidayForm(false);
  };

  const handleHolidaySubmit = async () => {
    if (!holidayForm.date || !holidayForm.name.trim())
      return alert("Date and Holiday Name are required.");
    if (selectedHoliday) {
      await updateHoliday(selectedHoliday.id, holidayForm);
      alert("Holiday updated.");
    } else {
      await addHoliday(holidayForm);
      alert("Holiday saved.");
    }
    resetHolidayForm();
  };

  if (isHolidaysPage || activeSection === "holidays") {
    return (
      <div style={{ display: "flex", height: "100%", gap: 0 }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            borderRight: showHolidayForm ? BORDER : "none",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderBottom: BORDER,
              background: BG_HEADER,
            }}
          >
            <Calendar style={{ width: 16, height: 16 }} />
            <span style={{ fontWeight: 700, fontSize: 13 }}>List of Holidays</span>
            <div style={{ flex: 1 }} />
            {!isHolidaysPage && (
              <button style={BTN("#fff")} onClick={() => setActiveSection("overview")}>
                ← Back
              </button>
            )}
            <button
              style={BTN("#3D6B25")}
              onClick={() => {
                resetHolidayForm();
                setShowHolidayForm(true);
              }}
            >
              <Plus style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
              Add Holiday
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: BG_HEADER, position: "sticky", top: 0 }}>
                  {["#", "Date", "Holiday Name", "Actions"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "6px 10px",
                        borderBottom: BORDER,
                        textAlign: "left",
                        fontWeight: 700,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(holidays || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: 24, color: "#666" }}>
                      No holidays defined. Add company holidays to calculate working days
                      accurately.
                    </td>
                  </tr>
                ) : (
                  [...(holidays || [])]
                    .sort((a: any, b: any) => a.date.localeCompare(b.date))
                    .map((h: any, i: number) => (
                      <tr key={h.id} style={{ background: i % 2 === 0 ? "#fff" : BG_ROW_ALT }}>
                        <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{i + 1}</td>
                        <td style={{ padding: "5px 10px", borderBottom: BORDER, fontWeight: 600 }}>
                          {h.date}
                        </td>
                        <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{h.name}</td>
                        <td style={{ padding: "5px 10px", borderBottom: BORDER }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              style={BTN("#fff")}
                              onClick={() => {
                                setSelectedHoliday(h);
                                setHolidayForm({ date: h.date, name: h.name });
                                setShowHolidayForm(true);
                              }}
                            >
                              <Edit2 style={{ width: 12, height: 12 }} />
                            </button>
                            <button
                              style={{ ...BTN("#fff"), color: "#c00" }}
                              onClick={async () => {
                                if (confirm("Delete?")) await deleteHoliday(h.id);
                              }}
                            >
                              <Trash2 style={{ width: 12, height: 12 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
          <div
            style={{ padding: "4px 12px", borderTop: BORDER, background: BG_HEADER, fontSize: 11 }}
          >
            Total: {(holidays || []).length} holiday(s)
          </div>
        </div>
        {showHolidayForm && (
          <div style={{ width: 300, borderLeft: BORDER, display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 12px",
                background: BG_HEADER,
                borderBottom: BORDER,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 13 }}>
                {selectedHoliday ? "Edit" : "Add"} Holiday
              </span>
              <button
                style={{
                  marginLeft: "auto",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={resetHolidayForm}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div
              style={{ flex: 1, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}
            >
              <label style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>Date *</div>
                <input
                  type="date"
                  value={holidayForm.date}
                  onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                  style={INPUT_STYLE}
                />
              </label>
              <label style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>Holiday Name *</div>
                <input
                  value={holidayForm.name}
                  onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                  style={INPUT_STYLE}
                  placeholder="e.g. Dashain, Tihar, New Year"
                />
              </label>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                padding: "10px 14px",
                borderTop: BORDER,
                background: BG_HEADER,
              }}
            >
              <button style={BTN("#3D6B25")} onClick={handleHolidaySubmit}>
                <Save style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
                {selectedHoliday ? "Update" : "Save"}
              </button>
              <button style={BTN("#fff")} onClick={resetHolidayForm}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Sliders style={{ width: 18, height: 18 }} />
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>System Configuration</h2>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        {CONFIG_SECTIONS.map((s) => (
          <div
            key={s.id}
            style={{
              border: BORDER,
              borderRadius: 4,
              padding: 14,
              background: "#fff",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = BG_ROW_ALT)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            onClick={() =>
              alert(
                `${s.label}\n\n${s.desc}\n\nThis configuration panel will be fully implemented in the next phase.`,
              )
            }
          >
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: "#555" }}>{s.desc}</div>
          </div>
        ))}
        <div
          style={{
            border: BORDER,
            borderRadius: 4,
            padding: 14,
            background: "#fff",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = BG_ROW_ALT)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
          onClick={() => setActiveSection("holidays")}
        >
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>List of Holidays</div>
          <div style={{ fontSize: 11, color: "#555" }}>
            Define company holidays for working-day calculations.
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: "#3D6B25", fontWeight: 600 }}>
            {(holidays || []).length} holiday(s) configured →
          </div>
        </div>
      </div>
    </div>
  );
}
