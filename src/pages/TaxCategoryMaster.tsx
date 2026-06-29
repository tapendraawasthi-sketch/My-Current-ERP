// @ts-nocheck
import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { Plus, Edit2, Trash2, FileBarChart, X, Save } from "lucide-react";

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

const DEFAULT_FORM = {
  name: "",
  localTaxRate: 0,
  exportTaxRate: 0,
  taxOnMrp: false,
  stockAccountId: "",
  zeroTaxType: "",
};

export default function TaxCategoryMaster() {
  const { taxCategories, accounts, addTaxCategory, updateTaxCategory, deleteTaxCategory } =
    useStore();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);

  const filtered = (taxCategories || []).filter((tc: any) =>
    tc.name.toLowerCase().includes(search.toLowerCase()),
  );

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setSelected(null);
    setShowForm(false);
  };
  const handleEdit = (tc: any) => {
    setSelected(tc);
    setForm({
      name: tc.name || "",
      localTaxRate: tc.localTaxRate ?? 0,
      exportTaxRate: tc.exportTaxRate ?? 0,
      taxOnMrp: !!tc.taxOnMrp,
      stockAccountId: tc.stockAccountId || "",
      zeroTaxType: tc.zeroTaxType || "",
    });
    setShowForm(true);
  };
  const handleSubmit = async () => {
    if (!form.name.trim()) return alert("Name is required.");
    if (selected) {
      await updateTaxCategory(selected.id, form);
      alert("Tax Category updated.");
    } else {
      await addTaxCategory(form);
      alert("Tax Category saved.");
    }
    resetForm();
  };

  return (
    <div style={{ display: "flex", height: "100%", gap: 0 }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          borderRight: showForm ? BORDER : "none",
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
          <FileBarChart style={{ width: 16, height: 16 }} />
          <span style={{ fontWeight: 700, fontSize: 13 }}>Tax Category Master</span>
          <div style={{ flex: 1 }} />
          <input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...INPUT_STYLE, width: 180 }}
          />
          <button
            style={BTN("#3D6B25")}
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            <Plus style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
            Add Category
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: BG_HEADER, position: "sticky", top: 0 }}>
                {[
                  "#",
                  "Category Name",
                  "Local Tax Rate (%)",
                  "Export/Import Rate (%)",
                  "Tax on MRP",
                  "Actions",
                ].map((h) => (
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "#666" }}>
                    No tax categories defined. Examples: 13%, Exempt, Services 14%.
                  </td>
                </tr>
              ) : (
                filtered.map((tc: any, i: number) => (
                  <tr key={tc.id} style={{ background: i % 2 === 0 ? "#fff" : BG_ROW_ALT }}>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{i + 1}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER, fontWeight: 600 }}>
                      {tc.name}
                    </td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>
                      {tc.localTaxRate}%
                    </td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>
                      {tc.exportTaxRate}%
                    </td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>
                      {tc.taxOnMrp ? "Yes" : "No"}
                    </td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={BTN("#fff")} onClick={() => handleEdit(tc)}>
                          <Edit2 style={{ width: 12, height: 12 }} />
                        </button>
                        <button
                          style={{ ...BTN("#fff"), color: "#c00" }}
                          onClick={async () => {
                            if (confirm("Delete?")) await deleteTaxCategory(tc.id);
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
          Total: {filtered.length} category(ies)
        </div>
      </div>

      {showForm && (
        <div style={{ width: 340, borderLeft: BORDER, display: "flex", flexDirection: "column" }}>
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
              {selected ? "Edit" : "Add"} Tax Category
            </span>
            <button
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
              onClick={resetForm}
            >
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Category Name *</div>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={INPUT_STYLE}
                placeholder="e.g. 13%, Exempt, Services 14%"
              />
            </label>
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Local Tax Rate (%)</div>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.localTaxRate}
                onChange={(e) =>
                  setForm({ ...form, localTaxRate: parseFloat(e.target.value) || 0 })
                }
                style={INPUT_STYLE}
              />
            </label>
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Export/Import Tax Rate (%)</div>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.exportTaxRate}
                onChange={(e) =>
                  setForm({ ...form, exportTaxRate: parseFloat(e.target.value) || 0 })
                }
                style={INPUT_STYLE}
              />
            </label>
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Stock Account</div>
              <select
                value={form.stockAccountId}
                onChange={(e) => setForm({ ...form, stockAccountId: e.target.value })}
                style={INPUT_STYLE}
              >
                <option value="">— None —</option>
                {(accounts || [])
                  .filter((a: any) => !a.isGroup)
                  .map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={form.taxOnMrp}
                onChange={(e) => setForm({ ...form, taxOnMrp: e.target.checked })}
              />
              <span>Tax on MRP (for multi-tax vouchers)</span>
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
            <button style={BTN("#3D6B25")} onClick={handleSubmit}>
              <Save style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
              {selected ? "Update" : "Save"}
            </button>
            <button style={BTN("#fff")} onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
