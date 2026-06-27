// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import { ActionToolbar, Select, NepaliDatePicker, Button, Badge } from "../components/ui";
import { PillTitle, FormPanel } from "../components/BusyShell";
import { useStore } from "../store/useStore";
import { formatNumber, numberToWords } from "../lib/utils";
import { generateId } from "../lib/db";
import toast from "react-hot-toast";
import { FileText, Download } from "lucide-react";
import { formatADToBS } from "../lib/nepaliDate";

export default function ChequeRegister() {
  const { 
    accounts, 
    vouchers, 
    cheques, 
    companySettings,
    currentUser,
    updateCheque,
    saveAuditLog
  } = useStore();

  const [bankFilter, setBankFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("chequeNo");
  const [expandedCheque, setExpandedCheque] = useState<string | null>(null);
  const [actionDropdown, setActionDropdown] = useState<{[key: string]: boolean}>({});
  const [statusAction, setStatusAction] = useState<{chequeId: string, action: string} | null>(null);
  const [clearedDate, setClearedDate] = useState("");
  const [bouncedReason, setBouncedReason] = useState("");

  const bankAccounts = useMemo(() => {
    return accounts.filter(a => a.group === "Bank Accounts" || a.group === "Bank OD Accounts");
  }, [accounts]);

  // Auto-mark stale cheques on mount
  useEffect(() => {
    const markStaleCheques = async () => {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];
      
      const chequesToMark = cheques.filter(c => 
        (c.status === "issued" || c.status === "presented") && 
        c.chequeDate < ninetyDaysAgoStr
      );
      
      if (chequesToMark.length > 0) {
        for (const cheque of chequesToMark) {
          await updateCheque(cheque.id, { status: "stale" });
        }
        toast.success(`Marked ${chequesToMark.length} cheques as stale`);
      }
    };
    
    markStaleCheques();
  }, []);

  const filteredCheques = useMemo(() => {
    let result = cheques;
    
    if (bankFilter) {
      result = result.filter(c => c.bankAccountId === bankFilter);
    }
    
    if (dateFrom) {
      result = result.filter(c => c.chequeDate >= dateFrom);
    }
    
    if (dateTo) {
      result = result.filter(c => c.chequeDate <= dateTo);
    }
    
    if (statusFilter !== "ALL") {
      result = result.filter(c => c.status === statusFilter.toLowerCase());
    }
    
    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "date":
          return a.chequeDate.localeCompare(b.chequeDate);
        case "amount":
          return b.amount - a.amount;
        case "payee":
          return a.payeeName.localeCompare(b.payeeName);
        case "chequeNo":
        default:
          return a.chequeNo.localeCompare(b.chequeNo);
      }
    });
    
    return result;
  }, [cheques, bankFilter, dateFrom, dateTo, statusFilter, sortBy]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const total = filteredCheques.length;
    const outstanding = filteredCheques.filter(c => c.status === "issued" || c.status === "presented").length;
    const cleared = filteredCheques.filter(c => c.status === "cleared").length;
    const bounced = filteredCheques.filter(c => c.status === "bounced").length;
    
    const totalAmount = filteredCheques.reduce((sum, c) => sum + c.amount, 0);
    const outstandingAmount = filteredCheques
      .filter(c => c.status === "issued" || c.status === "presented")
      .reduce((sum, c) => sum + c.amount, 0);
    const clearedAmount = filteredCheques
      .filter(c => c.status === "cleared")
      .reduce((sum, c) => sum + c.amount, 0);
    const bouncedAmount = filteredCheques
      .filter(c => c.status === "bounced")
      .reduce((sum, c) => sum + c.amount, 0);
    
    return {
      total: { count: total, amount: totalAmount },
      outstanding: { count: outstanding, amount: outstandingAmount },
      cleared: { count: cleared, amount: clearedAmount },
      bounced: { count: bounced, amount: bouncedAmount }
    };
  }, [filteredCheques]);

  const handleUpdateStatus = async () => {
    if (!statusAction) return;
    
    const { chequeId, action } = statusAction;
    const cheque = cheques.find(c => c.id === chequeId);
    if (!cheque) return;
    
    try {
      let updateData: any = { status: action.toLowerCase() };
      
      if (action === "Mark Cleared") {
        if (!clearedDate) {
          toast.error("Please provide cleared date");
          return;
        }
        updateData.clearedDate = clearedDate;
      } else if (action === "Mark Bounced") {
        if (!bouncedReason) {
          toast.error("Please provide bounce reason");
          return;
        }
        updateData.bouncedDate = new Date().toISOString().split('T')[0];
        updateData.bouncedReason = bouncedReason;
      }
      
      await updateCheque(chequeId, updateData);
      
      // Log to audit
      await saveAuditLog({
        id: generateId(),
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || "system",
        action: `CHEQUE_STATUS_CHANGED_TO_${action.toUpperCase()}`,
        module: "banking",
        recordId: chequeId,
        recordType: "cheque",
        details: JSON.stringify({ oldStatus: cheque.status, newStatus: action.toLowerCase() })
      });
      
      if (action === "Mark Bounced") {
        toast.success("Cheque marked as bounced. Remember to create a reversal journal entry in Journal Entry screen.");
      } else {
        toast.success("Cheque status updated successfully");
      }
      
      setStatusAction(null);
      setClearedDate("");
      setBouncedReason("");
    } catch (error) {
      toast.error("Failed to update cheque status");
    }
  };

  const handleExportCSV = () => {
    // Create CSV content
    const headers = [
      "Cheque No",
      "Cheque Date",
      "Payee Name",
      "Amount",
      "Voucher No",
      "Voucher Date",
      "Status"
    ];
    
    const rows = filteredCheques.map(c => {
      const voucher = vouchers.find(v => v.id === c.voucherId);
      return [
        c.chequeNo,
        c.chequeDate,
        c.payeeName,
        c.amount,
        voucher?.voucherNo || "",
        voucher?.date || "",
        c.status
      ].join(",");
    });
    
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `cheque-register-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "issued": return "warning";
      case "presented": return "info";
      case "cleared": return "success";
      case "bounced": return "danger";
      case "cancelled": return "secondary";
      case "stale": return "destructive";
      default: return "default";
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ActionToolbar 
        title="Cheque Register" 
        icon={<FileText size={16} />}
      >
        <Button size="sm" variant="outline" onClick={handleExportCSV}>
          <Download size={14} className="mr-1" />
          Export CSV
        </Button>
      </ActionToolbar>
      
      <div className="flex-1 overflow-auto p-4">
        {/* Filter Bar */}
        <div className="mb-4 flex flex-wrap gap-3 items-end">
          <div className="w-48">
            <Select
              label="Bank Account"
              options={[
                { value: "", label: "All Banks" },
                ...bankAccounts.map(acc => ({ value: acc.id, label: acc.name }))
              ]}
              value={bankFilter}
              onChange={setBankFilter}
            />
          </div>
          
          <div className="w-32">
            <NepaliDatePicker
              label="From Date"
              value={dateFrom}
              onChange={setDateFrom}
            />
          </div>
          
          <div className="w-32">
            <NepaliDatePicker
              label="To Date"
              value={dateTo}
              onChange={setDateTo}
            />
          </div>
          
          <div className="w-32">
            <Select
              label="Status"
              options={[
                { value: "ALL", label: "All" },
                { value: "ISSUED", label: "Issued" },
                { value: "PRESENTED", label: "Presented" },
                { value: "CLEARED", label: "Cleared" },
                { value: "BOUNCED", label: "Bounced" },
                { value: "CANCELLED", label: "Cancelled" },
                { value: "STALE", label: "Stale" }
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </div>
          
          <div className="w-32">
            <Select
              label="Sort By"
              options={[
                { value: "chequeNo", label: "Cheque No" },
                { value: "date", label: "Date" },
                { value: "amount", label: "Amount" },
                { value: "payee", label: "Payee" }
              ]}
              value={sortBy}
              onChange={setSortBy}
            />
          </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 border rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Total Cheques</h3>
            <p className="text-2xl font-bold">{summaryStats.total.count}</p>
            <p className="text-sm text-gray-600">{formatNumber(summaryStats.total.amount)}</p>
          </div>
          
          <div className="bg-white p-4 border rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Outstanding</h3>
            <p className="text-2xl font-bold">{summaryStats.outstanding.count}</p>
            <p className="text-sm text-gray-600">{formatNumber(summaryStats.outstanding.amount)}</p>
          </div>
          
          <div className="bg-white p-4 border rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Cleared</h3>
            <p className="text-2xl font-bold">{summaryStats.cleared.count}</p>
            <p className="text-sm text-gray-600">{formatNumber(summaryStats.cleared.amount)}</p>
          </div>
          
          <div className="bg-white p-4 border rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Bounced</h3>
            <p className="text-2xl font-bold">{summaryStats.bounced.count}</p>
            <p className="text-sm text-gray-600">{formatNumber(summaryStats.bounced.amount)}</p>
          </div>
        </div>
        
        {/* Cheque Table */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Cheque No</th>
                <th className="p-3 text-left">Cheque Date</th>
                <th className="p-3 text-left">Payee Name</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-left">Voucher No</th>
                <th className="p-3 text-left">Voucher Date</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCheques.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-gray-500">
                    No cheques found
                  </td>
                </tr>
              ) : (
                filteredCheques.map(cheque => {
                  const voucher = vouchers.find(v => v.id === cheque.voucherId);
                  const isExpanded = expandedCheque === cheque.id;
                  
                  return (
                    <React.Fragment key={cheque.id}>
                      <tr 
                        className={`border-t hover:bg-gray-50 cursor-pointer ${isExpanded ? "bg-blue-50" : ""}`}
                        onClick={() => setExpandedCheque(isExpanded ? null : cheque.id)}
                      >
                        <td className="p-3">{cheque.chequeNo}</td>
                        <td className="p-3">{cheque.chequeDate}</td>
                        <td className="p-3">{cheque.payeeName}</td>
                        <td className="p-3 text-right">{formatNumber(cheque.amount)}</td>
                        <td className="p-3">{voucher?.voucherNo || cheque.voucherNo}</td>
                        <td className="p-3">{voucher?.date || "-"}</td>
                        <td className="p-3">
                          <Badge variant={getStatusVariant(cheque.status)}>
                            {cheque.status.charAt(0).toUpperCase() + cheque.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Select
                            value=""
                            onChange={(val) => {
                              if (val) {
                                setStatusAction({ chequeId: cheque.id, action: val });
                              }
                            }}
                            options={[
                              { value: "", label: "Update Status" },
                              { value: "Mark Presented", label: "Mark Presented" },
                              { value: "Mark Cleared", label: "Mark Cleared" },
                              { value: "Mark Bounced", label: "Mark Bounced" },
                              { value: "Mark Cancelled", label: "Mark Cancelled" },
                              { value: "Mark Stale", label: "Mark Stale" }
                            ]}
                            className="w-32"
                          />
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <tr className="bg-blue-50 border-t border-blue-100">
                          <td colSpan={8} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h4 className="font-medium mb-2">Details</h4>
                                <p className="text-sm">
                                  <span className="font-medium">Narration:</span> {cheque.narration || "—"}
                                </p>
                              </div>
                              <div>
                                <h4 className="font-medium mb-2">Amount in Words</h4>
                                <p className="text-sm">{cheque.amountInWords}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Update Status Modal */}
      {statusAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-4 border-b">
              <h3 className="font-bold text-lg">Update Cheque Status</h3>
            </div>
            
            <div className="p-4">
              <p className="mb-4">
                Updating status for cheque <strong>{cheques.find(c => c.id === statusAction.chequeId)?.chequeNo}</strong>
              </p>
              
              {statusAction.action === "Mark Cleared" && (
                <div className="mb-4">
                  <NepaliDatePicker
                    label="Cleared Date"
                    value={clearedDate}
                    onChange={setClearedDate}
                  />
                </div>
              )}
              
              {statusAction.action === "Mark Bounced" && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Bounce Reason</label>
                  <textarea
                    value={bouncedReason}
                    onChange={(e) => setBouncedReason(e.target.value)}
                    className="w-full p-2 border rounded text-sm"
                    rows={3}
                    placeholder="Enter reason for bounce..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Remember to create a reversal journal entry in Journal Entry screen.
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setStatusAction(null);
                  setClearedDate("");
                  setBouncedReason("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateStatus}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
