// @ts-nocheck
import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { Plus, Edit2, Trash2, Tags, X, Save } from "lucide-react";

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
  discountType: "simple",
  amountType: "percentage",
  percentageOn: "item_price",
  caption: "Discount",
  noOfDiscounts: 1,
};

export default function DiscountStructureMaster() {
  const {
    discountStructures,
    addDiscountStructure,
    updateDiscountStructure,
    deleteDiscountStructure,
  } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);

  const filtered = (discountStructures || []).filter((d: any) =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  );

  const resetForm = () => {
    setForm(DEFAULT_FORM as any);
    setSelected(null);
    setShowForm(false);
  };
  const handleEdit = (d: any) => {
    setSelected(d);
    setForm({
      name: d.name || "",
      discountType: d.discountType || "simple",
      amountType: d.amountType || "percentage",
      percentageOn: d.percentageOn || "item_price",
      caption: d.caption || "Discount",
      noOfDiscounts: d.noOfDiscounts || 1,
    });
    setShowForm(true);
  };
  const handleSubmit = async () => {
    if (!form.name.trim()) return alert("Structure name is required.");
    if (selected) {
      await updateDiscountStructure(selected.id, form);
      alert("Discount Structure updated.");
    } else {
      await addDiscountStructure(form);
      alert("Discount Structure saved.");
    }
    resetForm();
  };

  const discountTypeLabel = (v: string) =>
    ({
      simple: "Simple",
      compound_same: "Compound (Same Nature)",
      compound_different: "Compound (Different Nature)",
    })[v] || v;

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
          <Tags style={{ width: 16, height: 16 }} />
          <span style={{ fontWeight: 700, fontSize: 13 }}>Discount Structure Master</span>
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
            Add Structure
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: BG_HEADER, position: "sticky", top: 0 }}>
                {[
                  "#",
                  "Structure Name",
                  "Discount Type",
                  "Amount Type",
                  "Calculated On",
                  "Caption",
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
                  <td colSpan={7} style={{ textAlign: "center", padding: 24, color: "#666" }}>
                    No discount structures defined. Create reusable discount templates here.
                  </td>
                </tr>
              ) : (
                filtered.map((d: any, i: number) => (
                  <tr key={d.id} style={{ background: i % 2 === 0 ? "#fff" : BG_ROW_ALT }}>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{i + 1}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER, fontWeight: 600 }}>
                      {d.name}
                    </td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>
                      {discountTypeLabel(d.discountType)}
                    </td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{d.amountType}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>
                      {d.percentageOn?.replace(/_/g, " ") || "—"}
                    </td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>
                      {d.caption || "Discount"}
                    </td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={BTN("#fff")} onClick={() => handleEdit(d)}>
                          <Edit2 style={{ width: 12, height: 12 }} />
                        </button>
                        <button
                          style={{ ...BTN("#fff"), color: "#c00" }}
                          onClick={async () => {
                            if (confirm("Delete?")) await deleteDiscountStructure(d.id);
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
          Total: {filtered.length} structure(s)
        </div>
      </div>

      {showForm && (
        <div style={{ width: 350, borderLeft: BORDER, display: "flex", flexDirection: "column" }}>
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
              {selected ? "Edit" : "Add"} Discount Structure
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
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Structure Name *</div>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={INPUT_STYLE}
              />
            </label>
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Discount Type</div>
              <select
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value as any })}
                style={INPUT_STYLE}
              >
                <option value="simple">Simple Discount</option>
                <option value="compound_same">Compound Discount (Same Nature)</option>
                <option value="compound_different">Compound Discount (Different Nature)</option>
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Amount Type</div>
              <select
                value={form.amountType}
                onChange={(e) => setForm({ ...form, amountType: e.target.value as any })}
                style={INPUT_STYLE}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="absolute">Absolute Amount (Rs.)</option>
                <option value="per_main_qty">Per Main Qty</option>
                <option value="per_pkg_qty">Per Packaging Qty</option>
              </select>
            </label>
            {form.amountType === "percentage" && (
              <label style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>Percentage Calculated On</div>
                <select
                  value={form.percentageOn}
                  onChange={(e) => setForm({ ...form, percentageOn: e.target.value as any })}
                  style={INPUT_STYLE}
                >
                  <option value="item_price">Item Price</option>
                  <option value="item_amount">Item Amount</option>
                  <option value="item_mrp">Item MRP</option>
                  <option value="item_list_price">Item List Price</option>
                </select>
              </label>
            )}
            {form.discountType !== "simple" && (
              <label style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>
                  No. of Discount Levels (Max 5)
                </div>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={form.noOfDiscounts}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      noOfDiscounts: Math.min(5, Math.max(1, parseInt(e.target.value) || 1)),
                    })
                  }
                  style={INPUT_STYLE}
                />
              </label>
            )}
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Caption (label on invoice)</div>
              <input
                value={form.caption}
                onChange={(e) => setForm({ ...form, caption: e.target.value })}
                style={INPUT_STYLE}
                placeholder="Discount"
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
