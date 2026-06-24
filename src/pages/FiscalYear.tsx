import React, { useState, useEffect } from "react";
import { Calendar, Plus, Lock, CheckCircle, AlertTriangle, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import NepaliDatePicker from "../components/ui/NepaliDatePicker";
import { formatBS } from "../utils/nepaliDate";

export default function FiscalYear() {
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    label: "",
    start_date_ad: "",
    end_date_ad: "",
    start_date_bs: "",
    end_date_bs: "",
  });

  useEffect(() => {
    fetchFiscalYears();
  }, []);

  const fetchFiscalYears = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/fiscal-years');
      const json = await res.json();
      if (json.success) {
        setFiscalYears(json.data || []);
      }
    } catch (err) {
      toast.error("Failed to load fiscal years");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.start_date_ad || !formData.end_date_ad || !formData.label) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      const payload = {
        ...formData,
        status: "inactive",
        is_current: false
      };
      
      const res = await fetch('/api/fiscal-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      
      if (json.success) {
        toast.success("New Fiscal Year Created");
        setFormData({ label: "", start_date_ad: "", end_date_ad: "", start_date_bs: "", end_date_bs: "" });
        setShowForm(false);
        fetchFiscalYears();
      } else {
        toast.error(json.error || "Failed to create fiscal year");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  const handleSetActive = async (id: string) => {
    if (confirm("Set this as the current active fiscal year?")) {
      try {
        const fy = fiscalYears.find(f => f.id === id);
        const res = await fetch(`/api/fiscal-years/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_current: true, status: 'active' })
        });
        const json = await res.json();
        if (json.success) {
          toast.success("Fiscal Year activated");
          fetchFiscalYears();
        } else {
          toast.error(json.error || "Failed to activate");
        }
      } catch (err) {
        toast.error("Network error");
      }
    }
  };

  const handleCloseYear = async (id: string) => {
    try {
      const res = await fetch(`/api/fiscal-years/${id}/close`, {
        method: 'POST'
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Fiscal Year successfully closed!");
        setShowCloseModal(null);
        fetchFiscalYears();
      } else {
        toast.error(json.error || "Failed to process year-end closing");
      }
    } catch (err: any) {
      toast.error("Network error");
    }
  };

  const getStatusBadge = (status: string, isCurrent: boolean) => {
    if (isCurrent) {
      return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-green-100 text-green-700">CURRENT</span>;
    }
    const classes: Record<string, string> = {
      "active": "bg-blue-100 text-blue-700",
      "closed": "bg-gray-100 text-gray-700",
      "inactive": "bg-amber-100 text-amber-700",
    };
    return (
      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${classes[status] || "bg-gray-100 text-gray-700"}`}>
        {status}
      </span>
    );
  };

  if (isLoading) {
    return <div className="p-12 text-center text-gray-500">Loading fiscal years...</div>;
  }

  return (
    <div className="flex flex-col gap-4 animate-fadeIn pb-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Fiscal Year Management</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Manage accounting periods, start new years, and process year-end closings</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Create New Year
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#f5f6fa] border-b border-gray-200">
            <tr>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Label</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Start Date</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">End Date</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {fiscalYears.map(fy => (
              <tr key={fy.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2.5 text-[12px] font-medium text-gray-800">{fy.label}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-600">{fy.start_date_bs || '-'} <span className="text-[10px] text-gray-400">({(fy.start_date_ad || '').split('T')[0]})</span></td>
                <td className="px-3 py-2.5 text-[12px] text-gray-600">{fy.end_date_bs || '-'} <span className="text-[10px] text-gray-400">({(fy.end_date_ad || '').split('T')[0]})</span></td>
                <td className="px-3 py-2.5">{getStatusBadge(fy.status, fy.is_current)}</td>
                <td className="px-3 py-2.5 text-right flex items-center justify-end gap-2">
                  {!fy.is_current && fy.status !== 'closed' && (
                    <button onClick={() => handleSetActive(fy.id)} className="px-2 py-1 bg-white border border-[#1557b0] text-[#1557b0] hover:bg-[#1557b0] hover:text-white rounded text-[10px] font-bold uppercase transition-colors">
                      Set Active
                    </button>
                  )}
                  {(fy.is_current || fy.status === 'active') && (
                    <button onClick={() => setShowCloseModal(fy.id)} className="px-2 py-1 bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white rounded text-[10px] font-bold uppercase transition-colors flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Close Year
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {fiscalYears.length === 0 && (
          <div className="p-8 text-center text-gray-500 text-[12px]">No fiscal years configured.</div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-[#f5f6fa]">
              <h2 className="text-[14px] font-semibold text-gray-800 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#1557b0]" /> Create Fiscal Year
              </h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Label (e.g. 2081/2082)</label>
                  <input type="text" required value={formData.label} onChange={e => setFormData({...formData, label: e.target.value})} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <NepaliDatePicker 
                      label="Start Date" 
                      value={formData.start_date_ad} 
                      onChange={(adStr) => {
                        const bsStr = window.ADToBSString ? window.ADToBSString(adStr) : '';
                        setFormData({...formData, start_date_ad: adStr, start_date_bs: bsStr});
                      }} 
                      required 
                    />
                  </div>
                  <div>
                    <NepaliDatePicker 
                      label="End Date" 
                      value={formData.end_date_ad} 
                      onChange={(adStr) => {
                        const bsStr = window.ADToBSString ? window.ADToBSString(adStr) : '';
                        setFormData({...formData, end_date_ad: adStr, end_date_bs: bsStr});
                      }} 
                      required 
                    />
                  </div>
                </div>
                <div className="bg-blue-50 text-blue-700 text-[11px] p-2 rounded border border-blue-100 flex items-start gap-2 mt-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <p>Fiscal year dates should not overlap. The new year will be marked as "inactive" until activated.</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowForm(false)} className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50">Cancel</button>
                <button type="submit" className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md">Save Fiscal Year</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-red-100 flex items-center justify-between bg-red-50">
              <h2 className="text-[14px] font-semibold text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Confirm Year-End Closure
              </h2>
            </div>
            <div className="p-4 text-[12px] text-gray-700 space-y-3">
              <p>You are about to permanently close <b>{fiscalYears.find(f => f.id === showCloseModal)?.label}</b>. This process will:</p>
              <ul className="space-y-2 list-disc list-inside">
                <li>Verify zero DRAFT vouchers remain.</li>
                <li>Compute Net Profit from all P&L accounts.</li>
                <li>Draft a <b>Closing Journal</b> to zero out Income/Expense ledgers against Retained Earnings.</li>
                <li>Generate an <b>Opening Balance</b> voucher in the next fiscal year for all Balance Sheet accounts.</li>
                <li>Lock the year to prevent any further changes.</li>
              </ul>
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded mt-2 font-bold flex gap-2 items-center">
                <Lock className="w-4 h-4 shrink-0" /> This action is irreversible. Ensure you have backed up your data.
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 bg-gray-50 border-t border-gray-100">
              <button onClick={() => setShowCloseModal(null)} className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleCloseYear(showCloseModal)} className="h-8 px-4 bg-red-600 hover:bg-red-700 text-white text-[12px] font-medium rounded-md shadow-sm">Proceed & Close Year</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
