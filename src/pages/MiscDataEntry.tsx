// @ts-nocheck
import React, { useState } from "react";
import { useStore } from "../store/useStore";
import {
  ClipboardList,
  MessageSquare,
  Truck,
  FileText,
  MapPin,
  CreditCard,
  Layers,
  Package,
} from "lucide-react";

const BORDER = "1px solid #000";
const BG_HEADER = "#D4EABD";
const BTN = (bg: string): React.CSSProperties => ({
  padding: "6px 14px",
  background: bg,
  border: BORDER,
  borderRadius: 3,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  color: bg === "#fff" ? "#000" : "#fff",
});
const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  border: BORDER,
  borderRadius: 3,
  fontSize: 12,
  background: "#fff",
  outline: "none",
};

const MISC_ENTRIES = [
  {
    id: "daily-message",
    label: "Update Daily Message",
    icon: MessageSquare,
    desc: "Set the message that appears when users log in — announcements, reminders, notices.",
  },
  {
    id: "transport-details",
    label: "Update Transport Details",
    icon: Truck,
    desc: "Bulk update transport/courier details across multiple vouchers.",
  },
  {
    id: "purchase-bill-no",
    label: "Update Purchase Bill No./Date",
    icon: FileText,
    desc: "Bulk update or correct supplier invoice numbers and dates on purchase vouchers.",
  },
  {
    id: "billing-shipping",
    label: "Update Billing/Shipping Details",
    icon: MapPin,
    desc: "Bulk update billing and shipping addresses across multiple sales vouchers.",
  },
  {
    id: "settlement-details",
    label: "Update Settlement Details",
    icon: CreditCard,
    desc: "Bulk update payment terms and settlement information on vouchers.",
  },
  {
    id: "optional-fields",
    label: "Update Voucher Optional Fields",
    icon: Layers,
    desc: "Bulk update user-defined custom/optional fields across multiple vouchers.",
  },
  {
    id: "opening-info",
    label: "Opening Information",
    icon: Package,
    desc: "Enter or update opening balances for the financial year — stock, party balances, bank balances.",
  },
];

export default function MiscDataEntry() {
  const { companySettings, vouchers, updateAccount } = useStore();
  const [activeEntry, setActiveEntry] = useState<string | null>(null);
  const [dailyMessage, setDailyMessage] = useState(companySettings?.dailyMessage || "");
  const [transportForm, setTransportForm] = useState({
    fromDate: "",
    toDate: "",
    transporter: "",
    vehicleNo: "",
    lrNo: "",
  });

  const handleDailyMessageSave = () => {
    alert(
      `Daily Message saved:\n"${dailyMessage}"\n\nTo persist: add a 'dailyMessage' field to companySettings in the store and call updateCompanySettings().`,
    );
  };

  const handleTransportUpdate = () => {
    const matching = vouchers.filter((v: any) => {
      if (!v.date) return false;
      const after = !transportForm.fromDate || v.date >= transportForm.fromDate;
      const before = !transportForm.toDate || v.date <= transportForm.toDate;
      return after && before;
    });
    alert(
      `Found ${matching.length} vouchers in the date range.\n\nTo implement:\n1. Loop through matching vouchers\n2. Call updateVoucher(v.id, { transportDetails: { transporter, vehicleNo, lrNo } })\n3. Add updateVoucher() to store if not present`,
    );
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          borderBottom: BORDER,
          background: BG_HEADER,
        }}
      >
        <ClipboardList style={{ width: 16, height: 16 }} />
        <span style={{ fontWeight: 700, fontSize: 14 }}>Miscellaneous Data Entry</span>
        <span style={{ fontSize: 11, color: "#555", marginLeft: 8 }}>
          Utility data entry functions for bulk corrections
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {activeEntry === "daily-message" && (
          <div style={{ border: BORDER, borderRadius: 4, padding: 16, background: "#FFFDE7" }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>
              Update Daily Login Message
            </div>
            <textarea
              value={dailyMessage}
              onChange={(e) => setDailyMessage(e.target.value)}
              rows={4}
              style={{ ...INPUT_STYLE, resize: "vertical", marginBottom: 12 }}
              placeholder="Enter the message users will see when they log in..."
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button style={BTN("#3D6B25")} onClick={handleDailyMessageSave}>
                Save Message
              </button>
              <button style={BTN("#fff")} onClick={() => setActiveEntry(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {activeEntry === "transport-details" && (
          <div style={{ border: BORDER, borderRadius: 4, padding: 16, background: "#FFFDE7" }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>
              Update Transport Details in Vouchers
            </div>
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}
            >
              {[
                { label: "From Date", key: "fromDate", type: "date" },
                { label: "To Date", key: "toDate", type: "date" },
                { label: "Transporter Name", key: "transporter", type: "text" },
                { label: "Vehicle No.", key: "vehicleNo", type: "text" },
                { label: "LR No.", key: "lrNo", type: "text" },
              ].map(({ label, key, type }) => (
                <label key={key} style={{ fontSize: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 3 }}>{label}</div>
                  <input
                    type={type}
                    value={(transportForm as any)[key]}
                    onChange={(e) => setTransportForm({ ...transportForm, [key]: e.target.value })}
                    style={INPUT_STYLE}
                  />
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={BTN("#3D6B25")} onClick={handleTransportUpdate}>
                Preview & Update
              </button>
              <button style={BTN("#fff")} onClick={() => setActiveEntry(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {activeEntry === "opening-info" && (
          <div style={{ border: BORDER, borderRadius: 4, padding: 16, background: "#FFFDE7" }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
              Opening Information
            </div>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>
              Manage opening balances for the current financial year. For detailed opening balance
              entry, use the full Opening Balance page.
            </div>
            <button
              style={BTN("#3D6B25")}
              onClick={() => {
                useStore.getState().setCurrentPage("opening-balance");
                setActiveEntry(null);
              }}
            >
              Go to Opening Balance Page →
            </button>
            <button style={{ ...BTN("#fff"), marginLeft: 8 }} onClick={() => setActiveEntry(null)}>
              Cancel
            </button>
          </div>
        )}

        {/* Main menu grid */}
        {!activeEntry && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 12,
            }}
          >
            {MISC_ENTRIES.map(({ id, label, icon: Icon, desc }) => (
              <div
                key={id}
                style={{
                  border: BORDER,
                  borderRadius: 4,
                  padding: 14,
                  background: "#fff",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#F5FAF0")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                onClick={() => setActiveEntry(id)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{label}</div>
                </div>
                <div style={{ fontSize: 11, color: "#555" }}>{desc}</div>
              </div>
            ))}
          </div>
        )}

        {activeEntry &&
          !["daily-message", "transport-details", "opening-info"].includes(activeEntry) && (
            <div style={{ border: BORDER, borderRadius: 4, padding: 16, background: "#FFFDE7" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                {MISC_ENTRIES.find((e) => e.id === activeEntry)?.label}
              </div>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>
                {MISC_ENTRIES.find((e) => e.id === activeEntry)?.desc}
              </div>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
                Implementation: Add a date range selector, filter affected vouchers, then
                batch-update via store actions (addVoucher/updateVoucher loop).
              </div>
              <button style={BTN("#fff")} onClick={() => setActiveEntry(null)}>
                ← Back
              </button>
            </div>
          )}
      </div>
    </div>
  );
}
