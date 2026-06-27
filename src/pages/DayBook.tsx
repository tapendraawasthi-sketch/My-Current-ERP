import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useStore } from "../store/useStore";
import BsDateCell from "../components/reporting/BsDateCell";
import ColumnReportShell from "../components/reporting/ColumnReportShell";

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
  partyName?: string;
  status?: string;
  lines: VoucherLine[];
}

interface Account {
  id: string;
  name: string;
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

function voucherTint(type: string): string {
  const t = String(type || "").toLowerCase();

  if (t.includes("sales") || t.includes("receipt")) return "bg-green-50/60";
  if (t.includes("purchase")) return "bg-blue-50/60";
  if (t.includes("payment")) return "bg-red-50/60";

  return "bg-white";
}

function exportDayBook(rows: Voucher[], accounts: Account[]) {
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

  const exportRows: any[] = [];

  rows.forEach((voucher) => {
    voucher.lines.forEach((line, index) => {
      exportRows.push({
        "BS Date": index === 0 ? voucher.dateNepali || "" : "",
        "AD Date": index === 0 ? voucher.date : "",
        "Voucher No.": index === 0 ? voucher.voucherNo : "",
        "Voucher Type": index === 0 ? voucher.type : "",
        Particulars: line.accountName || accountMap.get(line.accountId) || line.accountId,
        Narration: index === 0 ? voucher.narration || "" : "",
        "Dr. Amount": Number(line.debit || 0),
        "Cr. Amount": Number(line.credit || 0),
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Day Book");
  XLSX.writeFile(wb, "Day_Book.xlsx");
}

const allColumns = [
  { key: "date", label: "Date" },
  { key: "voucherNo", label: "Voucher No." },
  { key: "type", label: "Voucher Type" },
  { key: "particulars", label: "Particulars" },
  { key: "narration", label: "Narration" },
  { key: "debit", label: "Dr. Amount" },
  { key: "credit", label: "Cr. Amount" },
];

const DayBook: React.FC = () => {
  const { vouchers, accounts, setCurrentPage, setEditingVoucherId, initializeApp } =
    useStore() as any;

  const [fromBS, setFromBS] = useState("2081-04-01");
  const [toBS, setToBS] = useState("2082-03-31");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [visibleColumns, setVisibleColumns] = useState(allColumns.map((c) => c.key));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(100);
  const [rowHeight, setRowHeight] = useState<"compact" | "normal" | "comfortable">("compact");
  const [zoom, setZoom] = useState<80 | 100 | 120>(100);

  const accountMap = useMemo(
    () => new Map<string, string>((accounts || []).map((a: Account) => [a.id, a.name])),
    [accounts],
  );

  const voucherTypes = useMemo(() => {
    return Array.from(new Set((vouchers || []).map((v: Voucher) => v.type))).filter(Boolean) as string[];
  }, [vouchers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    return ((vouchers || []) as Voucher[])
      .filter((v) => v.status !== "cancelled")
      .filter((v) => {
        const bs = v.dateNepali || "";
        if (fromBS && bsToNum(bs) < bsToNum(fromBS)) return false;
        if (toBS && bsToNum(bs) > bsToNum(toBS)) return false;
        return true;
      })
      .filter((v) => {
        if (selectedTypes.length === 0) return true;
        return selectedTypes.includes(v.type);
      })
      .filter((v) => {
        if (!q) return true;

        const lineAccountNames = v.lines
          .map((line) => line.accountName || accountMap.get(line.accountId) || "")
          .join(" ")
          .toLowerCase();

        return (
          String(v.voucherNo || "").toLowerCase().includes(q) ||
          String(v.narration || "").toLowerCase().includes(q) ||
          String(v.partyName || "").toLowerCase().includes(q) ||
          lineAccountNames.includes(q)
        );
      })
      .sort((a, b) => {
        const dateDiff = bsToNum(a.dateNepali || "") - bsToNum(b.dateNepali || "");
        if (dateDiff !== 0) return dateDiff;
        return String(a.voucherNo).localeCompare(String(b.voucherNo));
      });
  }, [vouchers, fromBS, toBS, selectedTypes, search, accountMap]);

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;

    filtered.forEach((v) => {
      v.lines.forEach((l) => {
        debit += Number(l.debit || 0);
        credit += Number(l.credit || 0);
      });
    });

    return {
      debit,
      credit,
      count: filtered.length,
    };
  }, [filtered]);

  const paged = useMemo(() => {
    if (pageSize === "all") return filtered;
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const openVoucher = (voucher: Voucher) => {
    setEditingVoucherId?.(voucher.id);
    setCurrentPage?.("voucher-entry");
  };

  const show = (key: string) => visibleColumns.includes(key);

  return (
    <ColumnReportShell
      title="Day Book"
      subtitle="Tally Prime-style voucher register"
      fromBS={fromBS}
      toBS={toBS}
      onFromBSChange={setFromBS}
      onToBSChange={setToBS}
      columns={allColumns}
      onVisibleColumnsChange={setVisibleColumns}
      totalRows={filtered.length}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      rowHeight={rowHeight}
      onRowHeightChange={setRowHeight}
      zoom={zoom}
      onZoomChange={setZoom}
      onPrint={() => window.print()}
      onExport={() => exportDayBook(filtered, accounts || [])}
      onRefresh={initializeApp}
    >
      <div className="no-print bg-white border-b border-gray-200 px-4 py-2 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-gray-500">Voucher Type</span>
          <select
            multiple
            value={selectedTypes}
            onChange={(e) =>
              setSelectedTypes(Array.from(e.target.selectedOptions).map((o) => o.value))
            }
            className="h-16 px-2 text-[12px] border border-gray-300 rounded-md bg-white min-w-[180px]"
          >
            {voucherTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search narration, voucher no., party, account..."
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white min-w-[320px]"
        />
      </div>

      <div className="bg-[#eef2ff] border-b border-[#c7d2fe] px-4 py-2 flex gap-8 text-[12px] font-semibold sticky top-0 z-20">
        <span>Total Debit: Rs. {money(totals.debit)}</span>
        <span>Total Credit: Rs. {money(totals.credit)}</span>
        <span>Voucher Count: {totals.count}</span>
      </div>

      <table className="w-full border-collapse">
        <thead className="sticky top-[36px] z-10 bg-[#f5f6fa] border-b border-gray-200">
          <tr>
            {show("date") && <Th>Date</Th>}
            {show("voucherNo") && <Th>Voucher No.</Th>}
            {show("type") && <Th>Voucher Type</Th>}
            {show("particulars") && <Th>Particulars</Th>}
            {show("narration") && <Th>Narration</Th>}
            {show("debit") && <Th right>Dr. Amount</Th>}
            {show("credit") && <Th right>Cr. Amount</Th>}
          </tr>
        </thead>

        <tbody>
          {paged.map((voucher) => (
            <React.Fragment key={voucher.id}>
              {voucher.lines.map((line, index) => {
                const isFirst = index === 0;
                const accountName =
                  line.accountName || accountMap.get(line.accountId) || line.accountId;

                return (
                  <tr
                    key={`${voucher.id}-${index}`}
                    onClick={() => openVoucher(voucher)}
                    className={[
                      "cursor-pointer hover:bg-yellow-50 border-b border-gray-100",
                      isFirst ? voucherTint(voucher.type) : "bg-white",
                    ].join(" ")}
                  >
                    {show("date") && (
                      <Td>
                        {isFirst ? (
                          <BsDateCell adDate={voucher.date} bsDate={voucher.dateNepali} />
                        ) : null}
                      </Td>
                    )}

                    {show("voucherNo") && (
                      <Td className="font-mono font-semibold">
                        {isFirst ? voucher.voucherNo : ""}
                      </Td>
                    )}

                    {show("type") && (
                      <Td>{isFirst ? voucher.type : ""}</Td>
                    )}

                    {show("particulars") && (
                      <Td>
                        <div className={isFirst ? "font-semibold" : "pl-6 text-gray-700"}>
                          {isFirst ? voucher.partyName || accountName : accountName}
                        </div>
                      </Td>
                    )}

                    {show("narration") && (
                      <Td className="text-gray-600">
                        {isFirst ? voucher.narration || "" : ""}
                      </Td>
                    )}

                    {show("debit") && (
                      <Td right className="font-mono">
                        {line.debit ? money(line.debit) : ""}
                      </Td>
                    )}

                    {show("credit") && (
                      <Td right className="font-mono">
                        {line.credit ? money(line.credit) : ""}
                      </Td>
                    )}
                  </tr>
                );
              })}

              <tr>
                <td colSpan={7} className="h-1 bg-gray-100" />
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </ColumnReportShell>
  );
};

const Th: React.FC<{ children: React.ReactNode; right?: boolean }> = ({ children, right }) => (
  <th
    className={`px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 ${
      right ? "text-right" : "text-left"
    }`}
  >
    {children}
  </th>
);

const Td: React.FC<{
  children: React.ReactNode;
  right?: boolean;
  className?: string;
}> = ({ children, right, className }) => (
  <td
    className={`px-3 py-1.5 text-[12px] border-r border-gray-100 align-top ${
      right ? "text-right" : "text-left"
    } ${className || ""}`}
  >
    {children}
  </td>
);

export default DayBook;
