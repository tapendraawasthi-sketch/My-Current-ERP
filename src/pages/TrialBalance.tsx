import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useStore } from "../store/useStore";
import ColumnReportShell from "../components/reporting/ColumnReportShell";

interface Account {
  id: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  parentId?: string;
  isGroup: boolean;
  openingBalanceDr?: number;
  openingBalanceCr?: number;
}

interface VoucherLine {
  accountId: string;
  debit?: number;
  credit?: number;
}

interface Voucher {
  id: string;
  date: string;
  dateNepali?: string;
  status?: string;
  lines: VoucherLine[];
}

interface TrialRow {
  id: string;
  name: string;
  code: string;
  isGroup: boolean;
  depth: number;
  parentId?: string;
  children: TrialRow[];

  openingDr: number;
  openingCr: number;
  periodDr: number;
  periodCr: number;
  closingDr: number;
  closingCr: number;
}

function money(value: number): string {
  return Number(value || 0).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function bsToNum(bs: string): number {
  const [y, m, d] = String(bs || "").split("-").map(Number);
  return y * 10000 + m * 100 + d;
}

function isDebitNature(type: string) {
  return type === "asset" || type === "expense";
}

function computeLedgerTrial(
  account: Account,
  vouchers: Voucher[],
  fromBS: string,
  toBS: string,
) {
  let openingDr = Number(account.openingBalanceDr || 0);
  let openingCr = Number(account.openingBalanceCr || 0);
  let periodDr = 0;
  let periodCr = 0;

  vouchers
    .filter((v) => v.status !== "cancelled")
    .forEach((voucher) => {
      const bs = voucher.dateNepali || "";

      voucher.lines.forEach((line) => {
        if (line.accountId !== account.id) return;

        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);

        if (bsToNum(bs) < bsToNum(fromBS)) {
          openingDr += debit;
          openingCr += credit;
        } else if (bsToNum(bs) <= bsToNum(toBS)) {
          periodDr += debit;
          periodCr += credit;
        }
      });
    });

  const totalDr = openingDr + periodDr;
  const totalCr = openingCr + periodCr;
  const net = totalDr - totalCr;

  let closingDr = 0;
  let closingCr = 0;

  if (isDebitNature(account.type)) {
    if (net >= 0) closingDr = net;
    else closingCr = Math.abs(net);
  } else {
    if (net <= 0) closingCr = Math.abs(net);
    else closingDr = net;
  }

  return {
    openingDr,
    openingCr,
    periodDr,
    periodCr,
    closingDr,
    closingCr,
  };
}

function sumRows(rows: TrialRow[]) {
  return rows.reduce(
    (sum, row) => {
      sum.openingDr += row.openingDr;
      sum.openingCr += row.openingCr;
      sum.periodDr += row.periodDr;
      sum.periodCr += row.periodCr;
      sum.closingDr += row.closingDr;
      sum.closingCr += row.closingCr;
      return sum;
    },
    {
      openingDr: 0,
      openingCr: 0,
      periodDr: 0,
      periodCr: 0,
      closingDr: 0,
      closingCr: 0,
    },
  );
}

const allColumns = [
  { key: "account", label: "Account Name" },
  { key: "openingDr", label: "Opening Dr" },
  { key: "openingCr", label: "Opening Cr" },
  { key: "periodDr", label: "Period Dr" },
  { key: "periodCr", label: "Period Cr" },
  { key: "closingDr", label: "Closing Dr" },
  { key: "closingCr", label: "Closing Cr" },
];

const TrialBalance: React.FC = () => {
  const { accounts, vouchers, initializeApp } = useStore() as any;

  const [fromBS, setFromBS] = useState("2081-04-01");
  const [toBS, setToBS] = useState("2082-03-31");
  const [mode, setMode] = useState<"condensed" | "detailed">("detailed");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [visibleColumns, setVisibleColumns] = useState(allColumns.map((c) => c.key));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">("all");
  const [rowHeight, setRowHeight] = useState<"compact" | "normal" | "comfortable">("compact");
  const [zoom, setZoom] = useState<80 | 100 | 120>(100);

  const trialTree = useMemo<TrialRow[]>(() => {
    const accountList = (accounts || []) as Account[];
    const voucherList = (vouchers || []) as Voucher[];

    const buildNode = (account: Account, depth: number): TrialRow => {
      const childrenAccounts = accountList
        .filter((a) => a.parentId === account.id)
        .sort((a, b) => a.code.localeCompare(b.code));

      const children = childrenAccounts.map((child) => buildNode(child, depth + 1));

      if (!account.isGroup) {
        return {
          ...computeLedgerTrial(account, voucherList, fromBS, toBS),
          id: account.id,
          name: account.name,
          code: account.code,
          isGroup: false,
          depth,
          parentId: account.parentId,
          children: [],
        };
      }

      const childTotals = sumRows(children);

      return {
        id: account.id,
        name: account.name,
        code: account.code,
        isGroup: true,
        depth,
        parentId: account.parentId,
        children,
        ...childTotals,
      };
    };

    return accountList
      .filter((a) => !a.parentId)
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((a) => buildNode(a, 0));
  }, [accounts, vouchers, fromBS, toBS]);

  const flatRows = useMemo(() => {
    const result: TrialRow[] = [];

    const visit = (row: TrialRow) => {
      if (mode === "condensed" && !row.isGroup) return;

      result.push(row);

      if (mode === "detailed" && row.isGroup && expanded[row.id]) {
        row.children.forEach(visit);
      }
    };

    trialTree.forEach(visit);
    return result;
  }, [trialTree, expanded, mode]);

  const grandTotals = useMemo(() => {
    const ledgers: TrialRow[] = [];

    const collect = (row: TrialRow) => {
      if (!row.isGroup) ledgers.push(row);
      row.children.forEach(collect);
    };

    trialTree.forEach(collect);
    return sumRows(ledgers);
  }, [trialTree]);

  const difference = Math.abs(grandTotals.closingDr - grandTotals.closingCr);

  const show = (key: string) => visibleColumns.includes(key);

  const exportTrialBalance = () => {
    const rows = flatRows.map((row) => ({
      "Account Name": `${" ".repeat(row.depth * 4)}${row.name}`,
      "Opening Dr": row.openingDr,
      "Opening Cr": row.openingCr,
      "Period Dr": row.periodDr,
      "Period Cr": row.periodCr,
      "Closing Dr": row.closingDr,
      "Closing Cr": row.closingCr,
    }));

    rows.push({
      "Account Name": "GRAND TOTAL",
      "Opening Dr": grandTotals.openingDr,
      "Opening Cr": grandTotals.openingCr,
      "Period Dr": grandTotals.periodDr,
      "Period Cr": grandTotals.periodCr,
      "Closing Dr": grandTotals.closingDr,
      "Closing Cr": grandTotals.closingCr,
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Best-effort indentation for compatible spreadsheet engines.
    flatRows.forEach((row, index) => {
      const cellAddress = XLSX.utils.encode_cell({ r: index + 1, c: 0 });
      if (ws[cellAddress]) {
        ws[cellAddress].s = {
          alignment: { indent: row.depth },
        } as any;
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Trial Balance");
    XLSX.writeFile(wb, "Trial_Balance.xlsx");
  };

  return (
    <ColumnReportShell
      title="Trial Balance"
      subtitle={`${mode === "condensed" ? "Condensed" : "Detailed"} mode`}
      fromBS={fromBS}
      toBS={toBS}
      onFromBSChange={setFromBS}
      onToBSChange={setToBS}
      columns={allColumns}
      onVisibleColumnsChange={setVisibleColumns}
      totalRows={flatRows.length}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      rowHeight={rowHeight}
      onRowHeightChange={setRowHeight}
      zoom={zoom}
      onZoomChange={setZoom}
      onPrint={() => window.print()}
      onExport={exportTrialBalance}
      onRefresh={initializeApp}
    >
      <div className="no-print bg-white border-b border-gray-200 px-4 py-2 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("condensed")}
          className={`h-8 px-3 text-[12px] rounded-md border ${
            mode === "condensed"
              ? "bg-[#1557b0] text-white border-[#1557b0]"
              : "bg-white border-gray-300"
          }`}
        >
          Condensed
        </button>

        <button
          type="button"
          onClick={() => setMode("detailed")}
          className={`h-8 px-3 text-[12px] rounded-md border ${
            mode === "detailed"
              ? "bg-[#1557b0] text-white border-[#1557b0]"
              : "bg-white border-gray-300"
          }`}
        >
          Detailed
        </button>
      </div>

      {difference > 0.01 && (
        <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 text-[12px] font-semibold">
          WARNING: Trial Balance does not tally by Rs. {money(difference)}
        </div>
      )}

      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-[#f5f6fa] border-b border-gray-200">
          <tr>
            {show("account") && <Th>Account Name</Th>}
            {show("openingDr") && <Th right>Opening Dr</Th>}
            {show("openingCr") && <Th right>Opening Cr</Th>}
            {show("periodDr") && <Th right>Period Dr</Th>}
            {show("periodCr") && <Th right>Period Cr</Th>}
            {show("closingDr") && <Th right>Closing Dr</Th>}
            {show("closingCr") && <Th right>Closing Cr</Th>}
          </tr>
        </thead>

        <tbody>
          {flatRows.map((row) => (
            <tr
              key={row.id}
              onClick={() => {
                if (row.isGroup) {
                  setExpanded((prev) => ({
                    ...prev,
                    [row.id]: !prev[row.id],
                  }));
                }
              }}
              className={[
                "border-b border-gray-100 hover:bg-yellow-50",
                row.isGroup ? "font-bold bg-gray-50 cursor-pointer" : "font-normal",
              ].join(" ")}
            >
              {show("account") && (
                <Td>
                  <div
                    className="flex items-center gap-1"
                    style={{ paddingLeft: `${row.depth * 16}px` }}
                  >
                    {row.isGroup && mode === "detailed" && (
                      <span className="inline-flex w-5 h-5 items-center justify-center border border-gray-300 bg-white rounded text-[11px]">
                        {expanded[row.id] ? "−" : "+"}
                      </span>
                    )}
                    <span>{row.name}</span>
                  </div>
                </Td>
              )}

              {show("openingDr") && <Td right className="font-mono">{row.openingDr ? money(row.openingDr) : ""}</Td>}
              {show("openingCr") && <Td right className="font-mono italic">{row.openingCr ? money(row.openingCr) : ""}</Td>}
              {show("periodDr") && <Td right className="font-mono">{row.periodDr ? money(row.periodDr) : ""}</Td>}
              {show("periodCr") && <Td right className="font-mono italic">{row.periodCr ? money(row.periodCr) : ""}</Td>}
              {show("closingDr") && <Td right className="font-mono">{row.closingDr ? money(row.closingDr) : ""}</Td>}
              {show("closingCr") && <Td right className="font-mono italic">{row.closingCr ? money(row.closingCr) : ""}</Td>}
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr className="bg-[#eef2ff] font-bold border-t-2 border-[#c7d2fe]">
            {show("account") && <Td>GRAND TOTAL</Td>}
            {show("openingDr") && <Td right className="font-mono">{money(grandTotals.openingDr)}</Td>}
            {show("openingCr") && <Td right className="font-mono">{money(grandTotals.openingCr)}</Td>}
            {show("periodDr") && <Td right className="font-mono">{money(grandTotals.periodDr)}</Td>}
            {show("periodCr") && <Td right className="font-mono">{money(grandTotals.periodCr)}</Td>}
            {show("closingDr") && <Td right className="font-mono">{money(grandTotals.closingDr)}</Td>}
            {show("closingCr") && <Td right className="font-mono">{money(grandTotals.closingCr)}</Td>}
          </tr>
        </tfoot>
      </table>
    </ColumnReportShell>
  );
};

const Th: React.FC<{ children: React.ReactNode; right?: boolean }> = ({ children, right }) => (
  <th className={`px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 ${right ? "text-right" : "text-left"}`}>
    {children}
  </th>
);

const Td: React.FC<{ children: React.ReactNode; right?: boolean; className?: string }> = ({
  children,
  right,
  className,
}) => (
  <td className={`px-3 py-1.5 text-[12px] border-r border-gray-100 ${right ? "text-right" : "text-left"} ${className || ""}`}>
    {children}
  </td>
);

export default TrialBalance;
