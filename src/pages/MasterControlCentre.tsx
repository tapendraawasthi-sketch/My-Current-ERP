import React, { useState } from "react";
import { useStore } from "../store";
import { 
  FolderOpen, Layers, BookOpen, ScrollText, Map, TrendingUp, TrendingDown, 
  Activity, Banknote, Package, Tags, ArrowLeftRight, Archive, RefreshCw, 
  FileText, FileBarChart, Users, ClipboardList, Calendar, ExternalLink
} from "lucide-react";

const MasterControlCentre: React.FC = () => {
  const { 
    setCurrentPage, 
    accounts, 
    items, 
    employees, 
    payHeads, 
    stockCategories, 
    vatClassifications, 
    tdsNatureOfPayment, 
    employeeGroups, 
    payrollUnits, 
    attendanceTypes, 
    costCategories, 
    costCentreClasses, 
    priceLevels, 
    priceLists, 
    hsCodes, 
    batches, 
    voucherTypeMasters, 
    scenarios, 
    reorderLevels 
  } = useStore();
  
  const [activeTab, setActiveTab] = useState("accounting");

  const totalLedgers = (accounts || []).filter(a => !a.isGroup).length;
  const totalStockItems = (items || []).length;
  const totalEmployees = (employees || []).length;
  const totalPayHeads = (payHeads || []).length;

  const accountingCards = [
    { label: "Chart of Accounts", page: "accounts", count: (accounts || []).length, icon: FolderOpen },
    { label: "Account Groups", page: "account-groups", count: (accounts || []).filter(a => a.isGroup).length, icon: Layers },
    { label: "Ledger Master", page: "ledgers", count: totalLedgers, icon: BookOpen },
    { label: "Voucher Types", page: "voucher-types", count: (voucherTypeMasters || []).length, icon: ScrollText },
    { label: "Cost Categories", page: "cost-categories", count: (costCategories || []).length, icon: Map },
    { label: "Cost Centre Classes", page: "cost-centre-classes", count: (costCentreClasses || []).length, icon: Layers },
    { label: "Budget Master", page: "budget", count: 0, icon: TrendingUp },
    { label: "Scenario Master", page: "scenarios", count: (scenarios || []).length, icon: Activity },
    { label: "Currency Master", page: "currency-master", count: 0, icon: Banknote },
  ];

  const inventoryCards = [
    { label: "Stock Items", page: "items", count: (items || []).length, icon: Package },
    { label: "Item Groups", page: "item-groups", count: 0, icon: Layers },
    { label: "Stock Categories", page: "stock-categories", count: (stockCategories || []).length, icon: FolderOpen },
    { label: "Units of Measure", page: "units", count: 0, icon: Tags },
    { label: "Unit Conversions", page: "unit-conversions", count: 0, icon: ArrowLeftRight },
    { label: "Warehouses / Godowns", page: "warehouses", count: 0, icon: Archive },
    { label: "Reorder Levels", page: "reorder-levels", count: (reorderLevels || []).length, icon: RefreshCw },
    { label: "Price Levels", page: "price-levels", count: (priceLevels || []).length, icon: Tags },
    { label: "Price Lists", page: "price-lists", count: (priceLists || []).length, icon: FileText },
    { label: "HS Codes (Nepal)", page: "hs-codes", count: (hsCodes || []).length, icon: FileBarChart },
    { label: "Batch Master", page: "batches", count: (batches || []).length, icon: Archive },
  ];

  const statutoryCards = [
    { label: "VAT Classifications", page: "vat-classifications", count: (vatClassifications || []).length, icon: FileBarChart },
    { label: "TDS Nature of Payment", page: "tds-nature-of-payments", count: (tdsNatureOfPayment || []).length, icon: FileText },
    { label: "Sale Types (VAT)", page: "sale-types", count: 0, icon: TrendingUp },
    { label: "Purchase Types", page: "purchase-types", count: 0, icon: TrendingDown },
    { label: "Tax Categories", page: "tax-categories", count: 0, icon: FileBarChart },
    { label: "Bill Sundries", page: "bill-sundries", count: 0, icon: FileText },
  ];

  const payrollCards = [
    { label: "Employees", page: "employees", count: (employees || []).length, icon: Users },
    { label: "Employee Groups", page: "employee-groups", count: (employeeGroups || []).length, icon: Users },
    { label: "Pay Heads", page: "pay-heads", count: (payHeads || []).length, icon: Banknote },
    { label: "Salary Details", page: "salary-details", count: 0, icon: ClipboardList },
    { label: "Payroll Units", page: "payroll-units", count: (payrollUnits || []).length, icon: Tags },
    { label: "Attendance Types", page: "attendance-types", count: (attendanceTypes || []).length, icon: Calendar },
    { label: "Payroll Run", page: "payroll-run", count: 0, icon: ClipboardList },
  ];

  const renderCard = (card: any, index: number) => {
    const IconComponent = card.icon;
    return (
      <div
        key={index}
        onClick={() => setCurrentPage(card.page)}
        className="bg-white border border-gray-200 rounded-md p-4 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-[#1557b0] hover:shadow-md transition-all group"
      >
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-[#1557b0] group-hover:bg-[#1557b0] group-hover:text-white transition-colors">
          <IconComponent size={24} />
        </div>
        <div className="text-center">
          <div className="text-[13px] font-semibold text-gray-800">{card.label}</div>
          <div className="text-[11px] text-gray-500 mt-1">Count: {card.count}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col bg-gray-50 overflow-hidden">
      <div className="p-4 bg-white border-b border-gray-200">
        <h2 className="text-[18px] font-bold text-gray-800">Master Control Centre</h2>
        <p className="text-[12px] text-gray-500 mt-1">Centralized dashboard for all masters in the ERP</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {/* Stats Summary Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-blue-200 rounded-lg p-4 text-center shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -mr-4 -mt-4 z-0"></div>
            <div className="relative z-10">
              <div className="text-[28px] font-bold text-blue-700 leading-none">{totalLedgers}</div>
              <div className="text-[11px] font-medium text-blue-600 mt-2 uppercase tracking-wide">Total Ledgers</div>
            </div>
          </div>
          <div className="bg-white border border-green-200 rounded-lg p-4 text-center shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-green-50 rounded-bl-full -mr-4 -mt-4 z-0"></div>
            <div className="relative z-10">
              <div className="text-[28px] font-bold text-green-700 leading-none">{totalStockItems}</div>
              <div className="text-[11px] font-medium text-green-600 mt-2 uppercase tracking-wide">Stock Items</div>
            </div>
          </div>
          <div className="bg-white border border-amber-200 rounded-lg p-4 text-center shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-50 rounded-bl-full -mr-4 -mt-4 z-0"></div>
            <div className="relative z-10">
              <div className="text-[28px] font-bold text-amber-700 leading-none">{totalEmployees}</div>
              <div className="text-[11px] font-medium text-amber-600 mt-2 uppercase tracking-wide">Total Employees</div>
            </div>
          </div>
          <div className="bg-white border border-purple-200 rounded-lg p-4 text-center shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-purple-50 rounded-bl-full -mr-4 -mt-4 z-0"></div>
            <div className="relative z-10">
              <div className="text-[28px] font-bold text-purple-700 leading-none">{totalPayHeads}</div>
              <div className="text-[11px] font-medium text-purple-600 mt-2 uppercase tracking-wide">Pay Heads</div>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="bg-white border border-gray-200 rounded-md mb-6 overflow-hidden">
          <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
            {[
              { id: "accounting", label: "Accounting Masters" },
              { id: "inventory", label: "Inventory Masters" },
              { id: "statutory", label: "Statutory Masters" },
              { id: "payroll", label: "Payroll Masters" },
            ].map(tab => (
              <button
                key={tab.id}
                className={`
                  px-5 py-3 text-[13px] font-semibold whitespace-nowrap transition-colors
                  ${activeTab === tab.id 
                    ? "bg-white text-[#1557b0] border-b-2 border-[#1557b0]" 
                    : "text-gray-600 hover:bg-gray-100 border-b-2 border-transparent"}
                `}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          <div className="p-4 bg-gray-50/50">
            {activeTab === "accounting" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {accountingCards.map(renderCard)}
              </div>
            )}
            
            {activeTab === "inventory" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {inventoryCards.map(renderCard)}
              </div>
            )}
            
            {activeTab === "statutory" && (
              <div>
                <div className="mb-4 bg-blue-50 text-blue-800 text-[12px] p-3 rounded-md border border-blue-100 flex items-center justify-between">
                  <div>
                    <span className="font-semibold">Note:</span> Nepal uses VAT (13%), not GST. Regulated by IRD (Inland Revenue Department).
                  </div>
                  <button
                    className="h-7 px-3 bg-white border border-blue-200 text-blue-700 text-[11px] font-medium rounded-md hover:bg-blue-100 flex items-center gap-1.5 transition-colors"
                    onClick={() => window.open("https://ird.gov.np", "_blank", "noopener,noreferrer")}
                  >
                    Open IRD Portal <ExternalLink size={12} />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {statutoryCards.map(renderCard)}
                </div>
              </div>
            )}
            
            {activeTab === "payroll" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {payrollCards.map(renderCard)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MasterControlCentre;
