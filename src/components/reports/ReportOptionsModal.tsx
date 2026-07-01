import React, { useState, useEffect } from "react";
import ReportDateRangePicker from "../ui/ReportDateRangePicker";

export interface ReportOptions {
  layout: "horizontal" | "vertical";
  fromDate: string;
  toDate: string;
  showSecondLevel: boolean;
  branchId: string;
  fiscalYearId: string;
  monthlyVariant: boolean;
}

export interface ReportOptionsModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  onGenerate: (opts: ReportOptions) => void;
  showBranchSelector?: boolean;
  showMonthlyVariant?: boolean;
  fiscalYears: any[];
  currentFiscalYear: any;
  branches: { id: string; name: string }[];
}

const today = () => new Date().toISOString().slice(0, 10);

const inputCls =
  "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full";

const ReportOptionsModal: React.FC<ReportOptionsModalProps> = ({
  title,
  open,
  onClose,
  onGenerate,
  showBranchSelector = false,
  showMonthlyVariant = false,
  fiscalYears,
  currentFiscalYear,
  branches,
}) => {
  const [layout, setLayout] = useState<"horizontal" | "vertical">("vertical");
  const [fromDate, setFromDate] = useState(currentFiscalYear?.startDate ?? "");
  const [toDate, setToDate] = useState(today());
  const [showSecondLevel, setShowSecondLevel] = useState(false);
  const [branchId, setBranchId] = useState("all");
  const [fiscalYearId, setFiscalYearId] = useState(currentFiscalYear?.id ?? "");
  const [monthlyVariant, setMonthlyVariant] = useState(false);

  // Reset defaults when modal opens
  useEffect(() => {
    if (open) {
      setLayout("vertical");
      setFromDate(currentFiscalYear?.startDate ?? "");
      setToDate(today());
      setShowSecondLevel(false);
      setBranchId("all");
      setFiscalYearId(currentFiscalYear?.id ?? "");
      setMonthlyVariant(false);
    }
  }, [open, currentFiscalYear]);

  if (!open) return null;

  const handleGenerate = () => {
    onGenerate({ layout, fromDate, toDate, showSecondLevel, branchId, fiscalYearId, monthlyVariant });
    onClose();
  };

  const cardBase =
    "flex-1 border-2 rounded-md p-3 cursor-pointer text-[12px] font-medium text-center transition-colors";
  const cardActive = "border-[#1557b0] bg-[#e8f0fe] text-[#1557b0]";
  const cardInactive = "border-gray-200 bg-white text-gray-700 hover:border-gray-300";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1557b0] text-white">
          <span className="text-[13px] font-semibold">{title} — Report Options</span>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Layout selector */}
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1.5">
              Report Layout
            </label>
            <div className="flex gap-3">
              <div
                className={`${cardBase} ${layout === "horizontal" ? cardActive : cardInactive}`}
                onClick={() => setLayout("horizontal")}
              >
                Horizontal (T-Format)
              </div>
              <div
                className={`${cardBase} ${layout === "vertical" ? cardActive : cardInactive}`}
                onClick={() => setLayout("vertical")}
              >
                Vertical (Column)
              </div>
            </div>
          </div>

          {/* Date range */}
          <div className="mb-4">
            <ReportDateRangePicker
              value={{ fromDate, toDate }}
              onChange={(r) => {
                setFromDate(r.fromDate);
                setToDate(r.toDate);
              }}
              label="Report Period"
            />
          </div>

          {/* Fiscal Year */}
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">Fiscal Year</label>
            <select
              className={inputCls}
              value={fiscalYearId}
              onChange={(e) => setFiscalYearId(e.target.value)}
            >
              {fiscalYears.map((fy: any) => (
                <option key={fy.id} value={fy.id}>
                  {fy.name ?? fy.label ?? fy.id}
                </option>
              ))}
            </select>
          </div>

          {/* Branch selector */}
          {showBranchSelector && (
            <div>
              <label className="text-[11px] font-medium text-gray-600 block mb-1">Branch</label>
              <select
                className={inputCls}
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="all">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Second level details */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="secondLevel"
              checked={showSecondLevel}
              onChange={(e) => setShowSecondLevel(e.target.checked)}
              className="h-4 w-4 accent-[#1557b0]"
            />
            <label htmlFor="secondLevel" className="text-[12px] text-gray-700 cursor-pointer">
              Show Second Level Details (Y/N)
            </label>
          </div>

          {/* Monthly variant */}
          {showMonthlyVariant && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="monthlyVariant"
                checked={monthlyVariant}
                onChange={(e) => setMonthlyVariant(e.target.checked)}
                className="h-4 w-4 accent-[#1557b0]"
              />
              <label htmlFor="monthlyVariant" className="text-[12px] text-gray-700 cursor-pointer">
                Monthly Summary View
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md"
          >
            Generate Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportOptionsModal;
