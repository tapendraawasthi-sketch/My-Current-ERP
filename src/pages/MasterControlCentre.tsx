// @ts-nocheck
import React, { useState } from "react";
import { useStore } from "../store";
import {
  FolderOpen, Layers, BookOpen, ScrollText, Map, TrendingUp, TrendingDown,
  Activity, Banknote, Package, Tags, ArrowLeftRight, Archive, RefreshCw,
  FileText, FileBarChart, Users, ClipboardList, Calendar
} from "lucide-react";

const MasterControlCentre: React.FC = () => {
  const {
    setCurrentPage,
    accounts, items, employees, payHeads, stockCategories, vatClassifications,
    tdsNatureOfPayment, employeeGroups, payrollUnits, attendanceTypes, costCategories,
    costCentreClasses, priceLevels, priceLists, hsCodes, batches, voucherTypeMasters,
    scenarios, reorderLevels,
    units, warehouses, itemGroups, saleTypes, purchaseTypes, taxCategories,
    billSundryMasters, unitConversions, currencies, budgets, salaryDetails
  } = useStore();

  const [activeTab, setActiveTab] = useState("accounting");

  const totalLedgers = (accounts || []).filter(a => !a.isGroup).length;

  const accountingCards = [
    { label: "Chart of Accounts",    page: "accounts",           count: (accounts || []).length,              icon: FolderOpen  },
    { label: "Account Groups",       page: "account-groups",     count: (accounts || []).filter(a => a.isGroup).length, icon: Layers },
    { label: "Ledger Master",        page: "ledgers",            count: totalLedgers,                         icon: BookOpen    },
    { label: "Voucher Types",        page: "voucher-types",      count: (voucherTypeMasters || []).length,    icon: ScrollText  },
    { label: "Cost Categories",      page: "cost-categories",    count: (costCategories || []).length,        icon: Map         },
    { label: "Cost Centre Classes",  page: "cost-centre-classes",count: (costCentreClasses || []).length,     icon: Layers      },
    { label: "Budget Master",        page: "budget",             count: (budgets || []).length,               icon: TrendingUp  },
    { label: "Scenario Master",      page: "scenarios",          count: (scenarios || []).length,             icon: Activity    },
    { label: "Currency Master",      page: "currency-master",    count: (currencies || []).length,            icon: Banknote    },
  ];

  const inventoryCards = [
    { label: "Stock Items",           page: "items",            count: (items || []).length,          icon: Package        },
    { label: "Item Groups",           page: "item-groups",      count: (itemGroups || []).length,     icon: Layers         },
    { label: "Stock Categories",      page: "stock-categories", count: (stockCategories || []).length,icon: FolderOpen     },
    { label: "Units of Measure",      page: "units",            count: (units || []).length,          icon: Tags           },
    { label: "Unit Conversions",      page: "unit-conversions", count: (unitConversions || []).length,icon: ArrowLeftRight  },
    { label: "Warehouses / Godowns",  page: "warehouses",       count: (warehouses || []).length,     icon: Archive        },
    { label: "Reorder Levels",        page: "reorder-levels",   count: (reorderLevels || []).length,  icon: RefreshCw      },
    { label: "Price Levels",          page: "price-levels",     count: (priceLevels || []).length,    icon: Tags           },
    { label: "Price Lists",           page: "price-lists",      count: (priceLists || []).length,     icon: FileText       },
    { label: "HS Codes (Nepal)",      page: "hs-codes",         count: (hsCodes || []).length,        icon: FileBarChart   },
    { label: "Batch Master",          page: "batches",          count: (batches || []).length,        icon: Archive        },
  ];

  const statutoryCards = [
    { label: "VAT Classifications",    page: "vat-classifications",    count: (vatClassifications || []).length,  icon: FileBarChart },
    { label: "TDS Nature of Payment",  page: "tds-nature-of-payments", count: (tdsNatureOfPayment || []).length,  icon: FileText     },
    { label: "Sale Types (VAT)",       page: "sale-types",             count: (saleTypes || []).length,           icon: TrendingUp   },
    { label: "Purchase Types",         page: "purchase-types",         count: (purchaseTypes || []).length,       icon: TrendingDown },
    { label: "Tax Categories",         page: "tax-categories",         count: (taxCategories || []).length,       icon: FileBarChart },
    { label: "Bill Sundries",          page: "bill-sundries",          count: (billSundryMasters || []).length,   icon: FileText     },
  ];

  const payrollCards = [
    { label: "Employees",       page: "employees",       count: (employees || []).length,    icon: Users       },
    { label: "Employee Groups", page: "employee-groups", count: (employeeGroups || []).length,icon: Users      },
    { label: "Pay Heads",       page: "pay-heads",       count: (payHeads || []).length,     icon: Banknote    },
    { label: "Salary Details",  page: "salary-details",  count: (salaryDetails || []).length,icon: ClipboardList},
    { label: "Payroll Units",   page: "payroll-units",   count: (payrollUnits || []).length, icon: Tags        },
    { label: "Attendance Types",page: "attendance-types",count: (attendanceTypes || []).length,icon: Calendar  },
    { label: "Payroll Run",     page: "payroll-run",     count: null,                        icon: ClipboardList},
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
          <div className="text-[13px] font-semibold text-[#000000]">{card.label}</div>
          <div className="text-[11px] text-[#000000] mt-1">
            {card.count === null ? "View →" : `Count: ${card.count}`}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col bg-[#f5f6fa] overflow-hidden">
      <div className="p-4 bg-white border-b border-gray-200">
        <h2 className="text-[18px] font-bold text-[#000000]">Master Control Centre</h2>
        <p className="text-[12px] text-[#000000] mt-1">Centralized dashboard for all masters in the ERP</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {/* Stats Summary Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border-l-4 border-blue-500 rounded-md p-4 shadow-sm">
            <div className="text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Total Ledgers</div>
            <div className="text-2xl font-bold mt-1 text-[#000000]">{totalLedgers}</div>
          </div>
          <div className="bg-white border-l-4 border-green-500 rounded-md p-4 shadow-sm">
            <div className="text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Stock Items</div>
            <div className="text-2xl font-bold mt-1 text-[#000000]">{(items || []).length}</div>
          </div>
          <div className="bg-white border-l-4 border-amber-500 rounded-md p-4 shadow-sm">
            <div className="text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Total Employees</div>
            <div className="text-2xl font-bold mt-1 text-[#000000]">{(employees || []).length}</div>
          </div>
          <div className="bg-white border-l-4 border-purple-500 rounded-md p-4 shadow-sm">
            <div className="text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Pay Heads</div>
            <div className="text-2xl font-bold mt-1 text-[#000000]">{(payHeads || []).length}</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6">
          {[
            { key: "accounting", label: "Accounting Masters" },
            { key: "inventory",  label: "Inventory Masters"  },
            { key: "statutory",  label: "Statutory Masters"  },
            { key: "payroll",    label: "Payroll Masters"    },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-[13px] font-medium border-b-2 ${
                activeTab === tab.key
                  ? "bg-white text-[#1557b0] border-[#1557b0]"
                  : "text-[#000000] hover:bg-gray-100 border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "accounting" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {accountingCards.map(renderCard)}
          </div>
        )}

        {activeTab === "inventory" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {inventoryCards.map(renderCard)}
          </div>
        )}

        {activeTab === "statutory" && (
          <div>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
              <div className="flex items-start gap-2">
                <div className="text-blue-700 mt-0.5">
                  <FileText size={16} />
                </div>
                <div>
                  <h3 className="font-semibold text-[#000000] text-[13px]">Statutory Compliance Information</h3>
                  <p className="text-[12px] text-[#000000] mt-1">
                    Manage all statutory masters required for compliance with Nepal's tax laws.
                    For assistance with IRD (Inland Revenue Department) requirements, visit{' '}
                    <a href="https://ird.gov.np" target="_blank" rel="noopener noreferrer" className="text-[#1557b0] underline">
                      www.ird.gov.np
                    </a>
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {statutoryCards.map(renderCard)}
            </div>
          </div>
        )}

        {activeTab === "payroll" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {payrollCards.map(renderCard)}
          </div>
        )}
      </div>
    </div>
  );
};

export default MasterControlCentre;
