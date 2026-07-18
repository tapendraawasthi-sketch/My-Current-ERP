// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";
import { useBranchFilter } from "../hooks/useBranchFilter";

const MovementAnalysis: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("movement-analysis");

  const { items, stockMovements, companySettings, currentFiscalYear, itemGroups } = useStore();
  const { branchFilter, setBranchFilter, branchOptions, matchMovement } = useBranchFilter();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || "");
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || "");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [showOnlyWithMovement, setShowOnlyWithMovement] = useState(true);

  // Pending states for options modal
  const [pendingStart, setPendingStart] = useState(startDate);
  const [pendingEnd, setPendingEnd] = useState(endDate);
  const [pendingSelectedGroupId, setPendingSelectedGroupId] = useState(selectedGroupId);
  const [pendingShowOnlyWithMovement, setPendingShowOnlyWithMovement] =
    useState(showOnlyWithMovement);
  const [pendingBranchFilter, setPendingBranchFilter] = useState(branchFilter);

  const applyOptions = () => {
    setStartDate(pendingStart);
    setEndDate(pendingEnd);
    setSelectedGroupId(pendingSelectedGroupId);
    setShowOnlyWithMovement(pendingShowOnlyWithMovement);
    setBranchFilter(pendingBranchFilter);
    setOptionsOpen(false);
  };

  // Get unique groups for dropdown
  const groups = useMemo(
    () => [{ id: "", name: "All Groups" }, ...(itemGroups || [])],
    [itemGroups],
  );

  // Compute movement analysis data
  const analysisData = useMemo(() => {
    if (!items || !stockMovements) return { rows: [], totals: {} };

    const result = [];
    const itemMap = new Map();

    // Initialize all items
    items.forEach((item) => {
      if (selectedGroupId && item.groupId !== selectedGroupId) return;

      itemMap.set(item.id, {
        id: item.id,
        itemName: item.name,
        purchaseQty: 0,
        purchaseValue: 0,
        salesQty: 0,
        salesValue: 0,
        transferInQty: 0,
        transferOutQty: 0,
        productionQty: 0,
        consumptionQty: 0,
        openingQty: item.openingQty || 0,
        openingValue: (item.openingQty || 0) * (item.openingRate || item.rate || 0),
      });
    });

    // Process movements
    const filteredMovements = (stockMovements || []).filter(
      (m) => m.date >= startDate && m.date <= endDate && matchMovement(m),
    );

    filteredMovements.forEach((m) => {
      const itemData = itemMap.get(m.itemId);
      if (!itemData) return;

      const qty = m.qty || 0;
      const value = (m.qty || 0) * (m.rate || 0);

      // Determine movement type and update accordingly
      if (m.type === "purchase" || m.referenceType === "purchase-invoice") {
        itemData.purchaseQty += qty;
        itemData.purchaseValue += value;
      } else if (m.type === "sales" || m.type === "out" || m.referenceType === "sales-invoice") {
        itemData.salesQty += qty;
        itemData.salesValue += value;
      } else if (m.type === "transfer") {
        if (m.fromWarehouseId) itemData.transferOutQty += qty;
        if (m.toWarehouseId) itemData.transferInQty += qty;
      } else if (m.type === "production") {
        itemData.productionQty += qty;
      } else if (m.type === "consumption" || m.type === "material-issued") {
        itemData.consumptionQty += qty;
      }
    });

    // Calculate closing quantities and values
    itemMap.forEach((itemData) => {
      const closingQty =
        itemData.openingQty +
        itemData.purchaseQty +
        itemData.transferInQty +
        itemData.productionQty -
        itemData.salesQty -
        itemData.transferOutQty -
        itemData.consumptionQty;

      // Calculate weighted average rate for closing value
      const totalQty =
        itemData.openingQty +
        itemData.purchaseQty +
        itemData.transferInQty +
        itemData.productionQty;
      const totalValue = itemData.openingValue + itemData.purchaseValue;
      const avgRate = totalQty > 0 ? totalValue / totalQty : 0;
      const closingValue = closingQty * avgRate;

      itemData.closingQty = closingQty;
      itemData.closingValue = closingValue;

      // Only add to results if movement is required
      if (
        !showOnlyWithMovement ||
        itemData.purchaseQty > 0 ||
        itemData.salesQty > 0 ||
        itemData.transferInQty > 0 ||
        itemData.transferOutQty > 0 ||
        itemData.productionQty > 0 ||
        itemData.consumptionQty > 0
      ) {
        result.push(itemData);
      }
    });

    // Calculate totals
    const totals = {
      purchaseQty: result.reduce((sum, item) => sum + item.purchaseQty, 0),
      purchaseValue: result.reduce((sum, item) => sum + item.purchaseValue, 0),
      salesQty: result.reduce((sum, item) => sum + item.salesQty, 0),
      salesValue: result.reduce((sum, item) => sum + item.salesValue, 0),
      transferInQty: result.reduce((sum, item) => sum + item.transferInQty, 0),
      transferOutQty: result.reduce((sum, item) => sum + item.transferOutQty, 0),
      productionQty: result.reduce((sum, item) => sum + item.productionQty, 0),
      consumptionQty: result.reduce((sum, item) => sum + item.consumptionQty, 0),
      closingQty: result.reduce((sum, item) => sum + item.closingQty, 0),
      closingValue: result.reduce((sum, item) => sum + item.closingValue, 0),
    };

    if (result.length > 0) {
      // Add total row
      result.push({
        id: "total",
        itemName: "GRAND TOTAL",
        purchaseQty: totals.purchaseQty,
        purchaseValue: totals.purchaseValue,
        salesQty: totals.salesQty,
        salesValue: totals.salesValue,
        transferInQty: totals.transferInQty,
        transferOutQty: totals.transferOutQty,
        productionQty: totals.productionQty,
        consumptionQty: totals.consumptionQty,
        closingQty: totals.closingQty,
        closingValue: totals.closingValue,
        isTotal: true,
      });
    }

    return { rows: result, totals };
  }, [
    items,
    stockMovements,
    startDate,
    endDate,
    selectedGroupId,
    showOnlyWithMovement,
    matchMovement,
    branchFilter,
  ]);

  const renderCell = (columnKey: string, value: any, row: any) => {
    if (row.isTotal) {
      if (columnKey === "itemName") {
        return <span className="font-bold text-gray-800">{value}</span>;
      }
      if (
        [
          "purchaseQty",
          "purchaseValue",
          "salesQty",
          "salesValue",
          "transferInQty",
          "transferOutQty",
          "productionQty",
          "consumptionQty",
          "closingQty",
          "closingValue",
        ].includes(columnKey)
      ) {
        if (value === 0) return "";
        return <span className="font-bold font-mono text-gray-800">{formatNumber(value)}</span>;
      }
      return "";
    }

    if (
      [
        "purchaseQty",
        "purchaseValue",
        "salesQty",
        "salesValue",
        "transferInQty",
        "transferOutQty",
        "productionQty",
        "consumptionQty",
        "closingQty",
        "closingValue",
      ].includes(columnKey)
    ) {
      if (value === 0) return <span className="text-gray-300">—</span>;

      let colorClass = "text-gray-700";
      // Slightly highlight inward/outward columns
      if (["purchaseQty", "purchaseValue", "transferInQty", "productionQty"].includes(columnKey))
        colorClass = "text-[var(--ds-action-primary)]";
      if (["salesQty", "salesValue", "transferOutQty", "consumptionQty"].includes(columnKey))
        colorClass = "text-[#d97706]";

      // Warn negative closing
      if (["closingQty", "closingValue"].includes(columnKey) && value < 0) {
        colorClass = "text-red-600 font-bold";
      }

      return <span className={`font-mono ${colorClass}`}>{formatNumber(value)}</span>;
    }

    return value;
  };

  return (
    <ReportShell
      title="Movement Analysis"
      subtitle="Stock movement across all transaction types"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText={`${startDate} to ${endDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingStart(startDate);
        setPendingEnd(endDate);
        setPendingSelectedGroupId(selectedGroupId);
        setPendingShowOnlyWithMovement(showOnlyWithMovement);
        setPendingBranchFilter(branchFilter);
        setOptionsOpen(true);
      }}
      actionBarButtons={[{ label: "Print" }, { label: "Export" }]}
      toolbarLeft={
        <div className="flex items-center gap-1.5 flex-wrap">
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            From:
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>

          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5 ml-1">
            To:
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>

          {branchOptions.length > 0 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] ml-1 w-[150px]"
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

          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] ml-1 w-[150px]"
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>

          <label className="text-[12px] font-medium text-gray-700 flex items-center gap-1.5 ml-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyWithMovement}
              onChange={(e) => setShowOnlyWithMovement(e.target.checked)}
              className="w-4 h-4 text-[var(--ds-action-primary)] border-gray-300 rounded focus:ring-[var(--ds-action-primary)]"
            />
            Only with movement
          </label>
        </div>
      }
    >
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-6">
        <ReportGrid
          columns={[
            { key: "itemName", label: "Item Name" },
            { key: "purchaseQty", label: "Purchase Qty", align: "right" },
            { key: "purchaseValue", label: "Purchase Value", align: "right" },
            { key: "salesQty", label: "Sales Qty", align: "right" },
            { key: "salesValue", label: "Sales Value", align: "right" },
            { key: "transferInQty", label: "Transfer In", align: "right" },
            { key: "transferOutQty", label: "Transfer Out", align: "right" },
            { key: "productionQty", label: "Prod In", align: "right" },
            { key: "consumptionQty", label: "Consump Out", align: "right" },
            { key: "closingQty", label: "Closing Qty", align: "right" },
            { key: "closingValue", label: "Closing Value", align: "right" },
          ]}
          data={analysisData.rows}
          getRowClassName={(row) => (row.isTotal ? "bg-[#eef2ff] border-t-2 border-[#c7d2fe]" : "")}
          renderCell={renderCell}
        />
      </div>

      <ReportOptionsModal
        open={optionsOpen}
        title="Movement Analysis Options"
        onClose={() => setOptionsOpen(false)}
        onApply={applyOptions}
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            From Date
            <input
              type="date"
              value={pendingStart}
              onChange={(e) => setPendingStart(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            To Date
            <input
              type="date"
              value={pendingEnd}
              onChange={(e) => setPendingEnd(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Item Group
            <select
              value={pendingSelectedGroupId}
              onChange={(e) => setPendingSelectedGroupId(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>

          {branchOptions.length > 0 && (
            <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
              Branch
              <select
                value={pendingBranchFilter}
                onChange={(e) => setPendingBranchFilter(e.target.value)}
                className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                aria-label="Branch"
              >
                <option value="all">All branches</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.code || b.id}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex items-center gap-2 text-[12px] font-medium text-gray-700 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={pendingShowOnlyWithMovement}
              onChange={(e) => setPendingShowOnlyWithMovement(e.target.checked)}
              className="w-4 h-4 text-[var(--ds-action-primary)] border-gray-300 rounded focus:ring-[var(--ds-action-primary)]"
            />
            Show only items with movement
          </label>
        </div>
      </ReportOptionsModal>
    </ReportShell>
  );
};

export default MovementAnalysis;
