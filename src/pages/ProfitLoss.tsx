// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import ReportShell from "../components/reporting/ReportShell";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import TFormatReport from "../components/reporting/TFormatReport";
import ReportGrid from "../components/reporting/ReportGrid";
import {
  buildAccountTree,
  computeLedgerTotals,
  computeGroupTotals,
  getLedgerEntries,
  groupEntriesByMonth,
} from "../lib/reportingHierarchy";
import { exportToExcel } from "../lib/reporting";
import { useNavigate } from "@tanstack/react-router";

const fmtDrCr = (dr: number, cr: number) => {
  if (Math.abs(dr) < 0.005 && Math.abs(cr) < 0.005) return "—";
  if (dr > 0) return `${formatNumber(dr)} Dr`;
  if (cr > 0) return `${formatNumber(cr)} Cr`;
  return "—";
};

type DrillLevel = "group" | "subgroup" | "ledger" | "month" | "entries";

const ProfitLoss: React.FC = () => {
  const { accounts, vouchers, currentFiscalYear, companySettings } = useStore();
  const navigate = useNavigate();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [options, setOptions] = useState({ includeZero: true });
  const [mode, setMode] = useState<"grouped" | "detailed">("grouped");

  const [drillLevel, setDrillLevel] = useState<DrillLevel>("group");
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeSubgroupId, setActiveSubgroupId] = useState<string | null>(null);
  const [activeLedgerId, setActiveLedgerId] = useState<string | null>(null);
  const [activeMonth, setActiveMonth] = useState<string | null>(null);

  const fiscalStart = currentFiscalYear?.startDate || "2026-04-14";
  const fiscalEnd = currentFiscalYear?.endDate || "2027-04-13";

  const tree = useMemo(() => buildAccountTree(accounts), [accounts]);
  const ledgerTotals = useMemo(
    () =>
      computeLedgerTotals(accounts, vouchers, {
        startDate: fiscalStart,
        endDate: fiscalEnd,
      }),
    [accounts, vouchers, fiscalStart, fiscalEnd]
  );
  const groupTotals = useMemo(
    () => computeGroupTotals(tree, ledgerTotals),
    [tree, ledgerTotals]
  );

  const rootGroups = tree.roots.filter((r) => r.type === "income" || r.type === "expense");

  const groupedRows = useMemo(() => {
    const left: any[] = [];
    const right: any[] = [];

    rootGroups.forEach((grp) => {
      const totals = groupTotals.get(grp.id);
      const row = {
        id: grp.id,
        label: grp.name,
        amount: fmtDrCr(totals?.closingDr || 0, totals?.closingCr || 0),
        level: "group",
        indent: 0,
        onClick: () => {
          setDrillLevel("subgroup");
          setActiveGroupId(grp.id);
        },
      };
      if (grp.type === "expense") left.push(row);
      else right.push(row);
    });

    return { left, right };
  }, [rootGroups, groupTotals, options]);

  const detailedRows = useMemo(() => {
    const left: any[] = [];
    const right: any[] = [];

    rootGroups.forEach((grp) => {
      const children = grp.children || [];
      const grpTotals = groupTotals.get(grp.id);
      const grpRow = {
        id: grp.id,
        label: grp.name,
        amount: fmtDrCr(grpTotals?.closingDr || 0, grpTotals?.closingCr || 0),
        level: "group",
        indent: 0,
        onClick: () => {
          setDrillLevel("subgroup");
          setActiveGroupId(grp.id);
        },
      };

      const childRows = children.flatMap((sub) => {
        const subTotals = groupTotals.get(sub.id);
        const subRow = {
          id: sub.id,
          label: sub.name,
          amount: fmtDrCr(subTotals?.closingDr || 0, subTotals?.closingCr || 0),
          level: "subgroup",
          indent: 1,
          onClick: () => {
            setDrillLevel("ledger");
            setActiveSubgroupId(sub.id);
          },
        };

        const ledgerRows = (sub.children || [])
          .filter((c) => !c.isGroup)
          .map((ledger) => {
            const totals = ledgerTotals.get(ledger.id);
            const showRow =
              options.includeZero ||
              totals?.hasActivity ||
              (totals && (totals.closingDr > 0 || totals.closingCr > 0));
            if (!showRow) return null;
            return {
              id: ledger.id,
              label: ledger.name,
              amount: fmtDrCr(totals?.closingDr || 0, totals?.closingCr || 0),
              level: "ledger",
              indent: 2,
              onClick: () => {
                setDrillLevel("month");
                setActiveLedgerId(ledger.id);
              },
            };
          })
          .filter(Boolean);

        return [subRow, ...ledgerRows];
      });

      if (grp.type === "expense") left.push(grpRow, ...childRows);
      else right.push(grpRow, ...childRows);
    });

    return { left, right };
  }, [rootGroups, groupTotals, ledgerTotals, options]);

  const ledgerMonthRows = useMemo(() => {
    if (!activeLedgerId) return [];
    const entries = getLedgerEntries(activeLedgerId, vouchers, {
      startDate: fiscalStart,
      endDate: fiscalEnd,
    });
    return groupEntriesByMonth(entries).map((m) => ({
      monthKey: m.monthKey,
      debit: formatNumber(m.debit),
      credit: formatNumber(m.credit),
      onClick: () => {
        setActiveMonth(m.monthKey);
        setDrillLevel("entries");
      },
    }));
  }, [activeLedgerId, vouchers, fiscalStart, fiscalEnd]);

  const entryRows = useMemo(() => {
    if (!activeLedgerId || !activeMonth) return [];
    const entries = getLedgerEntries(activeLedgerId, vouchers, {
      startDate: `${activeMonth}-01`,
      endDate: `${activeMonth}-31`,
    });
    return entries.map((e) => ({
      date: e.date,
      voucherNo: e.voucherNo,
      narration: e.narration,
      debit: e.debit ? formatNumber(e.debit) : "—",
      credit: e.credit ? formatNumber(e.credit) : "—",
      voucherId: e.voucherId,
      voucherType: e.voucherType,
    }));
  }, [activeLedgerId, activeMonth, vouchers]);

  const drillBack = () => {
    if (drillLevel === "entries") {
      setDrillLevel("month");
      return;
    }
    if (drillLevel === "month") {
      setDrillLevel("ledger");
      return;
    }
    if (drillLevel === "ledger") {
      setDrillLevel("subgroup");
      return;
    }
    if (drillLevel === "subgroup") {
      setDrillLevel("group");
      return;
    }
  };

  const openVoucher = (row: any) => {
    if (!row.voucherId) return;
    navigate(`/vouchers/${row.voucherId}`);
  };

  return (
    <ReportShell
      title="Profit & Loss"
      subtitle="Income Statement (T-Format)"
      companyName={companySettings?.companyNameEn}
      periodText={`From ${fiscalStart} to ${fiscalEnd}`}
      onPrint={() => window.print()}
      onExport={() => {
        const rows = mode === "grouped" ? groupedRows : detailedRows;
        exportToExcel(
          "Profit Loss",
          ["Account", "Amount"],
          [...rows.left, ...rows.right].map((r) => [r.label, r.amount])
        );
      }}
      onOptions={() => setOptionsOpen(true)}
      toolbarLeft={
        <div className="report-toggle">
          <button className={mode === "grouped" ? "active" : ""} onClick={() => setMode("grouped")}>
            Grouped
          </button>
          <button className={mode === "detailed" ? "active" : ""} onClick={() => setMode("detailed")}>
            Detailed
          </button>
          {drillLevel !== "group" && <button onClick={drillBack}>Back</button>}
        </div>
      }
    >
      {drillLevel === "group" && (
        <TFormatReport
          leftTitle="Expenses"
          rightTitle="Income"
          leftRows={mode === "grouped" ? groupedRows.left : detailedRows.left}
          rightRows={mode === "grouped" ? groupedRows.right : detailedRows.right}
        />
      )}

      {drillLevel === "subgroup" && activeGroupId && (
        <ReportGrid
          columns={[
            { key: "label", label: "Subgroup" },
            { key: "amount", label: "Closing", align: "right" },
          ]}
          data={(tree.nodesById.get(activeGroupId)?.children || [])
            .filter((n) => n.isGroup)
            .map((sub) => {
              const totals = groupTotals.get(sub.id);
              return {
                id: sub.id,
                label: sub.name,
                amount: fmtDrCr(totals?.closingDr || 0, totals?.closingCr || 0),
                onClick: () => {
                  setDrillLevel("ledger");
                  setActiveSubgroupId(sub.id);
                },
              };
            })}
          onRowClick={(row) => row.onClick?.()}
        />
      )}

      {drillLevel === "ledger" && activeSubgroupId && (
        <ReportGrid
          columns={[
            { key: "label", label: "Ledger" },
            { key: "amount", label: "Closing", align: "right" },
          ]}
          data={(tree.nodesById.get(activeSubgroupId)?.children || [])
            .filter((n) => !n.isGroup)
            .map((ledger) => {
              const totals = ledgerTotals.get(ledger.id);
              return {
                id: ledger.id,
                label: ledger.name,
                amount: fmtDrCr(totals?.closingDr || 0, totals?.closingCr || 0),
                onClick: () => {
                  setActiveLedgerId(ledger.id);
                  setDrillLevel("month");
                },
              };
            })}
          onRowClick={(row) => row.onClick?.()}
        />
      )}

      {drillLevel === "month" && activeLedgerId && (
        <ReportGrid
          columns={[
            { key: "monthKey", label: "Month" },
            { key: "debit", label: "Debit", align: "right" },
            { key: "credit", label: "Credit", align: "right" },
          ]}
          data={ledgerMonthRows}
          onRowClick={(row) => row.onClick?.()}
        />
      )}

      {drillLevel === "entries" && activeLedgerId && (
        <ReportGrid
          columns={[
            { key: "date", label: "Date" },
            { key: "voucherNo", label: "Voucher No" },
            { key: "narration", label: "Narration" },
            { key: "debit", label: "Debit", align: "right" },
            { key: "credit", label: "Credit", align: "right" },
          ]}
          data={entryRows}
          onRowClick={openVoucher}
        />
      )}

      <ReportOptionsModal
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        onApply={(opts) => setOptions({ ...options, ...opts })}
        initial={options}
      />
    </ReportShell>
  );
};

export default ProfitLoss;
