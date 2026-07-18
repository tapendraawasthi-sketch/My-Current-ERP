// @ts-nocheck
import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { RefreshCw, CheckSquare } from "lucide-react";
import { useBranchFilter } from "../hooks/useBranchFilter";

const BORDER = "1px solid #000";
const BG_HEADER = "var(--ds-surface-hover)";
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

const BULK_OPERATIONS = [
  {
    category: "Masters",
    ops: [
      {
        id: "update-print-name",
        label: "Update Master Print Name",
        desc: "Bulk update the Print Name field across selected account/item masters.",
      },
      {
        id: "merge-masters",
        label: "Merge Masters",
        desc: "Merge two account or item masters — combines all transactions and removes the source.",
      },
      {
        id: "delete-unused",
        label: "Delete Unused Masters",
        desc: "Auto-identify and delete masters with no transactions, balances, or references.",
      },
      {
        id: "update-item-tax",
        label: "Update Item Tax Category",
        desc: "Bulk assign or change tax category for multiple items simultaneously.",
      },
      {
        id: "update-critical-levels",
        label: "Update Item Critical Levels",
        desc: "Bulk update minimum stock levels for multiple items.",
      },
      {
        id: "update-item-price",
        label: "Update Item Price/Discount",
        desc: "Bulk update sale/purchase prices or discount percentages (supports % increase/decrease).",
      },
      {
        id: "update-item-disc-structure",
        label: "Update Item Discount Structure",
        desc: "Bulk assign or change the discount structure linked to multiple items.",
      },
      {
        id: "block-account-item",
        label: "Block Account/Item",
        desc: "Block specific accounts/items from new transactions while preserving history.",
      },
    ],
  },
  {
    category: "Vouchers",
    ops: [
      {
        id: "bulk-payments",
        label: "Bulk Payments",
        desc: "Process multiple payment vouchers simultaneously — pay multiple suppliers in one batch.",
      },
      {
        id: "bulk-receipts",
        label: "Bulk Receipts",
        desc: "Receive payments from multiple customers at once.",
      },
      {
        id: "voucher-replication",
        label: "Voucher Replication",
        desc: "Replicate an existing voucher with a new date/number — useful for recurring transactions.",
      },
      {
        id: "copy-sales-to-purchase",
        label: "Copy Vouchers (Sales to Purchase)",
        desc: "Copy a sales voucher and create a corresponding purchase voucher.",
      },
    ],
  },
  {
    category: "Communication",
    ops: [
      {
        id: "bulk-email-sms",
        label: "Offline Email/SMS Dispatch",
        desc: "Send bulk emails/SMS to parties in batch mode — statements, reminders, notices.",
      },
    ],
  },
];

export default function BulkUpdations() {
  const { items, accounts } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const branchItems = items.filter((item) => matchBranch((item as any).branchId));
  const branchAccounts = accounts.filter((acc) => matchBranch((acc as any).branchId));
  const [activeOp, setActiveOp] = useState<string | null>(null);
  const [priceUpdateForm, setPriceUpdateForm] = useState({
    type: "percentage",
    value: 0,
    field: "salesRate",
    applyTo: "all",
  });
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const handleRun = (opId: string) => {
    if (opId === "update-item-price") {
      setActiveOp("update-item-price");
      return;
    }
    if (opId === "delete-unused") {
      const unusedAccounts = branchAccounts.filter(
        (a: any) =>
          !a.isSystemAccount && !a.isGroup && (a.balance === 0 || a.balance === undefined),
      );
      alert(
        `Found ${unusedAccounts.length} potentially unused ledger accounts with zero balance.\n\nReview and manually delete from Chart of Accounts if safe.\n\nNote: Full automated deletion with transaction checks will be implemented as part of backend integration.`,
      );
      return;
    }
    alert(
      `${BULK_OPERATIONS.flatMap((c) => c.ops).find((o) => o.id === opId)?.label}\n\nThis bulk operation panel is ready for full implementation.\nConnect to store actions and render the appropriate batch-edit UI here.`,
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
        <RefreshCw style={{ width: 16, height: 16 }} />
        <span style={{ fontWeight: 700, fontSize: 14 }}>Bulk Updations</span>
        <span style={{ fontSize: 11, color: "#555", marginLeft: 8 }}>
          Batch operations for masters and vouchers
        </span>
        {branchOptions.length > 0 && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] ml-auto"
            aria-label="Branch"
          >
            <option value="all">All branches</option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name || b.code || b.id}
              </option>
            ))}
          </select>
        )}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {activeOp === "update-item-price" && (
          <div
            style={{
              border: BORDER,
              borderRadius: 4,
              padding: 16,
              marginBottom: 20,
              background: "#FFFDE7",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>
              Update Item Price / Discount
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <label style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>Field to Update</div>
                <select
                  value={priceUpdateForm.field}
                  onChange={(e) =>
                    setPriceUpdateForm({ ...priceUpdateForm, field: e.target.value })
                  }
                  style={{ padding: "5px 8px", border: BORDER, borderRadius: 3, fontSize: 12 }}
                >
                  <option value="salesRate">Sale Price</option>
                  <option value="purchaseRate">Purchase Price</option>
                  <option value="mrp">MRP</option>
                </select>
              </label>
              <label style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>Update Type</div>
                <select
                  value={priceUpdateForm.type}
                  onChange={(e) => setPriceUpdateForm({ ...priceUpdateForm, type: e.target.value })}
                  style={{ padding: "5px 8px", border: BORDER, borderRadius: 3, fontSize: 12 }}
                >
                  <option value="percentage">% Increase/Decrease</option>
                  <option value="absolute">Set Absolute Value</option>
                </select>
              </label>
              <label style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>
                  {priceUpdateForm.type === "percentage" ? "Percentage" : "New Value"}
                </div>
                <input
                  type="number"
                  value={priceUpdateForm.value}
                  onChange={(e) =>
                    setPriceUpdateForm({
                      ...priceUpdateForm,
                      value: parseFloat(e.target.value) || 0,
                    })
                  }
                  style={{
                    padding: "5px 8px",
                    border: BORDER,
                    borderRadius: 3,
                    fontSize: 12,
                    width: 100,
                  }}
                />
              </label>
              <label style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>Apply To</div>
                <select
                  value={priceUpdateForm.applyTo}
                  onChange={(e) =>
                    setPriceUpdateForm({ ...priceUpdateForm, applyTo: e.target.value })
                  }
                  style={{ padding: "5px 8px", border: BORDER, borderRadius: 3, fontSize: 12 }}
                >
                  <option value="all">All Items</option>
                  <option value="selected">Selected Items Only</option>
                </select>
              </label>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={BTN("var(--ds-action-primary-hover)")}
                onClick={() => {
                  const count =
                    priceUpdateForm.applyTo === "all"
                      ? branchItems.length
                      : selectedItems.filter((id) =>
                          branchItems.some((item) => item.id === id),
                        ).length;
                  alert(
                    `Price update preview:\n• Field: ${priceUpdateForm.field}\n• Type: ${priceUpdateForm.type}\n• Value: ${priceUpdateForm.value}\n• Will affect ${count} item(s)\n\nTo implement: loop through items, apply calculation, call updateItem() for each.`,
                  );
                }}
              >
                Preview & Apply
              </button>
              <button style={BTN("#fff")} onClick={() => setActiveOp(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {BULK_OPERATIONS.map((cat) => (
          <div key={cat.category} style={{ marginBottom: 20 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
                color: "#555",
                borderBottom: BORDER,
                paddingBottom: 4,
              }}
            >
              {cat.category}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 10,
              }}
            >
              {cat.ops.map((op) => (
                <div
                  key={op.id}
                  style={{
                    border: BORDER,
                    borderRadius: 4,
                    padding: 12,
                    background: "#fff",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <CheckSquare style={{ width: 14, height: 14, marginTop: 1, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12 }}>{op.label}</div>
                      <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{op.desc}</div>
                    </div>
                  </div>
                  <button
                    style={{ ...BTN("#fff"), alignSelf: "flex-start", fontSize: 11 }}
                    onClick={() => handleRun(op.id)}
                  >
                    Run →
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
