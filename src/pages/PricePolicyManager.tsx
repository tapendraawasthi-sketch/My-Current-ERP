// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import toast from "@/lib/appToast";
import * as XLSX from "xlsx";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  Plus,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  Download,
  Search,
  Filter,
} from "lucide-react";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

const BORDER = "1px solid #000";
const BG = "#E4F1D9";
const BG_CARD = "var(--ds-surface-muted)";
const BG_HEADER = "var(--ds-surface-hover)";
const BG_DEEP = "var(--ds-surface-muted)";
const BLOCKED_BG = "#fee2e2";
const WARNING_BG = "#fef9c3";
const OK_BG = "#dcfce7";

function money(v) {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

export function getPricePolicy(itemId, policies) {
  return policies.find((p) => p.itemId === itemId && p.isActive) || null;
}

export function checkPriceCompliance(itemId, sellingRate, discountPct, policies) {
  const policy = getPricePolicy(itemId, policies);
  if (!policy) return { ok: true };
  const belowFloor = policy.minSellingPrice > 0 && sellingRate < policy.minSellingPrice;
  const overDiscount = policy.maxDiscountPct > 0 && discountPct > policy.maxDiscountPct;
  if (!belowFloor && !overDiscount) return { ok: true };
  return {
    ok: false,
    enforcement: policy.enforcement,
    message: belowFloor
      ? `Selling price Rs.${sellingRate} is below floor Rs.${policy.minSellingPrice}`
      : `Discount ${discountPct}% exceeds maximum ${policy.maxDiscountPct}%`,
    type: belowFloor ? "below_floor" : "over_discount",
  };
}

export default function PricePolicyManager() {
  const { items, itemGroups, invoices, vouchers, companySettings, currentUser } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const [activeTab, setActiveTab] = useState("floor");
  const [pricePolicies, setPricePolicies] = useState([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({ groupId: "", marginPercent: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const [itemGroupFilter, setItemGroupFilter] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  // Exceptions log filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [partyFilter, setPartyFilter] = useState("");
  const [showOnlyUnapproved, setShowOnlyUnapproved] = useState(false);

  // Load price policies
  useEffect(() => {
    const db = getDB();
    db.priceFloorPolicies
      .toArray()
      .catch(() => [])
      .then(setPricePolicies);
  }, []);

  const filteredPolicies = useMemo(
    () => pricePolicies.filter((p) => matchBranch((p as any).branchId)),
    [pricePolicies, branchFilter],
  );

  // Filter items for floor master
  const filteredItems = useMemo(() => {
    let filtered = items.filter((item) => matchBranch((item as any).branchId));

    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.code.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    if (itemGroupFilter) {
      filtered = filtered.filter((item) => item.groupId === itemGroupFilter);
    }

    if (onlyActive) {
      const activePolicyIds = new Set(filteredPolicies.filter((p) => p.isActive).map((p) => p.itemId));
      filtered = filtered.filter((item) => activePolicyIds.has(item.id));
    }

    return filtered;
  }, [items, filteredPolicies, searchTerm, itemGroupFilter, onlyActive, branchFilter]);

  // Compute exceptions
  const exceptions = useMemo(() => {
    const allExceptions = [];

    invoices.forEach((inv) => {
      if (!matchBranch((inv as any).branchId)) return;
      if (dateFrom && inv.date < dateFrom) return;
      if (dateTo && inv.date > dateTo) return;
      if (partyFilter && inv.partyId !== partyFilter) return;

      (inv.lines || []).forEach((line) => {
        const policy = getPricePolicy(line.itemId, pricePolicies);
        if (!policy) return;

        const sellingRate = line.rate || line.amount / line.qty;
        const discountPct = line.discountPercent || 0;
        const compliance = checkPriceCompliance(
          line.itemId,
          sellingRate,
          discountPct,
          pricePolicies,
        );

        if (!compliance.ok) {
          allExceptions.push({
            id: `${inv.id}-${line.itemId}`,
            invoiceNo: inv.invoiceNo,
            date: inv.date,
            partyId: inv.partyId,
            itemName: items.find((i) => i.id === line.itemId)?.name || "N/A",
            sellingRate,
            floorRate: policy.minSellingPrice,
            discountPct,
            maxDiscountPct: policy.maxDiscountPct,
            variance: policy.minSellingPrice - sellingRate,
            approvedBy: inv.priceExceptionApprovedBy || null,
            approvedAt: inv.priceExceptionApprovedAt || null,
            status: inv.priceExceptionApproved ? "Approved" : "Pending",
          });
        }
      });
    });

    return showOnlyUnapproved
      ? allExceptions.filter((exc) => exc.status === "Pending")
      : allExceptions;
  }, [invoices, pricePolicies, dateFrom, dateTo, partyFilter, showOnlyUnapproved, items, branchFilter]);

  // Compute margin dashboard
  const marginDashboard = useMemo(() => {
    const violations = [];
    let totalBelowFloorRevenue = 0;

    invoices.forEach((inv) => {
      if (!matchBranch((inv as any).branchId)) return;
      if (dateFrom && inv.date < dateFrom) return;
      if (dateTo && inv.date > dateTo) return;

      (inv.lines || []).forEach((line) => {
        const policy = getPricePolicy(line.itemId, pricePolicies);
        if (!policy) return;

        const sellingRate = line.rate || line.amount / line.qty;
        if (sellingRate < policy.minSellingPrice) {
          const variance = policy.minSellingPrice - sellingRate;
          const revenueImpact = variance * line.qty;
          totalBelowFloorRevenue += revenueImpact;

          violations.push({
            itemId: line.itemId,
            itemName: items.find((i) => i.id === line.itemId)?.name || "N/A",
            salesQty: line.qty,
            avgSaleRate: sellingRate,
            floorPrice: policy.minSellingPrice,
            percentBelow: ((policy.minSellingPrice - sellingRate) / policy.minSellingPrice) * 100,
            revenueImpact,
          });
        }
      });
    });

    // Group by item
    const itemViolations = violations.reduce((acc, v) => {
      if (!acc[v.itemId]) {
        acc[v.itemId] = {
          ...v,
          totalQty: v.salesQty,
          totalRevenueImpact: v.revenueImpact,
        };
      } else {
        acc[v.itemId].totalQty += v.salesQty;
        acc[v.itemId].totalRevenueImpact += v.revenueImpact;
      }
      return acc;
    }, {});

    const topViolators = Object.values(itemViolations)
      .sort((a, b) => b.totalRevenueImpact - a.totalRevenueImpact)
      .slice(0, 5);

    return {
      violations,
      totalBelowFloorRevenue,
      topViolators,
    };
  }, [invoices, pricePolicies, dateFrom, dateTo, items, branchFilter]);

  // Handle saving a policy
  const handleSavePolicy = async (item, policyData) => {
    try {
      const db = getDB();
      const policyId = pricePolicies.find((p) => p.itemId === item.id)?.id || generateId();

      const existingPolicy = pricePolicies.find((p) => p.itemId === item.id);
      const policy = {
        id: policyId,
        itemId: item.id,
        itemName: item.name,
        minSellingPrice: Number(policyData.minSellingPrice) || 0,
        maxDiscountPct: Number(policyData.maxDiscountPct) || 0,
        enforcement: policyData.enforcement || "none",
        isActive: policyData.isActive !== undefined ? policyData.isActive : true,
        updatedBy: currentUser?.name || "System",
        updatedAt: new Date().toISOString(),
        branchId: existingPolicy?.branchId || readActiveBranchId() || undefined,
      };

      await db.priceFloorPolicies.put(policy);
      toast.success("Price policy saved successfully");

      // Refresh policies
      const updated = await db.priceFloorPolicies.toArray();
      setPricePolicies(updated);
    } catch (error) {
      console.error("Error saving price policy:", error);
      toast.error("Failed to save price policy");
    }
  };

  // Handle bulk set
  const handleBulkSet = async () => {
    if (!bulkForm.groupId || bulkForm.marginPercent <= 0) {
      toast.error("Please select a group and enter a positive margin percent");
      return;
    }

    try {
      const db = getDB();
      const itemsToProcess = items.filter(
        (i) => i.groupId === bulkForm.groupId && matchBranch((i as any).branchId),
      );

      for (const item of itemsToProcess) {
        const purchaseRate = item.lastPurchaseRate || item.purchaseRate || 0;
        const minSellingPrice = purchaseRate * (1 + bulkForm.marginPercent / 100);

        const existingPolicy = pricePolicies.find((p) => p.itemId === item.id);
        const policyId = existingPolicy?.id || generateId();

        const policy = {
          id: policyId,
          itemId: item.id,
          itemName: item.name,
          minSellingPrice,
          maxDiscountPct: existingPolicy?.maxDiscountPct || 0,
          enforcement: existingPolicy?.enforcement || "soft",
          isActive: existingPolicy?.isActive !== false,
          updatedBy: currentUser?.name || "System",
          updatedAt: new Date().toISOString(),
          branchId: existingPolicy?.branchId || readActiveBranchId() || undefined,
        };

        await db.priceFloorPolicies.put(policy);
      }

      toast.success(
        `Updated ${itemsToProcess.length} items with ${bulkForm.marginPercent}% margin`,
      );

      // Refresh policies
      const updated = await db.priceFloorPolicies.toArray();
      setPricePolicies(updated);
      setBulkModalOpen(false);
      setBulkForm({ groupId: "", marginPercent: 0 });
    } catch (error) {
      console.error("Error in bulk set:", error);
      toast.error("Failed to update policies in bulk");
    }
  };

  // Handle approve exception
  const handleApproveException = async (exceptionId) => {
    try {
      const db = getDB();
      // Find the invoice ID from exceptionId
      const [invoiceId, itemId] = exceptionId.split("-");

      // Update invoice record
      await db.invoices.update(invoiceId, {
        priceExceptionApproved: true,
        priceExceptionApprovedBy: currentUser?.name || "System",
        priceExceptionApprovedAt: new Date().toISOString(),
      });

      toast.success("Exception approved successfully");
      // Refresh would happen automatically through store
    } catch (error) {
      console.error("Error approving exception:", error);
      toast.error("Failed to approve exception");
    }
  };

  // Render Price Floor Master
  const renderPriceFloorMaster = () => (
    <div style={{ padding: "20px" }}>
      <div
        style={{
          display: "flex",
          gap: "15px",
          marginBottom: "20px",
          flexWrap: "wrap",
          alignItems: "end",
        }}
      >
        <div style={{ flex: 1, minWidth: "200px" }}>
          <label
            style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "12px" }}
          >
            Search Items
          </label>
          <input
            type="text"
            placeholder="Search by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "6px",
              border: BORDER,
              borderRadius: "4px",
              fontSize: "12px",
            }}
          />
        </div>
        <div>
          <label
            style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "12px" }}
          >
            Item Group
          </label>
          <select
            value={itemGroupFilter}
            onChange={(e) => setItemGroupFilter(e.target.value)}
            style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
          >
            <option value="">All Groups</option>
            {itemGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "12px" }}
          >
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
              style={{ marginRight: "5px" }}
            />
            Show Only Active
          </label>
        </div>
        <button
          onClick={() => setBulkModalOpen(true)}
          style={{
            backgroundColor: "var(--ds-action-primary)",
            color: "white",
            border: BORDER,
            padding: "8px 16px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <Plus size={14} />
          Bulk Set from Margin
        </button>
      </div>

      <div
        style={{ backgroundColor: BG_CARD, padding: "20px", borderRadius: "8px", border: BORDER }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
            <thead>
              <tr style={{ backgroundColor: BG_HEADER }}>
                <th style={{ border: BORDER, padding: "8px" }}>Item Code</th>
                <th style={{ border: BORDER, padding: "8px" }}>Item Name</th>
                <th style={{ border: BORDER, padding: "8px" }}>Item Group</th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                  Purchase Rate
                </th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                  Min Selling Price
                </th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                  Max Discount %
                </th>
                <th style={{ border: BORDER, padding: "8px" }}>Enforcement</th>
                <th style={{ border: BORDER, padding: "8px" }}>Active</th>
                <th style={{ border: BORDER, padding: "8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const policy = filteredPolicies.find((p) => p.itemId === item.id);
                const purchaseRate = item.lastPurchaseRate || item.purchaseRate || 0;

                return (
                  <tr key={item.id}>
                    <td style={{ border: BORDER, padding: "8px" }}>{item.code}</td>
                    <td style={{ border: BORDER, padding: "8px" }}>{item.name}</td>
                    <td style={{ border: BORDER, padding: "8px" }}>
                      {itemGroups.find((g) => g.id === item.groupId)?.name || "N/A"}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {money(purchaseRate)}
                    </td>
                    <td style={{ border: BORDER, padding: "8px" }}>
                      <input
                        type="number"
                        value={policy?.minSellingPrice || 0}
                        onChange={(e) => {
                          const updatedPolicy = {
                            ...policy,
                            minSellingPrice: parseFloat(e.target.value) || 0,
                          };
                          handleSavePolicy(item, updatedPolicy);
                        }}
                        style={{
                          width: "100%",
                          padding: "4px",
                          border: BORDER,
                          borderRadius: "4px",
                          fontSize: "11px",
                        }}
                      />
                    </td>
                    <td style={{ border: BORDER, padding: "8px" }}>
                      <input
                        type="number"
                        value={policy?.maxDiscountPct || 0}
                        onChange={(e) => {
                          const updatedPolicy = {
                            ...policy,
                            maxDiscountPct: parseFloat(e.target.value) || 0,
                          };
                          handleSavePolicy(item, updatedPolicy);
                        }}
                        style={{
                          width: "100%",
                          padding: "4px",
                          border: BORDER,
                          borderRadius: "4px",
                          fontSize: "11px",
                        }}
                      />
                    </td>
                    <td style={{ border: BORDER, padding: "8px" }}>
                      <select
                        value={policy?.enforcement || "none"}
                        onChange={(e) => {
                          const updatedPolicy = { ...policy, enforcement: e.target.value };
                          handleSavePolicy(item, updatedPolicy);
                        }}
                        style={{
                          width: "100%",
                          padding: "4px",
                          border: BORDER,
                          borderRadius: "4px",
                          fontSize: "11px",
                        }}
                      >
                        <option value="none">None</option>
                        <option value="soft">Soft Warning</option>
                        <option value="hard">Hard Block</option>
                      </select>
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={policy?.isActive !== false}
                        onChange={(e) => {
                          const updatedPolicy = { ...policy, isActive: e.target.checked };
                          handleSavePolicy(item, updatedPolicy);
                        }}
                      />
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "center" }}>
                      <button
                        onClick={() => handleSavePolicy(item, policy || {})}
                        style={{
                          backgroundColor: "var(--ds-action-primary)",
                          color: "white",
                          border: BORDER,
                          padding: "4px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "11px",
                        }}
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Render Exceptions Log
  const renderExceptionsLog = () => (
    <div style={{ padding: "20px" }}>
      <div
        style={{
          display: "flex",
          gap: "15px",
          marginBottom: "20px",
          flexWrap: "wrap",
          alignItems: "end",
        }}
      >
        <div>
          <label
            style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "12px" }}
          >
            From Date
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
          />
        </div>
        <div>
          <label
            style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "12px" }}
          >
            To Date
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
          />
        </div>
        <div>
          <label
            style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "12px" }}
          >
            Item
          </label>
          <select
            value={itemFilter}
            onChange={(e) => setItemFilter(e.target.value)}
            style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
          >
            <option value="">All Items</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "12px" }}
          >
            Party
          </label>
          <select
            value={partyFilter}
            onChange={(e) => setPartyFilter(e.target.value)}
            style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
          >
            <option value="">All Parties</option>
            {/* Assuming parties are available in store */}
          </select>
        </div>
        <div>
          <label
            style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "12px" }}
          >
            <input
              type="checkbox"
              checked={showOnlyUnapproved}
              onChange={(e) => setShowOnlyUnapproved(e.target.checked)}
              style={{ marginRight: "5px" }}
            />
            Show Only Unapproved
          </label>
        </div>
      </div>

      <div
        style={{ backgroundColor: BG_CARD, padding: "20px", borderRadius: "8px", border: BORDER }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
            <thead>
              <tr style={{ backgroundColor: BG_HEADER }}>
                <th style={{ border: BORDER, padding: "8px" }}>Invoice No</th>
                <th style={{ border: BORDER, padding: "8px" }}>Date</th>
                <th style={{ border: BORDER, padding: "8px" }}>Party</th>
                <th style={{ border: BORDER, padding: "8px" }}>Item</th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Selling Rate</th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Floor Rate</th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Discount %</th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                  Max Discount %
                </th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Variance</th>
                <th style={{ border: BORDER, padding: "8px" }}>Status</th>
                <th style={{ border: BORDER, padding: "8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.map((exc) => (
                <tr
                  key={exc.id}
                  style={{ backgroundColor: exc.status === "Pending" ? WARNING_BG : OK_BG }}
                >
                  <td style={{ border: BORDER, padding: "8px" }}>{exc.invoiceNo}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{exc.date}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{exc.partyId}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{exc.itemName}</td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(exc.sellingRate)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(exc.floorRate)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {exc.discountPct.toFixed(2)}%
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {exc.maxDiscountPct.toFixed(2)}%
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(exc.variance)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "center" }}>
                    <span
                      style={{
                        backgroundColor: exc.status === "Approved" ? "#059669" : "#d97706",
                        color: "white",
                        padding: "2px 6px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: "bold",
                      }}
                    >
                      {exc.status}
                    </span>
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "center" }}>
                    {exc.status === "Pending" && (
                      <button
                        onClick={() => handleApproveException(exc.id)}
                        style={{
                          backgroundColor: "#059669",
                          color: "white",
                          border: BORDER,
                          padding: "4px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "11px",
                          marginRight: "5px",
                        }}
                      >
                        Approve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Render Margin Dashboard
  const renderMarginDashboard = () => (
    <div style={{ padding: "20px" }}>
      <div
        style={{
          display: "flex",
          gap: "15px",
          marginBottom: "20px",
          flexWrap: "wrap",
          alignItems: "end",
        }}
      >
        <div>
          <label
            style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "12px" }}
          >
            From Date
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
          />
        </div>
        <div>
          <label
            style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "12px" }}
          >
            To Date
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
          />
        </div>
        <button
          onClick={() => {
            const ws = XLSX.utils.json_to_sheet(marginDashboard.violations);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Margin Violations");
            XLSX.writeFile(wb, "Margin_Violations_Report.xlsx");
          }}
          style={{
            backgroundColor: "#059669",
            color: "white",
            border: BORDER,
            padding: "8px 16px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <Download size={14} />
          Export Excel
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "15px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            backgroundColor: BG_HEADER,
            padding: "15px",
            borderRadius: "6px",
            border: BORDER,
          }}
        >
          <div style={{ fontSize: "12px", color: "#000000", marginBottom: "5px" }}>
            Total Below Floor Revenue
          </div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "#dc2626" }}>
            {money(marginDashboard.totalBelowFloorRevenue)}
          </div>
        </div>
        <div
          style={{
            backgroundColor: BG_HEADER,
            padding: "15px",
            borderRadius: "6px",
            border: BORDER,
          }}
        >
          <div style={{ fontSize: "12px", color: "#000000", marginBottom: "5px" }}>
            Violation Count
          </div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
            {marginDashboard.violations.length}
          </div>
        </div>
      </div>

      <div
        style={{
          backgroundColor: BG_CARD,
          padding: "20px",
          borderRadius: "8px",
          border: BORDER,
          marginBottom: "20px",
        }}
      >
        <h3
          style={{ fontSize: "16px", fontWeight: "bold", color: "#000000", marginBottom: "15px" }}
        >
          Biggest Margin Violators
        </h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
            <thead>
              <tr style={{ backgroundColor: BG_HEADER }}>
                <th style={{ border: BORDER, padding: "8px" }}>Item</th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Sales Qty</th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                  Avg Sale Rate
                </th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Floor Price</th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                  % Below Floor
                </th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                  Revenue Impact
                </th>
              </tr>
            </thead>
            <tbody>
              {marginDashboard.topViolators.map((violator) => (
                <tr key={violator.itemId}>
                  <td style={{ border: BORDER, padding: "8px" }}>{violator.itemName}</td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {violator.totalQty}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(violator.avgSaleRate)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(violator.floorPrice)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {violator.percentBelow.toFixed(2)}%
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(violator.totalRevenueImpact)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div
        style={{
          backgroundColor: WARNING_BG,
          padding: "15px",
          borderRadius: "6px",
          border: BORDER,
          marginBottom: "20px",
        }}
      >
        <h3
          style={{ fontSize: "14px", fontWeight: "bold", color: "#000000", marginBottom: "10px" }}
        >
          Price Correction Suggestions
        </h3>
        <ul style={{ margin: 0, padding: "0 0 0 20px" }}>
          {marginDashboard.topViolators.slice(0, 3).map((violator) => (
            <li key={violator.itemId} style={{ marginBottom: "5px", color: "#000000" }}>
              Consider revising floor price for <strong>{violator.itemName}</strong> (currently{" "}
              {violator.percentBelow.toFixed(2)}% below floor) OR negotiate better purchase rates to
              improve margins.
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: BG, minHeight: "100vh" }}>
      <h1
        style={{
          fontSize: "24px",
          fontWeight: "bold",
          color: "#000000",
          padding: "20px",
          marginBottom: "0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>Price Policy Manager</span>
        {branchOptions.length > 0 && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
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
      </h1>

      {/* Tab Navigation */}
      <div
        style={{
          display: "flex",
          gap: "5px",
          padding: "0 20px",
          marginBottom: "20px",
          borderBottom: BORDER,
        }}
      >
        {[
          { id: "floor", label: "Price Floor Master", icon: Shield },
          { id: "exceptions", label: "Price Exceptions Log", icon: AlertTriangle },
          { id: "dashboard", label: "Margin Dashboard", icon: TrendingDown },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                backgroundColor: activeTab === tab.id ? BG_HEADER : "transparent",
                color: activeTab === tab.id ? "#000000" : "#666",
                border: BORDER,
                padding: "10px 16px",
                borderRadius: "4px 4px 0 0",
                cursor: "pointer",
                fontWeight: activeTab === tab.id ? "bold" : "normal",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "floor" && renderPriceFloorMaster()}
      {activeTab === "exceptions" && renderExceptionsLog()}
      {activeTab === "dashboard" && renderMarginDashboard()}

      {/* Bulk Modal */}
      {bulkModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: BG_CARD,
              padding: "20px",
              borderRadius: "8px",
              border: BORDER,
              width: "90%",
              maxWidth: "500px",
            }}
          >
            <h2
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                color: "#000000",
                marginBottom: "15px",
              }}
            >
              Bulk Set from Margin
            </h2>

            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                  fontSize: "12px",
                }}
              >
                Item Group
              </label>
              <select
                value={bulkForm.groupId}
                onChange={(e) => setBulkForm({ ...bulkForm, groupId: e.target.value })}
                style={{
                  width: "100%",
                  padding: "6px",
                  border: BORDER,
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              >
                <option value="">Select Group</option>
                {itemGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                  fontSize: "12px",
                }}
              >
                Margin Percent (Above Purchase Rate)
              </label>
              <input
                type="number"
                value={bulkForm.marginPercent}
                onChange={(e) =>
                  setBulkForm({ ...bulkForm, marginPercent: parseFloat(e.target.value) || 0 })
                }
                style={{
                  width: "100%",
                  padding: "6px",
                  border: BORDER,
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => setBulkModalOpen(false)}
                style={{
                  backgroundColor: "#dc2626",
                  color: "white",
                  border: BORDER,
                  padding: "6px 12px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkSet}
                style={{
                  backgroundColor: "var(--ds-action-primary)",
                  color: "white",
                  border: BORDER,
                  padding: "6px 12px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
