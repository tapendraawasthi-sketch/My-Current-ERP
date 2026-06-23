import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Button, Select, NepaliDatePicker } from "../components/ui";
import { formatNumber, dateToAD } from "../lib/utils";
import { VoucherType, VoucherStatus, PaymentStatus } from "../lib/types";
import toast from "react-hot-toast";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Slab {
  from: number;
  to: number;
  label: string;
}

const defaultSlabs: Slab[] = [
  { from: 0, to: 30, label: '0-30 days' },
  { from: 31, to: 60, label: '31-60 days' },
  { from: 61, to: 90, label: '61-90 days' },
  { from: 91, to: 180, label: '91-180 days' },
  { from: 181, to: 365, label: '181-365 days' },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff6666'];

const AgingReport: React.FC = () => {
  const { invoices, currentFiscalYear, companySettings, addReminderLog } = useStore();
  const [reportType, setReportType] = useState<"receivables" | "payables">("receivables");
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || dateToAD(new Date()));
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || dateToAD(new Date()));

  const [slabs, setSlabs] = useState<Slab[]>(defaultSlabs);
  const [isEditingSlabs, setIsEditingSlabs] = useState(false);
  const [tempSlabs, setTempSlabs] = useState<Slab[]>(defaultSlabs);

  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderMessage, setReminderMessage] = useState("");
  const [selectedParties, setSelectedParties] = useState<Set<string>>(new Set());

  const handleSaveSlabs = () => {
    setSlabs([...tempSlabs]);
    setIsEditingSlabs(false);
  };

  // Compute aging data dynamically based on slabs
  const agingData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const referenceInvoices = invoices.filter((inv) => {
      if (inv.status !== VoucherStatus.POSTED) return false;
      if (inv.paymentStatus === PaymentStatus.PAID) return false;
      if (reportType === "receivables" && inv.type !== VoucherType.SALES_INVOICE) return false;
      if (reportType === "payables" && inv.type !== VoucherType.PURCHASE_INVOICE) return false;
      return inv.date >= startDate && inv.date <= endDate;
    });

    const rows = referenceInvoices.map((inv) => {
      const outstanding = Math.max(0, inv.grandTotal - (inv.paidAmount || 0));
      let dueDateStr = inv.dueDate;
      if (!dueDateStr) {
        const d = new Date(inv.date);
        d.setDate(d.getDate() + 30);
        dueDateStr = d.toISOString().split("T")[0];
      }

      const refDate = new Date(dueDateStr);
      refDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - refDate.getTime();
      const daysOutstanding = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      const buckets: Record<string, number> = {};
      slabs.forEach(slab => buckets[slab.label] = 0);
      let notDue = 0;
      let overMax = 0;

      if (daysOutstanding < 0) {
        notDue = outstanding;
      } else {
        let placed = false;
        for (const slab of slabs) {
          if (daysOutstanding >= slab.from && daysOutstanding <= slab.to) {
            buckets[slab.label] = outstanding;
            placed = true;
            break;
          }
        }
        if (!placed) {
          const maxSlabTo = Math.max(...slabs.map(s => s.to));
          if (daysOutstanding > maxSlabTo) {
            overMax = outstanding;
          }
        }
      }

      return {
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        date: inv.date,
        dateNepali: inv.dateNepali,
        dueDate: dueDateStr,
        partyId: inv.partyId,
        partyName: inv.partyName,
        daysOutstanding,
        outstanding,
        notDue,
        overMax,
        buckets
      };
    });

    // Compute grand totals
    const grandTotals = {
      notDue: 0,
      overMax: 0,
      outstanding: 0,
      buckets: {} as Record<string, number>
    };
    slabs.forEach(slab => grandTotals.buckets[slab.label] = 0);

    // Group parties for reminders
    const partyTotals = new Map<string, { partyId: string, partyName: string, outstanding: number }>();

    rows.forEach(r => {
      grandTotals.notDue += r.notDue;
      grandTotals.overMax += r.overMax;
      grandTotals.outstanding += r.outstanding;
      slabs.forEach(slab => grandTotals.buckets[slab.label] += r.buckets[slab.label]);

      if (r.outstanding > 0) {
        const p = partyTotals.get(r.partyId) || { partyId: r.partyId, partyName: r.partyName, outstanding: 0 };
        p.outstanding += r.outstanding;
        partyTotals.set(r.partyId, p);
      }
    });

    // Pie chart data
    const pieData = slabs.map((slab) => ({
      name: slab.label,
      value: grandTotals.buckets[slab.label]
    })).filter(d => d.value > 0);
    if (grandTotals.notDue > 0) pieData.push({ name: 'Not Due', value: grandTotals.notDue });
    if (grandTotals.overMax > 0) pieData.push({ name: `>${Math.max(...slabs.map(s => s.to))} days`, value: grandTotals.overMax });

    return {
      rows: rows.sort((a, b) => b.daysOutstanding - a.daysOutstanding),
      grandTotals,
      partyTotals: Array.from(partyTotals.values()),
      pieData
    };
  }, [invoices, reportType, startDate, endDate, slabs]);

  const maxDays = Math.max(...slabs.map(s => s.to));

  const handlePrint = () => {
    window.print();
  };

  const handleSendReminders = async () => {
    if (selectedParties.size === 0) {
       toast.error("Please select at least one party.");
       return;
    }
    if (!reminderMessage.trim()) {
       toast.error("Please enter a reminder message.");
       return;
    }

    try {
      for (const partyId of selectedParties) {
        const partyData = agingData.partyTotals.find(p => p.partyId === partyId);
        if (partyData) {
          await addReminderLog({
            ruleId: "manual",
            message: reminderMessage,
            status: "pending",
            partyId,
            referenceType: "invoice",
            referenceId: "",
            sentAt: new Date().toISOString()
          });
        }
      }
      toast.success("Reminders sent successfully!");
      setShowReminderModal(false);
      setReminderMessage("");
      setSelectedParties(new Set());
    } catch (e: any) {
      toast.error(e?.message || "Failed to send reminders");
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn select-none text-xs page-wrapper">
      <div className="flex items-center justify-between mb-4 no-print">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Aging Report</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Outstanding aging analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsEditingSlabs(!isEditingSlabs)}>
            Edit Slabs
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowReminderModal(true)}>
            Send Reminders
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} icon={<span className="text-sm">🖨️</span>}>
            Print
          </Button>
        </div>
      </div>

      {isEditingSlabs && (
        <Card border padding="md" className="no-print bg-gray-50">
          <h3 className="font-semibold text-sm mb-3">Edit Aging Slabs</h3>
          <div className="flex flex-col gap-2">
            {tempSlabs.map((slab, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="number"
                  className="w-20 p-1 border rounded"
                  value={slab.from}
                  onChange={(e) => {
                    const newSlabs = [...tempSlabs];
                    newSlabs[i].from = parseInt(e.target.value) || 0;
                    setTempSlabs(newSlabs);
                  }}
                />
                <span>to</span>
                <input
                  type="number"
                  className="w-20 p-1 border rounded"
                  value={slab.to}
                  onChange={(e) => {
                    const newSlabs = [...tempSlabs];
                    newSlabs[i].to = parseInt(e.target.value) || 0;
                    setTempSlabs(newSlabs);
                  }}
                />
                <span>Label:</span>
                <input
                  type="text"
                  className="w-32 p-1 border rounded"
                  value={slab.label}
                  onChange={(e) => {
                    const newSlabs = [...tempSlabs];
                    newSlabs[i].label = e.target.value;
                    setTempSlabs(newSlabs);
                  }}
                />
                <Button size="xs" variant="outline" onClick={() => setTempSlabs(tempSlabs.filter((_, idx) => idx !== i))}>Remove</Button>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="secondary" onClick={() => setTempSlabs([...tempSlabs, { from: maxDays + 1, to: maxDays + 30, label: 'New Slab' }])}>Add Slab</Button>
              <Button size="sm" onClick={handleSaveSlabs}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => { setIsEditingSlabs(false); setTempSlabs(slabs); }}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {showReminderModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b">
              <h2 className="text-lg font-bold">Send Reminders</h2>
            </div>
            <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
              <div>
                <label className="font-semibold block mb-2">Message:</label>
                <textarea 
                  className="w-full border rounded p-2" 
                  rows={4} 
                  value={reminderMessage}
                  onChange={e => setReminderMessage(e.target.value)}
                  placeholder="Dear Sir/Madam, this is a reminder regarding your outstanding balance..."
                />
              </div>
              <div>
                <label className="font-semibold block mb-2">Select Parties:</label>
                <div className="border rounded max-h-60 overflow-y-auto">
                   <table className="w-full text-left border-collapse">
                      <thead className="bg-gray-100 sticky top-0">
                         <tr>
                            <th className="p-2 border-b w-10">
                               <input type="checkbox" onChange={e => {
                                  if (e.target.checked) setSelectedParties(new Set(agingData.partyTotals.map(p => p.partyId)));
                                  else setSelectedParties(new Set());
                               }} />
                            </th>
                            <th className="p-2 border-b">Party Name</th>
                            <th className="p-2 border-b text-right">Outstanding</th>
                         </tr>
                      </thead>
                      <tbody>
                         {agingData.partyTotals.map(p => (
                            <tr key={p.partyId} className="border-b last:border-0 hover:bg-gray-50">
                               <td className="p-2">
                                  <input type="checkbox" checked={selectedParties.has(p.partyId)} onChange={e => {
                                     const next = new Set(selectedParties);
                                     if (e.target.checked) next.add(p.partyId);
                                     else next.delete(p.partyId);
                                     setSelectedParties(next);
                                  }} />
                               </td>
                               <td className="p-2">{p.partyName}</td>
                               <td className="p-2 text-right font-mono">{formatNumber(p.outstanding)}</td>
                            </tr>
                         ))}
                         {agingData.partyTotals.length === 0 && (
                            <tr><td colSpan={3} className="p-4 text-center text-gray-500">No outstanding balances found.</td></tr>
                         )}
                      </tbody>
                   </table>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowReminderModal(false)}>Cancel</Button>
              <Button onClick={handleSendReminders}>Send</Button>
            </div>
          </div>
        </div>
      )}

      <Card border padding="md" className="no-print">
        <div className="grid gap-4 lg:grid-cols-4">
          <NepaliDatePicker label="From Date" value={startDate} onChange={setStartDate} />
          <NepaliDatePicker label="To Date" value={endDate} onChange={setEndDate} />
          <div className="flex items-end">
            <Button variant="secondary" size="sm" onClick={() => { setStartDate(currentFiscalYear?.startDate || dateToAD(new Date())); setEndDate(currentFiscalYear?.endDate || dateToAD(new Date())); }}>Reset</Button>
          </div>
        </div>
      </Card>

      <div className="flex border-b border-gray-200 mb-2 no-print">
        <button className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors ${reportType === "receivables" ? "border-[#1557b0] text-[#1557b0] font-bold" : "border-transparent text-gray-500 hover:text-gray-700"}`} onClick={() => setReportType("receivables")}>Receivables (Sales Dues)</button>
        <button className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors ${reportType === "payables" ? "border-[#1557b0] text-[#1557b0] font-bold" : "border-transparent text-gray-500 hover:text-gray-700"}`} onClick={() => setReportType("payables")}>Payables (Purchase Dues)</button>
      </div>

      {agingData.pieData.length > 0 && (
         <Card border padding="md" className="no-print flex justify-center items-center">
            <div style={{ width: '100%', height: 300 }}>
               <ResponsiveContainer>
                 <PieChart>
                   <Pie data={agingData.pieData} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                     {agingData.pieData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                     ))}
                   </Pie>
                   <Tooltip formatter={(value: number) => formatNumber(value)} />
                   <Legend />
                 </PieChart>
               </ResponsiveContainer>
            </div>
         </Card>
      )}

      <div className="w-full overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
        <table className="data-table w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">Invoice No</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">Date</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">Due Date</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">Party Name</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-center">Age (Days)</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Not Due</th>
              {slabs.map(slab => (
                 <th key={slab.label} className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">{slab.label}</th>
              ))}
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">&gt;{maxDays}</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-150">
            {agingData.rows.length === 0 ? (
              <tr><td colSpan={7 + slabs.length} className="text-center py-6 text-gray-400">No outstanding invoices found.</td></tr>
            ) : (
              agingData.rows.map((row) => (
                <tr key={row.id} className="hover:bg-[#e8eeff] bg-white transition-colors">
                  <td className="px-3 py-2 text-[12px] text-gray-700 font-medium">{row.invoiceNo}</td>
                  <td className="px-3 py-2 text-[12px] text-gray-700">{companySettings?.dateFormat === "BS" ? row.dateNepali : row.date}</td>
                  <td className="px-3 py-2 text-[12px] text-gray-700">{row.dueDate}</td>
                  <td className="px-3 py-2 text-[12px] text-gray-700 font-semibold">{row.partyName}</td>
                  <td className="px-3 py-2 text-[12px] text-center">{row.daysOutstanding > 0 ? `${row.daysOutstanding} days` : row.daysOutstanding === 0 ? "Today" : "Not Due"}</td>
                  <td className="px-3 py-2 text-[12px] text-right font-mono text-gray-650">{row.notDue > 0 ? formatNumber(row.notDue) : "-"}</td>
                  {slabs.map(slab => (
                     <td key={slab.label} className="px-3 py-2 text-[12px] text-right font-mono">{row.buckets[slab.label] > 0 ? formatNumber(row.buckets[slab.label]) : "-"}</td>
                  ))}
                  <td className="px-3 py-2 text-[12px] text-right font-mono">{row.overMax > 0 ? formatNumber(row.overMax) : "-"}</td>
                  <td className="px-3 py-2 text-[12px] text-right font-mono font-bold text-gray-800">{formatNumber(row.outstanding)}</td>
                </tr>
              ))
            )}
          </tbody>
          {agingData.rows.length > 0 && (
            <tfoot className="bg-[#eef2ff] font-bold text-[12px] border-t-2 border-[#c7d2fe] text-gray-800">
              <tr>
                <td colSpan={5} className="px-3 py-2.5 text-left font-bold">GRAND TOTAL</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-650">{agingData.grandTotals.notDue > 0 ? formatNumber(agingData.grandTotals.notDue) : "-"}</td>
                {slabs.map(slab => (
                   <td key={slab.label} className="px-3 py-2.5 text-right font-mono">{agingData.grandTotals.buckets[slab.label] > 0 ? formatNumber(agingData.grandTotals.buckets[slab.label]) : "-"}</td>
                ))}
                <td className="px-3 py-2.5 text-right font-mono">{agingData.grandTotals.overMax > 0 ? formatNumber(agingData.grandTotals.overMax) : "-"}</td>
                <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-900">{formatNumber(agingData.grandTotals.outstanding)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="print-only hidden">
        <div className="mb-6 flex justify-between items-end border-b pb-4">
          <div>
            <h1 className="text-[18px] font-bold text-gray-800">SUTRA ERP</h1>
            <h2 className="text-[14px] font-bold text-gray-800 uppercase">{reportType === "receivables" ? "Receivables Aging Report" : "Payables Aging Report"}</h2>
            <p className="text-[11px] text-gray-500 mt-1">Period: {startDate} to {endDate}</p>
          </div>
          <div className="text-right text-[10px] text-gray-400">Report Date: {new Date().toISOString().split("T")[0]}</div>
        </div>
      </div>
    </div>
  );
};

export default AgingReport;
