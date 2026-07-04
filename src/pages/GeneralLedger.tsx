import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Search } from "lucide-react";
import { useStore } from "../store/useStore";
import BsDateCell from "../components/reporting/BsDateCell";
import ColumnReportShell from "../components/reporting/ColumnReportShell";
import { ReportEmptyState } from "../components/ReportEmptyState";

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

const fuzzyScore = (query: string, target: string): number => {
  const q = query.toLowerCase().trim();
  const t = (target || "").toLowerCase();
  if (!q) return 1;
  if (t === q) return 100; // exact match
  if (t.startsWith(q)) return 90; // prefix match
  if (t.includes(" " + q)) return 80; // word-start match
  if (t.includes(q)) return 60; // substring match

  // Character sequence match (fuzzy):
  let score = 0;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += qi === 0 ? 10 : 5; // first char match worth more
      qi++;
    }
  }
  return qi === q.length ? score : 0; // return 0 if not all chars matched
};

const HighlightMatch: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-100 text-gray-900 rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
};

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
    if (!searchAccount.trim()) return accountList.filter((a: any) => !a.isGroup).slice(0, 100);
    return accountList
      .filter((a: any) => !a.isGroup)
      .map((a) => ({
        account: a,
        score: Math.max(
          fuzzyScore(searchAccount, a.name || ""),
          fuzzyScore(searchAccount, a.code || ""),
          fuzzyScore(searchAccount, a.group || ""),
        ),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.account)
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
      <div className="no-print bg-white border-b border-gray-200 px-4 py-3">
        <div className="relative w-full max-w-md">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={searchAccount}
            onChange={(e) => {
              setSearchAccount(e.target.value);
              if (account && e.target.value && account.name !== e.target.value) {
                setAccountId("");
              }
            }}
            onFocus={() => {
              if (account && searchAccount === account.name) {
                setSearchAccount("");
              }
            }}
            placeholder="Search and select account…"
            className="h-8 pl-8 pr-3 text-[12px] border border-gray-300 rounded-md bg-white w-full focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          />
          {searchAccount && !accountId && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 border-t-0 rounded-b-md shadow-lg max-h-[300px] overflow-y-auto z-50">
              {filteredAccountList.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setAccountId(a.id);
                    setSearchAccount(a.name);
                  }}
                  className="w-full text-left px-3 py-2 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <div className="text-[12px] font-semibold text-gray-800">
                    <HighlightMatch text={a.name} query={searchAccount} />
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    <HighlightMatch text={a.code} query={searchAccount} />
                    {a.group && (
                      <span>
                        {" "}
                        · <HighlightMatch text={a.group} query={searchAccount} />
                      </span>
                    )}
                  </div>
                </button>
              ))}
              {filteredAccountList.length === 0 && (
                <div className="px-3 py-4 text-[12px] text-gray-500 text-center">
                  No accounts found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {!account && (
        <div className="p-4">
          <div className="bg-white border border-gray-200 rounded-md">
            <ReportEmptyState
              message="No account selected"
              hint="Search and select a ledger account to view its statement."
            />
          </div>
        </div>
      )}

      {account && (
        <div className="no-print px-4 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Opening balance
            </p>
            <p className="text-[14px] font-semibold text-gray-800 mt-0.5 font-mono">
              {money(absBalance(ledgerData.openingSigned))} {openingIndicator}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">As on {fromBS}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Transactions
            </p>
            <p className="text-[14px] font-semibold text-[#1557b0] mt-0.5">
              {ledgerData.rows.length}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {fromBS} to {toBS}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Closing balance
            </p>
            <p className="text-[14px] font-semibold text-gray-800 mt-0.5 font-mono">
              {money(absBalance(ledgerData.closingSigned))} {closingIndicator}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">As on {toBS}</p>
          </div>
        </div>
      )}

      {account && (
        <div className="print-only hidden text-center mb-4 p-4">
          <h1 className="text-[15px] font-semibold">
            {companySettings?.companyNameEn || companySettings?.name || "Company"}
          </h1>
          <h2 className="text-[12px] font-semibold mt-1">Ledger statement</h2>
          <div className="text-[11px] text-gray-600">
            {account.code} - {account.name} | {fromBS} to {toBS}
          </div>
        </div>
      )}

      {account && ledgerData.rows.length === 0 ? (
        <div className="p-4">
          <div className="bg-white border border-gray-200 rounded-md">
            <ReportEmptyState
              message="No transactions in this period"
              hint="Adjust the BS date range or choose a different account."
            />
          </div>
        </div>
      ) : account ? (
        <div className="bg-white border border-gray-200 rounded-md mx-4 my-3 overflow-hidden">
          <div className="bg-[#f5f6fa] border-b border-gray-200 px-4 py-2 text-[12px] font-medium text-gray-700 sticky top-0 z-20">
            Opening balance as on {fromBS}: Rs. {money(absBalance(ledgerData.openingSigned))}{" "}
            {openingIndicator}
          </div>

          <table className="w-full border-collapse">
            <thead className="sticky top-[36px] z-10 bg-[#f5f6fa] border-b border-gray-200">
              <tr>
                {show("date") && <Th>Date</Th>}
                {show("voucherNo") && <Th>Voucher no.</Th>}
                {show("type") && <Th>Voucher type</Th>}
                {show("particulars") && <Th>Particulars</Th>}
                {show("narration") && <Th>Narration</Th>}
                {isPartyLedger && show("billRef") && <Th>Bill ref.</Th>}
                {show("debit") && <Th right>Dr.</Th>}
                {show("credit") && <Th right>Cr.</Th>}
                {show("running") && <Th right>Running balance</Th>}
                {show("indicator") && <Th>Dr/Cr</Th>}
              </tr>
            </thead>

            <tbody>
              {pagedRows.map((row: any) => (
                <tr
                  key={`${row.voucher.id}-${row.line.accountId}-${row.voucher.voucherNo}`}
                  onClick={() => openVoucher(row.voucher)}
                  className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0] border-b border-gray-100"
                >
                  {show("date") && (
                    <Td>
                      <BsDateCell date={row.adDate} dateNepali={row.bsDate} />
                    </Td>
                  )}

                  {show("voucherNo") && (
                    <Td className="font-mono text-[#1557b0] font-medium">
                      {row.voucher.voucherNo}
                    </Td>
                  )}
                  {show("type") && <Td>{row.voucher.type}</Td>}
                  {show("particulars") && <Td>{row.opposite}</Td>}
                  {show("narration") && <Td className="text-gray-600">{row.voucher.narration}</Td>}
                  {isPartyLedger && show("billRef") && <Td>{row.billRef}</Td>}
                  {show("debit") && (
                    <Td right className="font-mono">
                      {row.debit ? money(row.debit) : "—"}
                    </Td>
                  )}
                  {show("credit") && (
                    <Td right className="font-mono">
                      {row.credit ? money(row.credit) : "—"}
                    </Td>
                  )}
                  {show("running") && (
                    <Td right className="font-mono font-medium">
                      {money(row.runningAbs)}
                    </Td>
                  )}
                  {show("indicator") && (
                    <Td>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                          row.indicator === "Cr"
                            ? "bg-gray-100 text-gray-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {row.indicator}
                      </span>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr className="bg-[#eef2ff] font-bold border-t-2 border-[#c7d2fe]">
                <td colSpan={10} className="px-4 py-2.5 text-right text-[12px] text-gray-800">
                  Closing balance as on {toBS}: Rs. {money(absBalance(ledgerData.closingSigned))}{" "}
                  {closingIndicator}
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
            {ledgerData.rows.length} ledger entr{ledgerData.rows.length === 1 ? "y" : "ies"}
            {pageSize !== "all" && ` · showing page ${page}`}
          </div>
        </div>
      ) : null}
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
