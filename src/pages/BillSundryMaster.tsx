// @ts-nocheck
import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { Plus, Edit2, Trash2, FileText, X, Save } from "lucide-react";

const BORDER = "1px solid #000";
const BG_HEADER = "#D4EABD";
const BG_ROW_ALT = "#F5FAF0";
const INPUT_STYLE: React.CSSProperties = {
  width: "100%", padding: "5px 8px", border: BORDER, borderRadius: 3, fontSize: 12, background: "#fff", outline: "none",
};
const BTN = (bg: string): React.CSSProperties => ({
  padding: "5px 14px", background: bg, border: BORDER, borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: "pointer",
  color: bg === "#fff" ? "#000" : "#fff",
});

const DEFAULT_FORM = {
  name: "", alias: "", type: "additive", nature: "percentage",
  accountHeadId: "", defaultValue: 0, affectsCostInSale: false,
  affectsCostInPurchase: true, adjustInPartyAmount: true,
  applicableOn: "nett_bill",
};

export default function BillSundryMaster() {
  const { billSundryMasters, accounts, addBillSundryMaster, updateBillSundryMaster, deleteBillSundryMaster } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);

  const filtered = (billSundryMasters || []).filter((b: any) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );
  const ledgerAccounts = (accounts || []).filter((a: any) => !a.isGroup);

  const resetForm = () => { setForm(DEFAULT_FORM as any); setSelected(null); setShowForm(false); };

  const handleEdit = (b: any) => {
    setSelected(b);
    setForm({
      name: b.name || "", alias: b.alias || "", type: b.type || "additive",
      nature: b.nature || "percentage", accountHeadId: b.accountHeadId || "",
      defaultValue: b.defaultValue || 0, affectsCostInSale: !!b.affectsCostInSale,
      affectsCostInPurchase: b.affectsCostInPurchase !== false,
      adjustInPartyAmount: b.adjustInPartyAmount !== false, applicableOn: b.applicableOn || "nett_bill",
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return alert("Name is required.");
    if (selected) {
      await updateBillSundryMaster(selected.id, form);
      alert("Bill Sundry updated.");
    } else {
      await addBillSundryMaster(form);
      alert("Bill Sundry saved.");
    }
    resetForm();
  };

  return (
    <div style={{ display: "flex", height: "100%", gap: 0 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: showForm ? BORDER : "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: BORDER, background: BG_HEADER }}>
          <FileText style={{ width: 16, height: 16 }} />
          <span style={{ fontWeight: 700, fontSize: 13 }}>Bill Sundry Master</span>
          <div style={{ flex: 1 }} />
          <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...INPUT_STYLE, width: 180 }} />
          <button style={BTN("#3D6B25")} onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />Add Sundry
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: BG_HEADER, position: "sticky", top: 0 }}>
                {["#", "Name", "Type", "Nature", "Default Value", "Account Head", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "6px 10px", borderBottom: BORDER, textAlign: "left", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "#666" }}>No bill sundries defined. Examples: Freight, Discount, Packaging charges.</td></tr>
              ) : (
                filtered.map((b: any, i: number) => (
                  <tr key={b.id} style={{ background: i % 2 === 0 ? "#fff" : BG_ROW_ALT }}>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{i + 1}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER, fontWeight: 600 }}>{b.name}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>
                      <span style={{ color: b.type === "additive" ? "#2E7D32" : "#C62828", fontWeight: 600 }}>
                        {b.type === "additive" ? "▲ Addition" : "▼ Deduction"}
                      </span>
                    </td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{b.nature}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{b.defaultValue || 0}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{ledgerAccounts.find((a: any) => a.id === b.accountHeadId)?.name || "—"}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={BTN("#fff")} onClick={() => handleEdit(b)}><Edit2 style={{ width: 12, height: 12 }} /></button>
                        <button style={{ ...BTN("#fff"), color: "#c00" }} onClick={async () => { if (confirm("Delete?")) await deleteBillSundryMaster(b.id); }}><Trash2 style={{ width: 12, height: 12 }} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "4px 12px", borderTop: BORDER, background: BG_HEADER, fontSize: 11 }}>Total: {filtered.length} sundry(ies)</div>
      </div>

      {showForm && (
        <div style={{ width: 360, borderLeft: BORDER, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", background: BG_HEADER, borderBottom: BORDER }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{selected ? "Edit" : "Add"} Bill Sundry</span>
            <button style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer" }} onClick={resetForm}><X style={{ width: 16, height: 16 }} /></button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {[{ label: "Name *", key: "name" }, { label: "Alias", key: "alias" }].map(({ label, key }) => (
              <label key={key} style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>{label}</div>
                <input value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} style={INPUT_STYLE} />
              </label>
            ))}
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Sundry Type</div>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })} style={INPUT_STYLE}>
                <option value="additive">Addition (charge added to bill)</option>
                <option value="subtractive">Deduction (discount/reduction)</option>
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Amount Nature</div>
              <select value={form.nature} onChange={(e) => setForm({ ...form, nature: e.target.value as any })} style={INPUT_STYLE}>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount</option>
                <option value="per_unit">Per Unit</option>
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Applicable On</div>
              <select value={form.applicableOn} onChange={(e) => setForm({ ...form, applicableOn: e.target.value as any })} style={INPUT_STYLE}>
                <option value="nett_bill">Nett Bill Amount</option>
                <option value="basic_amount">Basic Amount</option>
                <option value="taxable_amount">Taxable Amount</option>
                <option value="previous_sundry">Previous Sundry Amount</option>
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Default Value</div>
              <input type="number" min="0" step="0.01" value={form.defaultValue}
                onChange={(e) => setForm({ ...form, defaultValue: parseFloat(e.target.value) || 0 })} style={INPUT_STYLE} />
            </label>
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Account Head to Post</div>
              <select value={form.accountHeadId} onChange={(e) => setForm({ ...form, accountHeadId: e.target.value })} style={INPUT_STYLE}>
                <option value="">— Select Account —</option>
                {ledgerAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            {[
              { label: "Affects Cost in Sale", key: "affectsCostInSale" },
              { label: "Affects Cost in Purchase", key: "affectsCostInPurchase" },
              { label: "Adjust in Party Amount", key: "adjustInPartyAmount" },
            ].map(({ label, key }) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <input type="checkbox" checked={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderTop: BORDER, background: BG_HEADER }}>
            <button style={BTN("#3D6B25")} onClick={handleSubmit}><Save style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />{selected ? "Update" : "Save"}</button>
            <button style={BTN("#fff")} onClick={resetForm}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
