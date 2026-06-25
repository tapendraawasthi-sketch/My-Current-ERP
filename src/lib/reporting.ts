import * as XLSX from "xlsx";

export function exportToExcel(filename: string, headers: string[], data: any[][]): void {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(String(h).length + 2, 12) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`);
}
