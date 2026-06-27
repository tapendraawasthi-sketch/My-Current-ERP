import React from "react";
import { useStore } from "../../store/useStore";
import { NepaliDatePicker, Badge, Input } from "../ui";
import { ADToBSString } from "../../lib/nepaliDate";
import { formatVoucherDisplayDate, VOUCHER_TYPE_LABELS, getVoucherStatusColor } from "../../lib/voucherUtils";

interface VoucherHeaderProps {
  voucherTypeName: string;
  voucherNumber: string;
  date: string;
  onDateChange: (date: string) => void;
  effectiveDate?: string;
  onEffectiveDateChange?: (date: string) => void;
  showEffectiveDate?: boolean;
  referenceNumber?: string;
  onReferenceNumberChange?: (val: string) => void;
  showReferenceNumber?: boolean;
  isOptional?: boolean;
  isPostDated?: boolean;
  isCancelled?: boolean;
  isEdit?: boolean;
  mode?: string;
}

const VoucherHeader: React.FC<VoucherHeaderProps> = ({
  voucherTypeName,
  voucherNumber,
  date,
  onDateChange,
  effectiveDate,
  onEffectiveDateChange,
  showEffectiveDate,
  referenceNumber,
  onReferenceNumberChange,
  showReferenceNumber,
  isOptional,
  isPostDated,
  isCancelled,
  isEdit,
  mode
}) => {
  const { companySettings, currentFiscalYear } = useStore();
  
  const companyName = companySettings?.name || "My Company";
  const fiscalYearName = currentFiscalYear?.name || "Current Year";
  
  // Convert AD date to BS date
  const bsDate = ADToBSString(date);
  
  return (
    <div className="bg-green-50 dark:bg-green-950 border-b border-green-200 dark:border-green-800 p-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left Section */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {companyName}
          </div>
          
          <div className="text-lg font-bold text-green-700 dark:text-green-300">
            {voucherTypeName}
          </div>
          
          {mode && (
            <Badge variant="default" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
              {mode}
            </Badge>
          )}
          
          <div className="flex gap-2">
            {isOptional && (
              <Badge variant="default" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
                Optional
              </Badge>
            )}
            
            {isPostDated && (
              <Badge variant="default" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200">
                Post-Dated
              </Badge>
            )}
            
            {isCancelled && (
              <Badge variant="default" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">
                Cancelled
              </Badge>
            )}
            
            {isEdit && (
              <Badge variant="default" className="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                Edit Mode
              </Badge>
            )}
          </div>
        </div>
        
        {/* Center Section */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 dark:text-gray-400">Voucher No:</label>
            <span className="font-mono text-sm font-medium text-green-600 dark:text-green-300">
              {voucherNumber}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 dark:text-gray-400">Date:</label>
            <div className="w-36 text-sm">
              <NepaliDatePicker
                value={date}
                onChange={onDateChange}
              />
            </div>
          </div>
          
          {showEffectiveDate && onEffectiveDateChange && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 dark:text-gray-400">Eff. Date:</label>
              <div className="w-36 text-sm">
                <NepaliDatePicker
                  value={effectiveDate || ""}
                  onChange={onEffectiveDateChange}
                />
              </div>
            </div>
          )}
          
          {showReferenceNumber && onReferenceNumberChange && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 dark:text-gray-400">Ref. No:</label>
              <Input
                value={referenceNumber || ""}
                onChange={(val: any) => onReferenceNumberChange(val?.target ? val.target.value : val)}
                className="w-32 text-sm"
                placeholder="Reference no."
              />
            </div>
          )}
        </div>
        
        {/* Right Section */}
        <div className="flex items-center gap-4">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {fiscalYearName}
          </div>
          
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {bsDate}
          </div>
          
          {isEdit && (
            <div className="text-xs text-amber-600 dark:text-amber-400">
              Editing
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoucherHeader;
