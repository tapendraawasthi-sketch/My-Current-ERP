// @ts-nocheck
import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { Plus, Edit2, Trash2, Layers, X, Save } from "lucide-react";

const BORDER = "1px solid #000";
const BG_HEADER = "#D4EABD";
const BG_ROW_ALT = "#F5FAF0";
const INPUT_STYLE: React.CSSProperties = {
  width: "100%", padding: "5px 8px", border: BORDER, borderRadius: 3,
  fontSize: 12, background: "#fff", outline: "none",
};
const BTN = (bg: string): React.CSSProperties => ({
  padding: "5px 14px", background: bg, border: BORDER, borderRadius: 3,
  fontSize: 12, fontWeight: 600, cursor: "pointer", color: bg === "#fff" ? "#000" : "#fff",
});

const DEFAULT_FORM = {
  name: "", alias: "", isPrimary: false, underGroupId: "",
  stockAccountId: "", salesAccountId: "", purchaseAccountId: "",
  hsnCode: "", taxCategoryId: "",
};

export default function ItemGroupMaster() {
  const { itemGroups, taxCategories, accounts, addItemGroup, updateItemGroup, deleteItemGroup } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);

  const filtered = (itemGroups || []).filter((g: any) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  const ledgerAccounts = (accounts || []).filter((a: any) => !a.isGroup);

  const resetForm = () => { setForm(DEFAULT_FORM); setSelected(null); setShowForm(false); };

  const handleEdit = (g: any) => {
    setSelected(g);
    setForm({
      name: g.name || "", alias: g.alias || "", isPrimary: g.isPrimary || false,
      underGroupId: g.underGroupId || "", stockAccountId: g.stockAccountId || "",
      salesAccountId: g.salesAccountId || "", purchaseAccountId: g.purchaseAccountId || "",
      hsnCode: g.hsnCode || "", taxCategoryId: g.taxCategoryId || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return alert("Group Name is required.");
    if (selected) {
      await updateItemGroup(selected.id, form);
      alert("Item Group updated.");
    } else {
      await addItemGroup(form);
      alert("Item Group saved.");
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this item group?")) return;
    await deleteItemGroup(id);
  };

  return (
    <div style={{ display: "flex", height: "100%", gap: 0 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: showForm ? BORDER : "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: BORDER, background: BG_HEADER }}>
          <Layers style={{ width: 16, height: 16 }} />
          <span style={{ fontWeight: 700, fontSize: 13 }}>Item Group Master</span>
          <div style={{ flex: 1 }} />
          <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...INPUT_STYLE, width: 180 }} />
          <button style={BTN("#3D6B25")} onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />Add Group
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: BG_HEADER, position: "sticky", top: 0 }}>
                {["#", "Group Name", "Alias", "Primary?", "Parent Group", "HSN Code", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "6px 10px", borderBottom: BORDER, textAlign: "left", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "#666" }}>No item groups found. Click "Add Group" to create one.</td></tr>
              ) : (
                filtered.map((g: any, i: number) => (
                  <tr key={g.id} style={{ background: i % 2 === 0 ? "#fff" : BG_ROW_ALT }}>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{i + 1}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER, fontWeight: 600 }}>{g.name}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{g.alias || "—"}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{g.isPrimary ? "Yes" : "No"}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{g.underGroupId ? (itemGroups || []).find((p: any) => p.id === g.underGroupId)?.name || g.underGroupId : "—"}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{g.hsnCode || "—"}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={BTN("#fff")} onClick={() => handleEdit(g)}><Edit2 style={{ width: 12, height: 12 }} /></button>
                        <button style={{ ...BTN("#fff"), color: "#c00" }} onClick={() => handleDelete(g.id)}><Trash2 style={{ width: 12, height: 12 }} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "4px 12px", borderTop: BORDER, background: BG_HEADER, fontSize: 11 }}>Total: {filtered.length} group(s)</div>
      </div>

      {showForm && (
        <div style={{ width: 360, borderLeft: BORDER, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", background: BG_HEADER, borderBottom: BORDER }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{selected ? "Edit" : "Add"} Item Group</span>
            <button style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer" }} onClick={resetForm}><X style={{ width: 16, height: 16 }} /></button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {[{ label: "Group Name *", key: "name" }, { label: "Alias", key: "alias" }, { label: "HSN Code", key: "hsnCode" }].map(({ label, key }) => (
              <label key={key} style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>{label}</div>
                <input value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} style={INPUT_STYLE} />
              </label>
            ))}
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked, underGroupId: "" })} />
              <span>Primary Group (top-level)</span>
            </label>
            {!form.isPrimary && (
              <label style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>Under Group</div>
                <select value={form.underGroupId} onChange={(e) => setForm({ ...form, underGroupId: e.target.value })} style={INPUT_STYLE}>
                  <option value="">— Select Parent —</option>
                  {(itemGroups || []).filter((g: any) => g.id !== selected?.id).map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>
            )}
            {[
              { label: "Stock Account", key: "stockAccountId" },
              { label: "Sales Account", key: "salesAccountId" },
              { label: "Purchase Account", key: "purchaseAccountId" },
            ].map(({ label, key }) => (
              <label key={key} style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>{label}</div>
                <select value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} style={INPUT_STYLE}>
                  <option value="">— None —</option>
                  {ledgerAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
            ))}
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Tax Category</div>
              <select value={form.taxCategoryId} onChange={(e) => setForm({ ...form, taxCategoryId: e.target.value })} style={INPUT_STYLE}>
                <option value="">— None —</option>
                {(taxCategories || []).map((tc: any) => <option key={tc.id} value={tc.id}>{tc.name}</option>)}
              </select>
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
