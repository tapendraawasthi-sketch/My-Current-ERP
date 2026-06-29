import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useStore } from "../store/useStore";
import BsDateCell from "../components/reporting/BsDateCell";
import ColumnReportShell from "../components/reporting/ColumnReportShell";

interface Account {
  id: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  group?: string;
  parentId?: string;
  openingBalanceDr?: number;
  openingBalanceCr?: number;
}

interface VoucherLine {
  accountId: string;
  accountName?: string;
  debit?: number;
  credit?: number;
  billRef?: string;
  billReference?: string;
}

interface Voucher {
  id: string;
  voucherNo: string;
  date: string;
  dateNepali?: string;
  type: string;
  narration?: string;
  status?: string;
  lines: VoucherLine[];
}

function money(value: number): string {
  return Number(value || 0).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

const allColumns = [
  { key: "date", label: "Date" },
  { key: "voucherNo", label: "Voucher No." },
  { key: "type", label: "Voucher Type" },
  { key: "particulars", label: "Particulars" },
  { key: "narration", label: "Narration" },
  { key: "billRef", label: "Bill Reference" },
  { key: "debit", label: "Dr." },
  { key: "credit", label: "Cr." },
  { key: "running", label: "Running Balance" },
  { key: "indicator", label: "Dr/Cr" },
];

const GeneralLedger: React.FC = () => {
  const {
    accounts,
    vouchers,
    companySettings,
    currentFiscalYear,
    initializeApp,
    setCurrentPage,
    setEditingVoucherId,
  } = useStore() as any;

  const [accountId, setAccountId] = useState("");
  const [fromBS, setFromBS] = useState("2081-04-01");
  const [toBS, setToBS] = useState("2082-03-31");
  const [searchAccount, setSearchAccount] = useState("");
  const [visibleColumns, setVisibleColumns] = useState(allColumns.map((c) => c.key));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(100);
  const [rowHeight, setRowHeight] = useState<"compact" | "normal" | "comfortable">("compact");
  const [zoom, setZoom] = useState<80 | 100 | 120>(100);

  const accountList = (accounts || []) as Account[];
  const voucherList = (vouchers || []) as Voucher[];

  const account = useMemo(
    () => accountList.find((a) => a.id === accountId),
    [accountList, accountId],
  );

  const filteredAccountList = useMemo(() => {
    const q = searchAccount.toLowerCase();
    return accountList
      .filter((a) => !q || a.name.toLowerCase().includes(q) || a.code.includes(q))
      .slice(0, 100);
  }, [accountList, searchAccount]);

  const isPartyLedger = useMemo(() => {
    const text = `${account?.name || ""} ${account?.group || ""}`.toLowerCase();
    return text.includes("debtor") || text.includes("creditor") || text.includes("party");
  }, [account]);

  const ledgerData = useMemo(() => {
    if (!account) {
      return {
        openingSigned: 0,
        closingSigned: 0,
        rows: [],
      };
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

          const opposite = voucher.lines
            .filter((l) => l.accountId !== account.id)
            .map(
              (l) =>
                l.accountName || accountList.find((a) => a.id === l.accountId)?.name || l.accountId,
            )
            .join(", ");

          const row = {
            voucher,
            line,
            bsDate: bs,
            adDate: voucher.date,
            debit: Number(line.debit || 0),
            credit: Number(line.credit || 0),
            opposite,
            billRef: line.billRef || line.billReference || "",
          };

          if (bsToNum(bs) < bsToNum(fromBS)) {
            openingSigned += signedEffect(account, row.debit, row.credit);
          } else if (bsToNum(bs) <= bsToNum(toBS)) {
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

    return {
      openingSigned,
      closingSigned: running,
      rows,
    };
  }, [account, voucherList, accountList, fromBS, toBS]);

  const pagedRows = useMemo(() => {
    if (pageSize === "all") return ledgerData.rows;
    const start = (page - 1) * pageSize;
    return ledgerData.rows.slice(start, start + pageSize);
  }, [ledgerData.rows, page, pageSize]);

  const show = (key: string) => visibleColumns.includes(key);

  const openVoucher = (voucher: Voucher) => {
    setEditingVoucherId?.(voucher.id);
    setCurrentPage?.("voucher-entry");
  };

  const exportLedger = () => {
    if (!account) return;

    const rows = ledgerData.rows.map((row: any) => ({
      "Date (BS)": row.bsDate,
      "Date (AD)": row.adDate,
      "Voucher No.": row.voucher.voucherNo,
      "Voucher Type": row.voucher.type,
      Particulars: row.opposite,
      Narration: row.voucher.narration || "",
      "Bill Reference": row.billRef,
      Dr: row.debit,
      Cr: row.credit,
      "Running Balance": row.runningAbs,
      "Dr/Cr": row.indicator,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ledger");
    XLSX.writeFile(wb, `${account.name}_Ledger.xlsx`);
  };

  const openingIndicator = account ? balanceIndicator(account, ledgerData.openingSigned) : "Dr";

  const closingIndicator = account ? balanceIndicator(account, ledgerData.closingSigned) : "Dr";

  return (
    <ColumnReportShell
      title="General Ledger"
      subtitle={account ? `${account.code} - ${account.name}` : "Select an account"}
      fromBS={fromBS}
      toBS={toBS}
      onFromBSChange={setFromBS}
      onToBSChange={setToBS}
      columns={allColumns}
      onVisibleColumnsChange={setVisibleColumns}
      totalRows={ledgerData.rows.length}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      rowHeight={rowHeight}
      onRowHeightChange={setRowHeight}
      zoom={zoom}
      onZoomChange={setZoom}
      onPrint={() => window.print()}
      onExport={exportLedger}
      onRefresh={initializeApp}
    >
      <div className="no-print bg-white border-b border-gray-200 px-4 py-2 flex gap-3 items-center">
        <input
          value={searchAccount}
          onChange={(e) => setSearchAccount(e.target.value)}
          placeholder="Search account..."
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white w-64"
        />

        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white min-w-[360px]"
        >
          <option value="">Select Account</option>
          {filteredAccountList.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} - {a.name}
            </option>
          ))}
        </select>
      </div>

      {account && (
        <div className="print-only hidden text-center mb-4 p-4">
          <h1 className="text-[16px] font-bold">
            {companySettings?.companyNameEn || companySettings?.name || "Company"}
          </h1>
          <h2 className="text-[13px] font-semibold">Ledger Statement</h2>
          <div className="text-[11px]">
            {account.code} - {account.name} | {fromBS} to {toBS}
          </div>
        </div>
      )}

      {account && (
        <div className="bg-[#eef2ff] border-b border-[#c7d2fe] px-4 py-2 text-[12px] font-semibold sticky top-0 z-20">
          Opening Balance as on {fromBS}: Rs. {money(absBalance(ledgerData.openingSigned))}{" "}
          {openingIndicator}
        </div>
      )}

      <table className="w-full border-collapse">
        <thead className="sticky top-[36px] z-10 bg-[#f5f6fa] border-b border-gray-200">
          <tr>
            {show("date") && <Th>Date</Th>}
            {show("voucherNo") && <Th>Voucher No.</Th>}
            {show("type") && <Th>Voucher Type</Th>}
            {show("particulars") && <Th>Particulars</Th>}
            {show("narration") && <Th>Narration</Th>}
            {isPartyLedger && show("billRef") && <Th>Bill Ref.</Th>}
            {show("debit") && <Th right>Dr.</Th>}
            {show("credit") && <Th right>Cr.</Th>}
            {show("running") && <Th right>Running Balance</Th>}
            {show("indicator") && <Th>Dr/Cr</Th>}
          </tr>
        </thead>

        <tbody>
          {!account && (
            <tr>
              <td className="px-4 py-8 text-center text-gray-500" colSpan={10}>
                Select an account to view ledger.
              </td>
            </tr>
          )}

          {pagedRows.map((row: any) => (
            <tr
              key={`${row.voucher.id}-${row.line.accountId}-${row.voucher.voucherNo}`}
              onClick={() => openVoucher(row.voucher)}
              className="cursor-pointer hover:bg-yellow-50 border-b border-gray-100"
            >
              {show("date") && (
                <Td>
                  <BsDateCell adDate={row.adDate} bsDate={row.bsDate} />
                </Td>
              )}

              {show("voucherNo") && <Td className="font-mono">{row.voucher.voucherNo}</Td>}
              {show("type") && <Td>{row.voucher.type}</Td>}
              {show("particulars") && <Td>{row.opposite}</Td>}
              {show("narration") && <Td className="text-gray-600">{row.voucher.narration}</Td>}
              {isPartyLedger && show("billRef") && <Td>{row.billRef}</Td>}
              {show("debit") && (
                <Td right className="font-mono">
                  {row.debit ? money(row.debit) : ""}
                </Td>
              )}
              {show("credit") && (
                <Td right className="font-mono">
                  {row.credit ? money(row.credit) : ""}
                </Td>
              )}
              {show("running") && (
                <Td right className="font-mono font-semibold">
                  {money(row.runningAbs)}
                </Td>
              )}
              {show("indicator") && (
                <Td className={row.indicator === "Cr" ? "italic text-gray-700" : ""}>
                  {row.indicator}
                </Td>
              )}
            </tr>
          ))}
        </tbody>

        {account && (
          <tfoot>
            <tr className="bg-[#eef2ff] font-bold border-t-2 border-[#c7d2fe]">
              <td colSpan={10} className="px-4 py-2 text-right">
                Closing Balance as on {toBS}: Rs. {money(absBalance(ledgerData.closingSigned))}{" "}
                {closingIndicator}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </ColumnReportShell>
  );
};

const Th: React.FC<{ children: React.ReactNode; right?: boolean }> = ({ children, right }) => (
  <th
    className={`px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 ${right ? "text-right" : "text-left"}`}
  >
    {children}
  </th>
);

const Td: React.FC<{ children: React.ReactNode; right?: boolean; className?: string }> = ({
  children,
  right,
  className,
}) => (
  <td
    className={`px-3 py-1.5 text-[12px] border-r border-gray-100 align-top ${right ? "text-right" : "text-left"} ${className || ""}`}
  >
    {children}
  </td>
);

export default GeneralLedger;
