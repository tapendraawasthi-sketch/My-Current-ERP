// @ts-nocheck
import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useStore } from "../store/useStore";
import { Badge, Button, Card, Select } from "../components/ui";
import {
  FileText,
  ArrowLeftRight,
  ArrowUpFromLine,
  ArrowDownToLine,
  BookOpen,
  ShoppingCart,
  Loader2,
  X,
} from "lucide-react";
import {
  VOUCHER_TYPE_LABELS,
  getVoucherGroupForType,
  getVoucherTypeShortcut,
} from "../lib/voucherUtils";
import toast from "@/lib/appToast";
import { useBranchFilter } from "../hooks/useBranchFilter";

// Lazy-load all voucher pages
const ContraVoucher = lazy(() => import("./ContraVoucher"));
const PaymentVoucher = lazy(() => import("./PaymentVoucher"));
const ReceiptVoucher = lazy(() => import("./ReceiptVoucher"));
const JournalVoucherPage = lazy(() => import("./JournalEntries"));
const SalesVoucher = lazy(() => import("./SalesVoucher"));
const PurchaseVoucher = lazy(() => import("./PurchaseVoucher"));
const CreditNoteVoucher = lazy(() => import("./CreditNoteVoucher"));
const DebitNoteVoucher = lazy(() => import("./DebitNoteVoucher"));
const StockJournalVoucher = lazy(() => import("./StockJournalPage"));
const SalesOrderVoucher = lazy(() => import("./SalesOrderVoucher"));
const MemorandumVoucher = lazy(() => import("./MemorandumVoucher"));
const PhysicalStockVoucher = lazy(() => import("./PhysicalStockPage2"));
const DeliveryChallanVoucher = lazy(() => import("./DeliveryChallan"));
const GoodsReceiptVoucher = lazy(() => import("./GoodsReceiptNote"));
const PurchaseOrderVoucher = lazy(() =>
  import("./OrderVoucherPage").then((m) => ({
    default: () => <m.default type="purchase_order" />,
  })),
);
const PayrollVoucher = lazy(() => import("./Payroll"));
const ReversingJournalVoucher = lazy(() => import("./ReversingJournals"));
const MaterialIssuedVoucher = lazy(() => import("./MaterialIssuedPage"));
const MaterialReceivedVoucher = lazy(() => import("./MaterialReceivedPage"));
const RejectionOutVoucher = lazy(() =>
  import("./RejectionVoucherPage").then((m) => ({
    default: () => <m.default mode="out" />,
  })),
);
const RejectionInVoucher = lazy(() =>
  import("./RejectionVoucherPage").then((m) => ({
    default: () => <m.default mode="in" />,
  })),
);
const JobWorkOutOrderVoucher = lazy(() =>
  import("./JobWorkRegister").then((m) => ({
    default: () => <m.default defaultTab="out" />,
  })),
);
const JobWorkInOrderVoucher = lazy(() =>
  import("./JobWorkRegister").then((m) => ({
    default: () => <m.default defaultTab="in" />,
  })),
);
const AttendanceVoucher = lazy(() => import("./PayrollRun"));

const VoucherEntryHub: React.FC = () => {
  const [activeVoucherType, setActiveVoucherType] = useState<string>("sales-invoice");
  const [showVoucherPicker, setShowVoucherPicker] = useState<boolean>(false);
  const { voucherTypeMasters } = useStore();
  const { branchFilter, setBranchFilter, branchOptions } = useBranchFilter();

  // Get active voucher types from store
  const activeVoucherTypes = voucherTypeMasters
    .filter((vtm) => vtm.isActive)
    .map((vtm) => vtm.parentVoucherType);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F4") {
        e.preventDefault();
        setActiveVoucherType("contra");
      } else if (e.key === "F5") {
        e.preventDefault();
        setActiveVoucherType("payment");
      } else if (e.key === "F6") {
        e.preventDefault();
        setActiveVoucherType("receipt");
      } else if (e.key === "F7") {
        e.preventDefault();
        setActiveVoucherType("journal");
      } else if (e.key === "F8") {
        e.preventDefault();
        setActiveVoucherType("sales-invoice");
      } else if (e.key === "F9") {
        e.preventDefault();
        setActiveVoucherType("purchase-invoice");
      } else if (e.key === "F10") {
        e.preventDefault();
        setShowVoucherPicker(true);
      } else if (e.altKey && e.key === "F5") {
        e.preventDefault();
        setActiveVoucherType("debit-note");
      } else if (e.altKey && e.key === "F6") {
        e.preventDefault();
        setActiveVoucherType("credit-note");
      } else if (e.altKey && e.key === "F7") {
        e.preventDefault();
        setActiveVoucherType("stock-journal");
      } else if (e.ctrlKey && e.key === "F4") {
        e.preventDefault();
        setActiveVoucherType("payroll");
      } else if (e.ctrlKey && e.key === "F5") {
        e.preventDefault();
        setActiveVoucherType("rejection-out");
      } else if (e.ctrlKey && e.key === "F6") {
        e.preventDefault();
        setActiveVoucherType("rejection-in");
      } else if (e.ctrlKey && e.key === "F7") {
        e.preventDefault();
        setActiveVoucherType("physical-stock");
      } else if (e.ctrlKey && e.key === "F8") {
        e.preventDefault();
        setActiveVoucherType("sales-order");
      } else if (e.ctrlKey && e.key === "F9") {
        e.preventDefault();
        setActiveVoucherType("purchase-order");
      } else if (e.ctrlKey && e.key === "F10") {
        e.preventDefault();
        setActiveVoucherType("memorandum");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Get icon for voucher type
  const getVoucherIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      contra: <ArrowLeftRight className="w-6 h-6" />,
      payment: <ArrowUpFromLine className="w-6 h-6" />,
      receipt: <ArrowDownToLine className="w-6 h-6" />,
      journal: <BookOpen className="w-6 h-6" />,
      "journal-voucher": <BookOpen className="w-6 h-6" />,
      "sales-invoice": <FileText className="w-6 h-6" />,
      "purchase-invoice": <ShoppingCart className="w-6 h-6" />,
      "credit-note": <FileText className="w-6 h-6" />,
      "debit-note": <FileText className="w-6 h-6" />,
      "stock-journal": <FileText className="w-6 h-6" />,
      "physical-stock": <FileText className="w-6 h-6" />,
      "delivery-note": <FileText className="w-6 h-6" />,
      "receipt-note": <FileText className="w-6 h-6" />,
      "rejection-in": <FileText className="w-6 h-6" />,
      "rejection-out": <FileText className="w-6 h-6" />,
      "material-in": <FileText className="w-6 h-6" />,
      "material-out": <FileText className="w-6 h-6" />,
      "sales-order": <FileText className="w-6 h-6" />,
      "purchase-order": <FileText className="w-6 h-6" />,
      "job-work-out-order": <FileText className="w-6 h-6" />,
      "job-work-in-order": <FileText className="w-6 h-6" />,
      payroll: <FileText className="w-6 h-6" />,
      attendance: <FileText className="w-6 h-6" />,
      memorandum: <FileText className="w-6 h-6" />,
      "reversing-journal": <FileText className="w-6 h-6" />,
    };
    return icons[type] || <FileText className="w-6 h-6" />;
  };

  // Group voucher types by category
  const groupedVoucherTypes = {
    accounting: [
      "contra",
      "payment",
      "receipt",
      "journal",
      "journal-voucher",
      "sales-invoice",
      "purchase-invoice",
      "credit-note",
      "debit-note",
    ],
    inventory: [
      "stock-journal",
      "physical-stock",
      "delivery-note",
      "receipt-note",
      "rejection-in",
      "rejection-out",
      "material-in",
      "material-out",
    ],
    order: ["sales-order", "purchase-order", "job-work-out-order", "job-work-in-order"],
    payroll: ["payroll", "attendance"],
    other: ["memorandum", "reversing-journal"],
  };

  const renderVoucherForm = () => {
    switch (activeVoucherType) {
      case "contra":
        return <ContraVoucher />;
      case "payment":
        return <PaymentVoucher />;
      case "receipt":
        return <ReceiptVoucher />;
      case "journal":
      case "journal-voucher":
        return <JournalVoucherPage />;
      case "sales-invoice":
        return <SalesVoucher />;
      case "purchase-invoice":
        return <PurchaseVoucher />;
      case "credit-note":
        return <CreditNoteVoucher />;
      case "debit-note":
        return <DebitNoteVoucher />;
      case "stock-journal":
        return <StockJournalVoucher />;
      case "physical-stock":
        return <PhysicalStockVoucher />;
      case "delivery-note":
        return <DeliveryChallanVoucher />;
      case "receipt-note":
        return <GoodsReceiptVoucher />;
      case "material-out":
      case "material-issued":
        return <MaterialIssuedVoucher />;
      case "material-in":
      case "material-received":
        return <MaterialReceivedVoucher />;
      case "purchase-order":
        return <PurchaseOrderVoucher />;
      case "payroll":
        return <PayrollVoucher />;
      case "reversing-journal":
        return <ReversingJournalVoucher />;
      case "rejection-out":
        return <RejectionOutVoucher />;
      case "rejection-in":
        return <RejectionInVoucher />;
      case "job-work-out-order":
        return <JobWorkOutOrderVoucher />;
      case "job-work-in-order":
        return <JobWorkInOrderVoucher />;
      case "attendance":
        return <AttendanceVoucher />;
      case "sales-order":
        return <SalesOrderVoucher />;
      case "memorandum":
        return <MemorandumVoucher />;
      default:
        return (
          <Card className="flex flex-col items-center justify-center p-8 m-8">
            <div className="mb-4 text-gray-500">{getVoucherIcon(activeVoucherType)}</div>
            <h2 className="text-xl font-bold mb-2">
              {VOUCHER_TYPE_LABELS[activeVoucherType] || activeVoucherType}
            </h2>
            <p className="text-gray-600 mb-4 text-center">
              This voucher type is being implemented. Use{" "}
              {activeVoucherType.includes("sales") ? "Sales Invoice" : "Journal Voucher"} for now.
            </p>
            <Button
              variant="outline"
              onClick={() =>
                setActiveVoucherType(
                  activeVoucherType.includes("sales") ? "sales-invoice" : "journal",
                )
              }
            >
              Go to Similar Voucher
            </Button>
          </Card>
        );
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-gray-200 p-2 sticky top-0 z-30">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
          <button
            className={`flex flex-col items-center p-2 rounded-md text-sm ${
              activeVoucherType === "contra" ? "bg-green-600 text-white" : "hover:bg-gray-100"
            }`}
            onClick={() => setActiveVoucherType("contra")}
          >
            <span>F4</span>
            <span>Contra</span>
          </button>
          <button
            className={`flex flex-col items-center p-2 rounded-md text-sm ${
              activeVoucherType === "payment" ? "bg-green-600 text-white" : "hover:bg-gray-100"
            }`}
            onClick={() => setActiveVoucherType("payment")}
          >
            <span>F5</span>
            <span>Payment</span>
          </button>
          <button
            className={`flex flex-col items-center p-2 rounded-md text-sm ${
              activeVoucherType === "receipt" ? "bg-green-600 text-white" : "hover:bg-gray-100"
            }`}
            onClick={() => setActiveVoucherType("receipt")}
          >
            <span>F6</span>
            <span>Receipt</span>
          </button>
          <button
            className={`flex flex-col items-center p-2 rounded-md text-sm ${
              activeVoucherType === "journal" ? "bg-green-600 text-white" : "hover:bg-gray-100"
            }`}
            onClick={() => setActiveVoucherType("journal")}
          >
            <span>F7</span>
            <span>Journal</span>
          </button>
          <button
            className={`flex flex-col items-center p-2 rounded-md text-sm ${
              activeVoucherType === "sales-invoice"
                ? "bg-green-600 text-white"
                : "hover:bg-gray-100"
            }`}
            onClick={() => setActiveVoucherType("sales-invoice")}
          >
            <span>F8</span>
            <span>Sales</span>
          </button>
          <button
            className={`flex flex-col items-center p-2 rounded-md text-sm ${
              activeVoucherType === "purchase-invoice"
                ? "bg-green-600 text-white"
                : "hover:bg-gray-100"
            }`}
            onClick={() => setActiveVoucherType("purchase-invoice")}
          >
            <span>F9</span>
            <span>Purchase</span>
          </button>
          <button
            className={`flex flex-col items-center p-2 rounded-md text-sm ${
              showVoucherPicker ? "bg-green-600 text-white" : "hover:bg-gray-100"
            }`}
            onClick={() => setShowVoucherPicker(true)}
          >
            <span>F10</span>
            <span>More...</span>
          </button>
          </div>
          {branchOptions.length > 0 ? (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              aria-label="Branch filter"
            >
              <option value="all">All branches</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || b.code || b.id}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin w-8 h-8 text-green-600" />
            </div>
          }
        >
          {renderVoucherForm()}
        </Suspense>
      </div>

      {/* All Vouchers Picker (Modal) */}
      {showVoucherPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">All Voucher Types</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowVoucherPicker(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4">
              {/* Accounting Vouchers */}
              <div className="mb-6">
                <h3 className="text-md font-semibold mb-2 text-gray-700">Accounting Vouchers</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {groupedVoucherTypes.accounting
                    .filter((type) => activeVoucherTypes.includes(type))
                    .map((type) => (
                      <button
                        key={type}
                        className="flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                        onClick={() => {
                          setActiveVoucherType(type);
                          setShowVoucherPicker(false);
                        }}
                      >
                        <div className="text-gray-500 mb-1">{getVoucherIcon(type)}</div>
                        <span className="text-sm text-center">{VOUCHER_TYPE_LABELS[type]}</span>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {getVoucherTypeShortcut(type)}
                        </Badge>
                      </button>
                    ))}
                </div>
              </div>

              {/* Inventory Vouchers */}
              <div className="mb-6">
                <h3 className="text-md font-semibold mb-2 text-gray-700">Inventory Vouchers</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {groupedVoucherTypes.inventory
                    .filter((type) => activeVoucherTypes.includes(type))
                    .map((type) => (
                      <button
                        key={type}
                        className="flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                        onClick={() => {
                          setActiveVoucherType(type);
                          setShowVoucherPicker(false);
                        }}
                      >
                        <div className="text-gray-500 mb-1">{getVoucherIcon(type)}</div>
                        <span className="text-sm text-center">{VOUCHER_TYPE_LABELS[type]}</span>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {getVoucherTypeShortcut(type)}
                        </Badge>
                      </button>
                    ))}
                </div>
              </div>

              {/* Order Vouchers */}
              <div className="mb-6">
                <h3 className="text-md font-semibold mb-2 text-gray-700">Order Vouchers</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {groupedVoucherTypes.order
                    .filter((type) => activeVoucherTypes.includes(type))
                    .map((type) => (
                      <button
                        key={type}
                        className="flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                        onClick={() => {
                          setActiveVoucherType(type);
                          setShowVoucherPicker(false);
                        }}
                      >
                        <div className="text-gray-500 mb-1">{getVoucherIcon(type)}</div>
                        <span className="text-sm text-center">{VOUCHER_TYPE_LABELS[type]}</span>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {getVoucherTypeShortcut(type)}
                        </Badge>
                      </button>
                    ))}
                </div>
              </div>

              {/* Payroll Vouchers */}
              <div className="mb-6">
                <h3 className="text-md font-semibold mb-2 text-gray-700">Payroll Vouchers</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {groupedVoucherTypes.payroll
                    .filter((type) => activeVoucherTypes.includes(type))
                    .map((type) => (
                      <button
                        key={type}
                        className="flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                        onClick={() => {
                          setActiveVoucherType(type);
                          setShowVoucherPicker(false);
                        }}
                      >
                        <div className="text-gray-500 mb-1">{getVoucherIcon(type)}</div>
                        <span className="text-sm text-center">{VOUCHER_TYPE_LABELS[type]}</span>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {getVoucherTypeShortcut(type)}
                        </Badge>
                      </button>
                    ))}
                </div>
              </div>

              {/* Other Vouchers */}
              <div className="mb-6">
                <h3 className="text-md font-semibold mb-2 text-gray-700">Other Vouchers</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {groupedVoucherTypes.other
                    .filter((type) => activeVoucherTypes.includes(type))
                    .map((type) => (
                      <button
                        key={type}
                        className="flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                        onClick={() => {
                          setActiveVoucherType(type);
                          setShowVoucherPicker(false);
                        }}
                      >
                        <div className="text-gray-500 mb-1">{getVoucherIcon(type)}</div>
                        <span className="text-sm text-center">{VOUCHER_TYPE_LABELS[type]}</span>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {getVoucherTypeShortcut(type)}
                        </Badge>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Status Bar */}
      <div className="bg-gray-100 border-t border-gray-200 p-2 text-sm text-gray-600 flex justify-between items-center sticky bottom-0">
        <div>Active: {VOUCHER_TYPE_LABELS[activeVoucherType] || activeVoucherType}</div>
        <div>{getVoucherTypeShortcut(activeVoucherType)} | F10: All Vouchers</div>
      </div>
    </div>
  );
};

export default VoucherEntryHub;
