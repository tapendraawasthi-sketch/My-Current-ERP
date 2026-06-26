import React, { useState, useRef, useEffect } from "react";
import { 
  ArrowLeftRight, 
  ArrowUpFromLine, 
  ArrowDownToLine, 
  BookOpen, 
  FileText, 
  ShoppingCart, 
  MoreHorizontal, 
  ToggleLeft, 
  Calendar, 
  Wand2, 
  Info, 
  Check, 
  Settings 
} from "lucide-react";

interface VoucherRightBarProps {
  currentVoucherType: string;
  onChangeVoucherType: (type: string) => void;
  isOptional: boolean;
  isPostDated: boolean;
  onToggleOptional: () => void;
  onTogglePostDated: () => void;
  onAutofill?: () => void;
  onMoreDetails?: () => void;
  onAccept: () => void;
  onConfigure?: () => void;
  onChangeMode?: () => void;
  disabled?: boolean;
}

const VoucherRightBar: React.FC<VoucherRightBarProps> = ({
  currentVoucherType,
  onChangeVoucherType,
  isOptional,
  isPostDated,
  onToggleOptional,
  onTogglePostDated,
  onAutofill,
  onMoreDetails,
  onAccept,
  onConfigure,
  onChangeMode,
  disabled
}) => {
  const [showOtherMenu, setShowOtherMenu] = useState(false);
  const otherMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (otherMenuRef.current && !otherMenuRef.current.contains(event.target as Node)) {
        setShowOtherMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getVoucherTypeIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      "contra": <ArrowLeftRight className="w-4 h-4" />,
      "payment": <ArrowUpFromLine className="w-4 h-4" />,
      "receipt": <ArrowDownToLine className="w-4 h-4" />,
      "journal": <BookOpen className="w-4 h-4" />,
      "sales-invoice": <FileText className="w-4 h-4" />,
      "purchase-invoice": <ShoppingCart className="w-4 h-4" />,
    };
    return icons[type] || <FileText className="w-4 h-4" />;
  };

  const getButtonClasses = (isActive: boolean, isHighlighted: boolean = false) => {
    let base = "w-full py-1 px-2 text-xs flex flex-col items-center justify-center transition-colors ";
    
    if (isActive) {
      base += "bg-green-600 text-white ";
    } else if (isHighlighted) {
      base += "bg-amber-500 text-white ";
    } else {
      base += "bg-green-800 text-white hover:bg-green-700 ";
    }
    
    if (disabled) {
      base += "opacity-50 pointer-events-none ";
    }
    
    return base;
  };

  const otherVoucherOptions = [
    { label: "Credit Note", shortcut: "Alt+F6", type: "credit-note" },
    { label: "Debit Note", shortcut: "Alt+F5", type: "debit-note" },
    { label: "Stock Journal", shortcut: "Alt+F7", type: "stock-journal" },
    { label: "Physical Stock", shortcut: "Ctrl+F7", type: "physical-stock" },
    { label: "Delivery Note", shortcut: "Alt+F8", type: "delivery-note" },
    { label: "Receipt Note", shortcut: "Alt+F9", type: "receipt-note" },
    { label: "Sales Order", shortcut: "Ctrl+F8", type: "sales-order" },
    { label: "Purchase Order", shortcut: "Ctrl+F9", type: "purchase-order" },
    { label: "Payroll", shortcut: "Ctrl+F4", type: "payroll" },
    { label: "Memorandum", shortcut: "Ctrl+F10", type: "memorandum" },
  ];

  return (
    <div className={`fixed top-1/2 right-0 transform -translate-y-1/2 w-24 bg-green-900 text-white z-40 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex flex-col items-center py-2">
        {/* Date [F2] */}
        <button className={getButtonClasses(false)}>
          <span className="text-[10px] text-gray-300">F2</span>
          <span>Date</span>
        </button>

        {/* Company [F3] */}
        <button className={getButtonClasses(false)}>
          <span className="text-[10px] text-gray-300">F3</span>
          <span>Company</span>
        </button>

        {/* Separator */}
        <div className="w-full h-px bg-gray-600 my-1"></div>

        {/* Contra [F4] */}
        <button 
          className={getButtonClasses(currentVoucherType === "contra")}
          onClick={() => onChangeVoucherType("contra")}
        >
          <span className="text-[10px] text-gray-300">F4</span>
          <span>Contra</span>
        </button>

        {/* Payment [F5] */}
        <button 
          className={getButtonClasses(currentVoucherType === "payment")}
          onClick={() => onChangeVoucherType("payment")}
        >
          <span className="text-[10px] text-gray-300">F5</span>
          <span>Payment</span>
        </button>

        {/* Receipt [F6] */}
        <button 
          className={getButtonClasses(currentVoucherType === "receipt")}
          onClick={() => onChangeVoucherType("receipt")}
        >
          <span className="text-[10px] text-gray-300">F6</span>
          <span>Receipt</span>
        </button>

        {/* Journal [F7] */}
        <button 
          className={getButtonClasses(currentVoucherType === "journal" || currentVoucherType === "journal-voucher")}
          onClick={() => onChangeVoucherType("journal")}
        >
          <span className="text-[10px] text-gray-300">F7</span>
          <span>Journal</span>
        </button>

        {/* Sales [F8] */}
        <button 
          className={getButtonClasses(currentVoucherType === "sales-invoice")}
          onClick={() => onChangeVoucherType("sales-invoice")}
        >
          <span className="text-[10px] text-gray-300">F8</span>
          <span>Sales</span>
        </button>

        {/* Purchase [F9] */}
        <button 
          className={getButtonClasses(currentVoucherType === "purchase-invoice")}
          onClick={() => onChangeVoucherType("purchase-invoice")}
        >
          <span className="text-[10px] text-gray-300">F9</span>
          <span>Purchase</span>
        </button>

        {/* Other Vouchers [F10] */}
        <div className="relative" ref={otherMenuRef}>
          <button 
            className={getButtonClasses(false)}
            onClick={() => setShowOtherMenu(!showOtherMenu)}
          >
            <span className="text-[10px] text-gray-300">F10</span>
            <span>Other</span>
          </button>

          {/* Dropdown Menu */}
          {showOtherMenu && (
            <div className="absolute left-full top-0 ml-1 bg-green-800 text-white text-xs rounded shadow-lg z-50 min-w-40">
              {otherVoucherOptions.map((option, index) => (
                <button
                  key={index}
                  className={`w-full px-3 py-2 text-left hover:bg-green-700 flex justify-between items-center ${currentVoucherType === option.type ? 'bg-green-600' : ''}`}
                  onClick={() => {
                    onChangeVoucherType(option.type);
                    setShowOtherMenu(false);
                  }}
                >
                  <span>{option.label}</span>
                  <span className="text-gray-400 ml-2">{option.shortcut}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="w-full h-px bg-gray-600 my-1"></div>

        {/* Change Mode [Ctrl+H] */}
        <button 
          className={getButtonClasses(false)}
          onClick={onChangeMode}
        >
          <span className="text-[10px] text-gray-300">Ctrl+H</span>
          <span>Change Mode</span>
        </button>

        {/* Optional [Ctrl+L] */}
        <button 
          className={getButtonClasses(false, isOptional)}
          onClick={onToggleOptional}
        >
          <span className="text-[10px] text-gray-300">Ctrl+L</span>
          <span>Optional</span>
        </button>

        {/* Post-Dated [Ctrl+T] */}
        <button 
          className={getButtonClasses(false, isPostDated)}
          onClick={onTogglePostDated}
        >
          <span className="text-[10px] text-gray-300">Ctrl+T</span>
          <span>Post-Dated</span>
        </button>

        {/* Autofill [Ctrl+F] */}
        <button 
          className={getButtonClasses(false)}
          onClick={onAutofill}
        >
          <span className="text-[10px] text-gray-300">Ctrl+F</span>
          <span>Autofill</span>
        </button>

        {/* More Details [Ctrl+I] */}
        <button 
          className={getButtonClasses(false)}
          onClick={onMoreDetails}
        >
          <span className="text-[10px] text-gray-300">Ctrl+I</span>
          <span>More Details</span>
        </button>

        {/* Separator */}
        <div className="w-full h-px bg-gray-600 my-1"></div>

        {/* Accept [Ctrl+A] */}
        <button 
          className="w-full py-1 px-2 text-xs flex flex-col items-center justify-center bg-green-600 text-white hover:bg-green-500 transition-colors"
          onClick={onAccept}
        >
          <span className="text-[10px] text-gray-200">Ctrl+A</span>
          <span>Accept</span>
        </button>

        {/* Configure [F12] */}
        <button 
          className={getButtonClasses(false)}
          onClick={onConfigure}
        >
          <span className="text-[10px] text-gray-300">F12</span>
          <span>Configure</span>
        </button>
      </div>
    </div>
  );
};

export default VoucherRightBar;
