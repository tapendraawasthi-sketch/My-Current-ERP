import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { ChevronRight } from "lucide-react";
import { useStore } from "../../store/useStore";
import BsDateCell from "../reporting/BsDateCell";
import {
  getFiscalYearDateRange,
  getFiscalYearMonths,
  getNepaliFiscalQuarter,
  parseFYLabel,
} from "../../lib/nepaliDate";
import { useBranchFilter } from "../../hooks/useBranchFilter";
import { formatNumber } from "@/lib/utils";
import {
  DetailReportLayout,
  PrintDocumentHeader,
  PrintDocumentSignatures,
} from "@/features/reports";

type PeriodMode = "month" | "quarter" | "year" | "custom";

interface Account {
  id: string;
  name: string;
  type: string;
  parentId?: string;
  isGroup?: boolean;
  openingBalanceDr?: number;
  openingBalanceCr?: number;
}

interface VoucherLine {
  accountId: string;
  accountName?: string;
  debit?: number;
  credit?: number;
}

interface Voucher {
  id: string;
  voucherNo: string;
  date: string;
  dateNepali?: string;
  type: string;
  narration?: string;
  status?: string;
  branchId?: string;
  lines: VoucherLine[];
}

function money(value: number): string {
  return formatNumber(value || 0, 2);
}

function bsToNum(bs: string): number {
  const [y, m, d] = String(bs || "")
    .split("-")
    .map(Number);
  return y * 10000 + m * 100 + d;
}

function isDebitNature(type: string) {
  return type === "asset" || type === "expense";
}

function signedEffect(account: Account, debit: number, credit: number) {
  return isDebitNature(account.type) ? debit - credit : credit - debit;
}

function balanceIndicator(account: Account, signedBalance: number): "Dr" | "Cr" {
  if (isDebitNature(account.type)) {
    return signedBalance >= 0 ? "Dr" : "Cr";
  }
  return signedBalance >= 0 ? "Cr" : "Dr";
}

function absBalance(value: number) {
  return Math.abs(Number(value || 0));
}

function buildBreadcrumb(accounts: Account[], ledgerId: string): string[] {
  const names: string[] = [];
  let current = accounts.find((a) => a.id === ledgerId);
  if (current) names.unshift(current.name);

  while (current?.parentId) {
    const parent = accounts.find((a) => a.id === current!.parentId);
    if (!parent) break;
    names.unshift(parent.name);
    current = parent;
  }
  return names;
}

function getQuarterOptions(fyLabel: string) {
  const { startYear } = parseFYLabel(fyLabel);
  const sampleMonths = [
    { month: 4, year: startYear },
    { month: 7, year: startYear },
    { month: 10, year: startYear },
    { month: 1, year: startYear + 1 },
  ];
  return sampleMonths.map(({ month, year }) =>
    getNepaliFiscalQuarter(`${year}-${String(month).padStart(2, "0")}-01`),
  );
}

interface LedgerStatementViewProps {
  ledgerId: string;
  onBack: () => void;
}

const LedgerStatementView: React.FC<LedgerStatementViewProps> = ({ ledgerId, onBack }) => {
  const {
    accounts,
    vouchers,
    companySettings,
    currentFiscalYear,
    setCurrentPage,
    setEditingVoucherId,
  } = useStore() as any;
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();

  const fyLabel = currentFiscalYear?.name || currentFiscalYear?.fiscalYearBS || "2083/84";
  const fyRange = useMemo(() => getFiscalYearDateRange(fyLabel), [fyLabel]);
  const fyMonths = useMemo(() => getFiscalYearMonths(fyLabel), [fyLabel]);
  const quarterOptions = useMemo(() => getQuarterOptions(fyLabel), [fyLabel]);

  const [periodMode, setPeriodMode] = useState<PeriodMode>("year");
  const [selectedMonth, setSelectedMonth] = useState(fyMonths[0]?.number ?? 4);
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(1);
  const [fromBS, setFromBS] = useState(fyRange.startDateBS);
  const [toBS, setToBS] = useState(fyRange.endDateBS);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);

  const scrollRef = useRef<HTMLDivElement>(null);

  const accountList = (accounts || []) as Account[];
  const voucherList = useMemo(
    () => ((vouchers || []) as Voucher[]).filter((v) => matchBranch(v.branchId)),
    [vouchers, matchBranch, branchFilter],
  );

  const account = useMemo(
    () => accountList.find((a) => a.id === ledgerId),
    [accountList, ledgerId],
  );

  const breadcrumb = useMemo(() => buildBreadcrumb(accountList, ledgerId), [accountList, ledgerId]);

  const activeRange = useMemo(() => {
    if (periodMode === "year") {
      return { fromBS: fyRange.startDateBS, toBS: fyRange.endDateBS };
    }
    if (periodMode === "month") {
      const monthInfo = fyMonths.find((m) => m.number === selectedMonth) ?? fyMonths[0];
      return {
        fromBS: monthInfo.dateRange.startDateBS,
        toBS: monthInfo.dateRange.endDateBS,
      };
    }
    if (periodMode === "quarter") {
      const q = quarterOptions.find((o) => o.quarter === selectedQuarter) ?? quarterOptions[0];
      return { fromBS: q.startDateBS, toBS: q.endDateBS };
    }
    return { fromBS, toBS };
  }, [periodMode, fyRange, fyMonths, selectedMonth, quarterOptions, selectedQuarter, fromBS, toBS]);

  const ledgerData = useMemo(() => {
    if (!account) {
      return { openingSigned: 0, closingSigned: 0, rows: [] as any[] };
    }

    const openingDr = Number(account.openingBalanceDr || 0);
    const openingCr = Number(account.openingBalanceCr || 0);
    let openingSigned = signedEffect(account, openingDr, openingCr);
    const allLines: any[] = [];

    voucherList
      .filter((v) => v.status !== "cancelled")
      .forEach((voucher) => {
        const bs = voucher.dateNepali || "";
        voucher.lines.forEach((line) => {
          if (line.accountId !== account.id) return;

          const row = {
            voucher,
            line,
            bsDate: bs,
            adDate: voucher.date,
            debit: Number(line.debit || 0),
            credit: Number(line.credit || 0),
          };

          if (bsToNum(bs) < bsToNum(activeRange.fromBS)) {
            openingSigned += signedEffect(account, row.debit, row.credit);
          } else if (bsToNum(bs) <= bsToNum(activeRange.toBS)) {
            allLines.push(row);
          }
        });
      });

    allLines.sort((a, b) => {
      const diff = bsToNum(a.bsDate) - bsToNum(b.bsDate);
      if (diff !== 0) return diff;
      return String(a.voucher.voucherNo).localeCompare(String(b.voucher.voucherNo));
    });

    let running = openingSigned;
    const rows = allLines.map((row) => {
      running += signedEffect(account, row.debit, row.credit);
      return {
        ...row,
        runningSigned: running,
        runningAbs: absBalance(running),
        indicator: balanceIndicator(account, running),
      };
    });

    return { openingSigned, closingSigned: running, rows };
  }, [account, voucherList, activeRange]);

  const openingIndicator = account ? balanceIndicator(account, ledgerData.openingSigned) : "Dr";
  const closingIndicator = account ? balanceIndicator(account, ledgerData.closingSigned) : "Dr";

  const openVoucher = useCallback(
    (voucher: Voucher) => {
      setEditingVoucherId?.(voucher.id);
      setCurrentPage?.("voucher-entry");
    },
    [setEditingVoucherId, setCurrentPage],
  );

  const exportLedger = () => {
    if (!account) return;
    const rows = ledgerData.rows.map((row: any) => ({
      "Date (BS)": row.bsDate,
      "Voucher Type": row.voucher.type,
      "Voucher No.": row.voucher.voucherNo,
      Narration: row.voucher.narration || "",
      Debit: row.debit || "",
      Credit: row.credit || "",
      "Running Balance": row.runningAbs,
      "Dr/Cr": row.indicator,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ledger");
    XLSX.writeFile(wb, `${account.name}_Ledger.xlsx`);
  };

  const handleTableKeyDown = (e: React.KeyboardEvent) => {
    const rows = ledgerData.rows;
    if (rows.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedRowIndex((i) => Math.min(i < 0 ? 0 : i + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedRowIndex((i) => Math.max(i < 0 ? 0 : i - 1, 0));
    } else if (e.key === "Enter" && focusedRowIndex >= 0) {
      e.preventDefault();
      openVoucher(rows[focusedRowIndex].voucher);
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusedRowIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusedRowIndex(rows.length - 1);
    }
  };

  useEffect(() => {
    setFocusedRowIndex(-1);
  }, [ledgerData.rows.length, periodMode, activeRange.fromBS, activeRange.toBS]);

  if (!account) {
    return (
      <div className="p-4 bg-[#f5f6fa] min-h-screen">
        <button
          type="button"
          onClick={onBack}
          className="no-print h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 mb-4"
        >
          ← Back (Esc)
        </button>
        <div className="empty-state">
          <p className="empty-state-title">Account not found</p>
        </div>
      </div>
    );
  }

  return (
    <DetailReportLayout
      title="General Ledger"
      subtitle="History of one account"
      entityName={account.name}
      onBack={onBack}
      entityMeta={
        <div className="flex items-center gap-1 flex-wrap">
          {breadcrumb.map((part, i) => (
            <React.Fragment key={`${part}-${i}`}>
              {i > 0 && <ChevronRight className="h-3 w-3 text-gray-400" />}
              <span>{part}</span>
            </React.Fragment>
          ))}
          <span className="text-gray-400">·</span>
          <span>
            {activeRange.fromBS} to {activeRange.toBS}
          </span>
        </div>
      }
      kpis={[
        {
          label: "Opening",
          value: `${money(absBalance(ledgerData.openingSigned))} ${openingIndicator}`,
        },
        {
          label: "Closing",
          value: `${money(absBalance(ledgerData.closingSigned))} ${closingIndicator}`,
        },
        { label: "Entries", value: String(ledgerData.rows.length) },
        { label: "Period", value: periodMode },
      ]}
      actions={
        <>
          {branchOptions.length > 0 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
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
          <button
            type="button"
            onClick={() => window.print()}
            className="h-8 px-3 bg-white border border-[var(--ds-border-default)] text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
          >
            Print
          </button>
          <button
            type="button"
            onClick={exportLedger}
            className="h-8 px-3 bg-white border border-[var(--ds-border-default)] text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
          >
            Export
          </button>
        </>
      }
      footer="↑↓ Navigate · Enter Open voucher · Esc Back"
    >
      <div className="no-print flex flex-wrap items-center gap-3 border-b border-[var(--ds-border-subtle)] px-3 py-2">
        <div className="report-toggle">
          {(["month", "quarter", "year", "custom"] as PeriodMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={periodMode === mode ? "active" : ""}
              onClick={() => setPeriodMode(mode)}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {periodMode === "month" && (
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
          >
            {fyMonths.map((m) => (
              <option key={m.number} value={m.number}>
                {m.english}
              </option>
            ))}
          </select>
        )}

        {periodMode === "quarter" && (
          <select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
          >
            {quarterOptions.map((q) => (
              <option key={q.quarter} value={q.quarter}>
                {q.quarterLabel}
              </option>
            ))}
          </select>
        )}

        {periodMode === "custom" && (
          <>
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-medium text-gray-600">From BS</label>
              <input
                value={fromBS}
                onChange={(e) => setFromBS(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                placeholder="2081-04-01"
              />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-medium text-gray-600">To BS</label>
              <input
                value={toBS}
                onChange={(e) => setToBS(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                placeholder="2082-03-31"
              />
            </div>
          </>
        )}
      </div>

      <div className="print-only ds-print-only hidden px-3 pt-3">
        <PrintDocumentHeader
          companyName={companySettings?.companyNameEn || companySettings?.name}
          nameNepali={companySettings?.companyNameNe || companySettings?.nameNepali}
          address={companySettings?.address || companySettings?.companyAddress}
          pan={companySettings?.panNumber || companySettings?.pan}
          phone={companySettings?.phone || companySettings?.mobile}
          logoUrl={companySettings?.logo || companySettings?.logoUrl}
          title={`Ledger Statement — ${account.name}`}
          periodLabel={`${activeRange.fromBS} to ${activeRange.toBS}`}
        />
      </div>

      <div
        ref={scrollRef}
        tabIndex={0}
        onKeyDown={handleTableKeyDown}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto outline-none"
      >
        {ledgerData.rows.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No transactions in this period</p>
            <p className="empty-state-sub">Try Year or Custom range.</p>
          </div>
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Date (BS)</th>
                <th>Voucher Type</th>
                <th>Voucher No.</th>
                <th>Narration</th>
                <th className="th-right">Debit</th>
                <th className="th-right">Credit</th>
                <th className="th-right">Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledgerData.rows.map((row: any, index: number) => {
                const isFocused = focusedRowIndex === index;
                return (
                  <tr
                    key={`${row.voucher.id}-${row.voucher.voucherNo}-${index}`}
                    onClick={() => {
                      setFocusedRowIndex(index);
                      openVoucher(row.voucher);
                    }}
                    onMouseEnter={() => setFocusedRowIndex(index)}
                    className="cursor-pointer"
                    style={{
                      borderLeft: isFocused
                        ? "3px solid var(--color-accent)"
                        : "3px solid transparent",
                      background: isFocused ? "rgba(21,87,176,0.06)" : undefined,
                    }}
                  >
                    <td>
                      <BsDateCell date={row.adDate} dateNepali={row.bsDate} />
                    </td>
                    <td>{row.voucher.type}</td>
                    <td className="font-mono text-[var(--ds-action-primary)]">{row.voucher.voucherNo}</td>
                    <td className="text-gray-600">{row.voucher.narration || "—"}</td>
                    <td className="number-cell-dr">{row.debit ? money(row.debit) : "—"}</td>
                    <td className="number-cell-cr">{row.credit ? money(row.credit) : "—"}</td>
                    <td className="number-cell-bold">
                      {money(row.runningAbs)} {row.indicator}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="print-only ds-print-only hidden px-3 pb-3">
        <PrintDocumentSignatures />
      </div>
    </DetailReportLayout>
  );
};

export default LedgerStatementView;
