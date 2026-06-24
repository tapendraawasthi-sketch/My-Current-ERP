// @ts-nocheck
import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { Plus, Edit2, Trash2, BookOpen, X, Save } from "lucide-react";

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

const VOUCHER_TYPES = ["All", "Payment", "Receipt", "Purchase", "Sales", "Sales Return", "Purchase Return", "Journal", "Stock Transfer", "Contra"];
const DEFAULT_FORM = { voucherType: "All", narration: "" };

export default function StandardNarrationMaster() {
  const { standardNarrations, addStandardNarration, updateStandardNarration, deleteStandardNarration } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [form, setForm] = useState(DEFAULT_FORM);

  const filtered = (standardNarrations || []).filter((sn: any) => {
    const matchSearch = sn.narration.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "All" || sn.voucherType === filterType;
    return matchSearch && matchType;
  });

  const resetForm = () => { setForm(DEFAULT_FORM); setSelected(null); setShowForm(false); };

  const handleEdit = (sn: any) => {
    setSelected(sn);
    setForm({ voucherType: sn.voucherType || "All", narration: sn.narration || "" });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.narration.trim()) return alert("Narration text is required.");
    if (selected) {
      await updateStandardNarration(selected.id, form);
      alert("Narration updated.");
    } else {
      await addStandardNarration(form);
      alert("Narration saved.");
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this narration?")) return;
    await deleteStandardNarration(id);
  };

  return (
    <div style={{ display: "flex", height: "100%", gap: 0 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: showForm ? BORDER : "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: BORDER, background: BG_HEADER }}>
          <BookOpen style={{ width: 16, height: 16 }} />
          <span style={{ fontWeight: 700, fontSize: 13 }}>Standard Narration Master</span>
          <div style={{ flex: 1 }} />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ ...INPUT_STYLE, width: 130 }}>
            {VOUCHER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input placeholder="Search narrations..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...INPUT_STYLE, width: 180 }} />
          <button style={BTN("#3D6B25")} onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />Add Narration
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: BG_HEADER, position: "sticky", top: 0 }}>
                {["#", "Voucher Type", "Narration Text", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "6px 10px", borderBottom: BORDER, textAlign: "left", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: "center", padding: 24, color: "#666" }}>No narrations found. Add standard narrations to speed up voucher entry.</td></tr>
              ) : (
                filtered.map((sn: any, i: number) => (
                  <tr key={sn.id} style={{ background: i % 2 === 0 ? "#fff" : BG_ROW_ALT }}>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{i + 1}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>
                      <span style={{ padding: "2px 8px", background: BG_HEADER, border: BORDER, borderRadius: 10, fontSize: 10 }}>{sn.voucherType}</span>
                    </td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{sn.narration}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={BTN("#fff")} onClick={() => handleEdit(sn)}><Edit2 style={{ width: 12, height: 12 }} /></button>
                        <button style={{ ...BTN("#fff"), color: "#c00" }} onClick={() => handleDelete(sn.id)}><Trash2 style={{ width: 12, height: 12 }} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "4px 12px", borderTop: BORDER, background: BG_HEADER, fontSize: 11 }}>Total: {filtered.length} narration(s)</div>
      </div>

      {showForm && (
        <div style={{ width: 340, borderLeft: BORDER, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", background: BG_HEADER, borderBottom: BORDER }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{selected ? "Edit" : "Add"} Standard Narration</span>
            <button style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer" }} onClick={resetForm}><X style={{ width: 16, height: 16 }} /></button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Voucher Type</div>
              <select value={form.voucherType} onChange={(e) => setForm({ ...form, voucherType: e.target.value })} style={INPUT_STYLE}>
                {VOUCHER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Narration Text *</div>
              <textarea
                value={form.narration}
                onChange={(e) => setForm({ ...form, narration: e.target.value })}
                rows={5}
                style={{ ...INPUT_STYLE, resize: "vertical" }}
                placeholder="Enter the standard narration text..."
              />
            </label>
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
