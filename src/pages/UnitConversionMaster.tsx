// @ts-nocheck
import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { Plus, Edit2, Trash2, ArrowLeftRight, X, Save } from "lucide-react";

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

const DEFAULT_FORM = { mainUnit: "", subUnit: "", conversionFactor: 1 };

export default function UnitConversionMaster() {
  const { units, unitConversions, addUnitConversion, updateUnitConversion, deleteUnitConversion } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);

  const filtered = (unitConversions || []).filter((uc: any) =>
    `${uc.mainUnit} ${uc.subUnit}`.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => { setForm(DEFAULT_FORM); setSelected(null); setShowForm(false); };

  const handleEdit = (uc: any) => {
    setSelected(uc);
    setForm({ mainUnit: uc.mainUnit, subUnit: uc.subUnit, conversionFactor: uc.conversionFactor });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.mainUnit || !form.subUnit) return alert("Both units are required.");
    if (form.conversionFactor <= 0) return alert("Conversion factor must be greater than 0.");
    if (selected) {
      await updateUnitConversion(selected.id, form);
      alert("Unit Conversion updated.");
    } else {
      await addUnitConversion(form);
      alert("Unit Conversion saved.");
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this unit conversion?")) return;
    await deleteUnitConversion(id);
  };

  const unitNames = (units || []).map((u: any) => u.name || u.code);

  return (
    <div style={{ display: "flex", height: "100%", gap: 0 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: showForm ? BORDER : "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: BORDER, background: BG_HEADER }}>
          <ArrowLeftRight style={{ width: 16, height: 16 }} />
          <span style={{ fontWeight: 700, fontSize: 13 }}>Unit Conversion Master</span>
          <div style={{ flex: 1 }} />
          <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...INPUT_STYLE, width: 180 }} />
          <button style={BTN("#3D6B25")} onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />Add Conversion
          </button>
        </div>
        <div style={{ padding: "6px 12px", background: "#FFFDE7", borderBottom: BORDER, fontSize: 11, color: "#666" }}>
          ℹ Conversion Factor = Number of Sub Units per Main Unit (e.g., 1 Box = 12 Pcs → factor: 12)
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: BG_HEADER, position: "sticky", top: 0 }}>
                {["#", "Main Unit", "Sub Unit", "Conversion Factor", "Meaning", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "6px 10px", borderBottom: BORDER, textAlign: "left", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "#666" }}>No conversions defined. Click "Add Conversion" to get started.</td></tr>
              ) : (
                filtered.map((uc: any, i: number) => (
                  <tr key={uc.id} style={{ background: i % 2 === 0 ? "#fff" : BG_ROW_ALT }}>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{i + 1}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER, fontWeight: 600 }}>{uc.mainUnit}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{uc.subUnit}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{Number(uc.conversionFactor).toFixed(3)}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER, color: "#555" }}>1 {uc.mainUnit} = {uc.conversionFactor} {uc.subUnit}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={BTN("#fff")} onClick={() => handleEdit(uc)}><Edit2 style={{ width: 12, height: 12 }} /></button>
                        <button style={{ ...BTN("#fff"), color: "#c00" }} onClick={() => handleDelete(uc.id)}><Trash2 style={{ width: 12, height: 12 }} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "4px 12px", borderTop: BORDER, background: BG_HEADER, fontSize: 11 }}>Total: {filtered.length} conversion(s)</div>
      </div>

      {showForm && (
        <div style={{ width: 320, borderLeft: BORDER, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", background: BG_HEADER, borderBottom: BORDER }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{selected ? "Edit" : "Add"} Unit Conversion</span>
            <button style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer" }} onClick={resetForm}><X style={{ width: 16, height: 16 }} /></button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Main Unit *</div>
              <select value={form.mainUnit} onChange={(e) => setForm({ ...form, mainUnit: e.target.value })} style={INPUT_STYLE}>
                <option value="">— Select —</option>
                {unitNames.map((u: string) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Sub Unit *</div>
              <select value={form.subUnit} onChange={(e) => setForm({ ...form, subUnit: e.target.value })} style={INPUT_STYLE}>
                <option value="">— Select —</option>
                {unitNames.filter((u: string) => u !== form.mainUnit).map((u: string) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Conversion Factor *</div>
              <input type="number" min="0.001" step="0.001" value={form.conversionFactor}
                onChange={(e) => setForm({ ...form, conversionFactor: parseFloat(e.target.value) || 1 })} style={INPUT_STYLE} />
              <div style={{ fontSize: 10, color: "#888", marginTop: 3 }}>No. of Sub Units per Main Unit</div>
            </label>
            {form.mainUnit && form.subUnit && (
              <div style={{ padding: 10, background: "#E8F5E9", border: BORDER, borderRadius: 3, fontSize: 12, fontWeight: 600 }}>
                ✓ 1 {form.mainUnit} = {form.conversionFactor} {form.subUnit}
              </div>
            )}
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
