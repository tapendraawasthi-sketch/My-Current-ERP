// @ts-nocheck
import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { Plus, Edit2, Trash2, TrendingDown, X, Save } from "lucide-react";

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
  region: "local",
  taxationType: "taxable_voucherwise",
  taxRate: 13,
  surcharge: 0,
  addlCess: 0,
  purchaseAccountId: "",
  invoiceHeading: "",
  invoiceDescription: "",
  freezeTax: false,
  skipVatReports: false,
  isCapitalPurchase: false,
};

const TAX_TYPES = [
  { value: "taxable_voucherwise", label: "Taxable (Voucher-wise)" },
  { value: "taxable_itemwise", label: "Taxable (Item-wise)" },
  { value: "exempt", label: "Exempt" },
  { value: "tax_free", label: "Tax Free" },
  { value: "nil_rated", label: "Nil Rated" },
];

export default function PurchaseTypeMaster() {
  const { purchaseTypes, accounts, addPurchaseType, updatePurchaseType, deletePurchaseType } =
    useStore();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);

  const filtered = (purchaseTypes || []).filter((s: any) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );
  const purchaseAccounts = (accounts || []).filter(
    (a: any) =>
      !a.isGroup &&
      (a.type === "expense" || a.type === "asset" || a.name?.toLowerCase().includes("purchase")),
  );

  const resetForm = () => {
    setForm(DEFAULT_FORM as any);
    setSelected(null);
    setShowForm(false);
  };

  const handleEdit = (s: any) => {
    setSelected(s);
    setForm({
      name: s.name || "",
      region: s.region || "local",
      taxationType: s.taxationType || "taxable_voucherwise",
      taxRate: s.taxRate ?? 13,
      surcharge: s.surcharge ?? 0,
      addlCess: s.addlCess ?? 0,
      purchaseAccountId: s.purchaseAccountId || "",
      invoiceHeading: s.invoiceHeading || "",
      invoiceDescription: s.invoiceDescription || "",
      freezeTax: !!s.freezeTax,
      skipVatReports: !!s.skipVatReports,
      isCapitalPurchase: !!s.isCapitalPurchase,
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return alert("Purchase Type name is required.");
    if (selected) {
      await updatePurchaseType(selected.id, form);
      alert("Purchase Type updated.");
    } else {
      await addPurchaseType(form);
      alert("Purchase Type saved.");
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
          <TrendingDown style={{ width: 16, height: 16 }} />
          <span style={{ fontWeight: 700, fontSize: 13 }}>Purchase Type Master</span>
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
            Add Purchase Type
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: BG_HEADER, position: "sticky", top: 0 }}>
                {[
                  "#",
                  "Purchase Type Name",
                  "Region",
                  "Taxation",
                  "Tax Rate (%)",
                  "Freeze Tax",
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
                    No purchase types defined. Examples: VAT/13%, VAT/Exempt, Capital Goods.
                  </td>
                </tr>
              ) : (
                filtered.map((s: any, i: number) => (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? "#fff" : BG_ROW_ALT }}>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{i + 1}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER, fontWeight: 600 }}>
                      {s.name}
                    </td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{s.region}</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>
                      {TAX_TYPES.find((t) => t.value === s.taxationType)?.label || s.taxationType}
                    </td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>{s.taxRate}%</td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>
                      {s.freezeTax ? "Yes" : "No"}
                    </td>
                    <td style={{ padding: "5px 10px", borderBottom: BORDER }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={BTN("#fff")} onClick={() => handleEdit(s)}>
                          <Edit2 style={{ width: 12, height: 12 }} />
                        </button>
                        <button
                          style={{ ...BTN("#fff"), color: "#c00" }}
                          onClick={async () => {
                            if (confirm("Delete?")) await deletePurchaseType(s.id);
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
          Total: {filtered.length} purchase type(s)
        </div>
      </div>

      {showForm && (
        <div style={{ width: 360, borderLeft: BORDER, display: "flex", flexDirection: "column" }}>
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
              {selected ? "Edit" : "Add"} Purchase Type
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
              gap: 10,
            }}
          >
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Purchase Type Name *</div>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={INPUT_STYLE}
                placeholder="e.g. VAT/13%, Exempt, Capital Goods"
              />
            </label>
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Region</div>
              <select
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value as any })}
                style={INPUT_STYLE}
              >
                <option value="local">Local</option>
                <option value="import">Import</option>
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Taxation Type</div>
              <select
                value={form.taxationType}
                onChange={(e) => setForm({ ...form, taxationType: e.target.value as any })}
                style={INPUT_STYLE}
              >
                {TAX_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            {["taxable_voucherwise", "taxable_itemwise"].includes(form.taxationType) && (
              <>
                <label style={{ fontSize: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 3 }}>Tax Rate (%)</div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.taxRate}
                    onChange={(e) => setForm({ ...form, taxRate: parseFloat(e.target.value) || 0 })}
                    style={INPUT_STYLE}
                  />
                </label>
                <label style={{ fontSize: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 3 }}>Surcharge (%)</div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.surcharge}
                    onChange={(e) =>
                      setForm({ ...form, surcharge: parseFloat(e.target.value) || 0 })
                    }
                    style={INPUT_STYLE}
                  />
                </label>
              </>
            )}
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Purchase Account</div>
              <select
                value={form.purchaseAccountId}
                onChange={(e) => setForm({ ...form, purchaseAccountId: e.target.value })}
                style={INPUT_STYLE}
              >
                <option value="">— Select Account —</option>
                {(accounts || [])
                  .filter((a: any) => !a.isGroup)
                  .map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Invoice Heading</div>
              <input
                value={form.invoiceHeading}
                onChange={(e) => setForm({ ...form, invoiceHeading: e.target.value })}
                style={INPUT_STYLE}
              />
            </label>
            <label style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>Invoice Description</div>
              <input
                value={form.invoiceDescription}
                onChange={(e) => setForm({ ...form, invoiceDescription: e.target.value })}
                style={INPUT_STYLE}
              />
            </label>
            {[
              { label: "Freeze Tax in Purchase", key: "freezeTax" },
              { label: "Skip in VAT Reports", key: "skipVatReports" },
            ].map(({ label, key }) => (
              <label
                key={key}
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
              >
                <input
                  type="checkbox"
                  checked={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                />
                <span>{label}</span>
              </label>
            ))}
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={form.isCapitalPurchase}
                onChange={(e) => setForm({ ...form, isCapitalPurchase: e.target.checked })}
              />
              <span>Capital Purchase</span>
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
