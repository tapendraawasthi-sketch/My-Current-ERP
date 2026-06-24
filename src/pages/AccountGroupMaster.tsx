// @ts-nocheck
import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { Plus, Edit2, Trash2, FolderOpen, X, Save } from "lucide-react";

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

export default function AccountGroupMaster() {
  const { accounts } = useStore();

  // Derive account groups from existing accounts store (accounts with isGroup=true)
  const groups = accounts.filter((a) => a.isGroup);

  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "", alias: "", isPrimary: false, underGroupId: "", type: "asset",
  });

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setForm({ name: "", alias: "", isPrimary: false, underGroupId: "", type: "asset" });
    setSelected(null);
    setShowForm(false);
  };

  const handleEdit = (g: any) => {
    setSelected(g);
    setForm({
      name: g.name || "",
      alias: g.alias || "",
      isPrimary: !g.parentId,
      underGroupId: g.parentId || "",
      type: g.type || "asset",
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return alert("Group Name is required.");
    alert(selected ? `Account Group "${form.name}" updated.` : `Account Group "${form.name}" saved.\n\nNote: To persist changes, wire this form to addAccount/updateAccount store actions with isGroup=true.`);
    resetForm();
  };

  return (
    <div style={{ display: "flex", height: "100%", gap: 0 }}>
      {/* List Panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: BORDER }}>
        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: BORDER, background: BG_HEADER }}>
          <FolderOpen style={{ width: 16, height: 16 }} />
          <span style={{ fontWeight: 700, fontSize: 13 }}>Account Group Master</span>
          <div style={{ flex: 1 }} />
          <input
            placeholder="Search groups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...INPUT_STYLE, width: 180 }}
          />
          <button style={BTN("#3D6B25")} onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />Add Group
          </button>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: BG_HEADER, position: "sticky", top: 0 }}>
                {["#", "Group Name", "Parent Group", "Type", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "6px 10px", borderBottom: BORDER, textAlign: "left", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, color: "#666" }}>No account groups found.</td></tr>
              ) : (
                filtered.map((g, i) => (
                  <tr key={g.id} style={{ background: i % 2 === 0 ? "#fff" : BG_ROW_ALT }}>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{i + 1}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER, fontWeight: 600 }}>{g.name}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>
                      {g.parentId ? groups.find((p) => p.id === g.parentId)?.name || g.parentId : "—"}
                    </td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{g.type}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={BTN("#fff")} onClick={() => handleEdit(g)}><Edit2 style={{ width: 12, height: 12 }} /></button>
                        <button style={{ ...BTN("#fff"), color: "#c00" }} onClick={() => alert("Delete: Use deleteAccount from store (only if no child accounts exist).")}><Trash2 style={{ width: 12, height: 12 }} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "4px 12px", borderTop: BORDER, background: BG_HEADER, fontSize: 11 }}>
          Total: {filtered.length} group(s)
        </div>
      </div>

      {/* Form Panel */}
      {showForm && (
        <div style={{ width: 340, borderLeft: BORDER, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", background: BG_HEADER, borderBottom: BORDER }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{selected ? "Edit" : "Add"} Account Group</span>
            <button style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer" }} onClick={resetForm}><X style={{ width: 16, height: 16 }} /></button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Group Name *", key: "name", type: "text" },
              { label: "Alias", key: "alias", type: "text" },
            ].map(({ label, key, type }) => (
              <label key={key} style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>{label}</div>
                <input type={type} value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} style={INPUT_STYLE} />
              </label>
            ))}
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Account Type</div>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={INPUT_STYLE}>
                {["asset", "liability", "equity", "income", "expense"].map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked, underGroupId: e.target.checked ? "" : form.underGroupId })} />
              <span>Primary Group (top-level)</span>
            </label>
            {!form.isPrimary && (
              <label style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>Under Group</div>
                <select value={form.underGroupId} onChange={(e) => setForm({ ...form, underGroupId: e.target.value })} style={INPUT_STYLE}>
                  <option value="">— Select Parent —</option>
                  {groups.filter((g) => g.id !== selected?.id).map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </label>
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
