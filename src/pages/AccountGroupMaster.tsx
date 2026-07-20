// @ts-nocheck
import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "@/lib/appToast";
import { FolderOpen, Package, Briefcase, Building, Users, Heart, X } from "lucide-react";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

const AccountGroupMaster: React.FC = () => {
  const { accounts, addAccount, updateAccount, deleteAccount } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const [showTemplateSelector, setShowTemplateSelector] = useState(accounts.length === 0);
  const [showForm, setShowForm] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterLevel, setFilterLevel] = useState("");

  // Form state
  const [form, setForm] = useState({
    code: "",
    name: "",
    nameNepali: "",
    type: "asset",
    level: "group",
    parentId: "",
    openingBalanceDr: 0,
    openingBalanceCr: 0,
    alias: "",
    isGroup: false,
    isActive: true,
    creditLimit: 0,
    interestRate: 0,
    narrationTemplate: "",
    tags: "",
  });

  const templates = [
    {
      id: "simple-trade",
      name: "Simple Trade",
      description:
        "Basic shop setup with essential accounts for retail businesses. Includes Cash, Bank, Debtors, Creditors, Sales, Purchases, and common expenses.",
      icon: <Package className="w-5 h-5 text-[var(--ds-action-primary)]" />,
      accounts: [
        {
          id: generateId(),
          code: "1000",
          name: "Cash",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "1100",
          name: "Bank",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "1200",
          name: "Sundry Debtors",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "2000",
          name: "Sundry Creditors",
          type: "liability",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "3000",
          name: "Sales",
          type: "income",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "4000",
          name: "Purchases",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "5000",
          name: "Operating Expenses",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "1010",
          name: "Petty Cash",
          type: "asset",
          level: "ledger",
          isGroup: false,
          parentId: "1000",
        },
        {
          id: generateId(),
          code: "1110",
          name: "HBL Current Account",
          type: "asset",
          level: "ledger",
          isGroup: false,
          parentId: "1100",
        },
        {
          id: generateId(),
          code: "3010",
          name: "Retail Sales",
          type: "income",
          level: "ledger",
          isGroup: false,
          parentId: "3000",
        },
        {
          id: generateId(),
          code: "4010",
          name: "Purchases",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "4000",
        },
        {
          id: generateId(),
          code: "5010",
          name: "Rent Expense",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "5000",
        },
        {
          id: generateId(),
          code: "5020",
          name: "Utilities",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "5000",
        },
        {
          id: generateId(),
          code: "5030",
          name: "Salaries",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "5000",
        },
      ],
    },
    {
      id: "manufacturing",
      name: "Manufacturing",
      description:
        "Complete manufacturing setup with raw materials, work-in-progress, finished goods, factory overhead, and production cost tracking.",
      icon: <Briefcase className="w-5 h-5 text-[var(--ds-action-primary)]" />,
      accounts: [
        {
          id: generateId(),
          code: "1000",
          name: "Fixed Assets",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "1100",
          name: "Investments",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "1200",
          name: "Current Assets",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "2000",
          name: "Current Liabilities",
          type: "liability",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "2100",
          name: "Long-term Liabilities",
          type: "liability",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "3000",
          name: "Capital Account",
          type: "equity",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "4000",
          name: "Revenue",
          type: "income",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "5000",
          name: "Cost of Sales",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "6000",
          name: "Operating Expenses",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "1210",
          name: "Raw Materials",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: "1200",
        },
        {
          id: generateId(),
          code: "1220",
          name: "Work in Process",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: "1200",
        },
        {
          id: generateId(),
          code: "1230",
          name: "Finished Goods",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: "1200",
        },
        {
          id: generateId(),
          code: "1240",
          name: "Sundry Debtors",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: "1200",
        },
        {
          id: generateId(),
          code: "1250",
          name: "Cash",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: "1200",
        },
        {
          id: generateId(),
          code: "1260",
          name: "Bank",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: "1200",
        },
        {
          id: generateId(),
          code: "5010",
          name: "Direct Labour",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: "5000",
        },
        {
          id: generateId(),
          code: "5020",
          name: "Factory Overhead",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: "5000",
        },
        {
          id: generateId(),
          code: "6010",
          name: "Administrative Expenses",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: "6000",
        },
        {
          id: generateId(),
          code: "6020",
          name: "Selling Expenses",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: "6000",
        },
      ],
    },
    {
      id: "nas-compliant",
      name: "NAS Compliant",
      description:
        "Full Nepal Accounting Standards compliant chart of accounts with all required groups and ledgers for compliance reporting.",
      icon: <Building className="w-5 h-5 text-[var(--ds-action-primary)]" />,
      accounts: [
        {
          id: generateId(),
          code: "1000",
          name: "Fixed Assets",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "1100",
          name: "Investments",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "1200",
          name: "Current Assets",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "1300",
          name: "Loans and Advances",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "2000",
          name: "Current Liabilities",
          type: "liability",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "2100",
          name: "Long-term Liabilities",
          type: "liability",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "3000",
          name: "Capital Account",
          type: "equity",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "3100",
          name: "Reserves and Surplus",
          type: "equity",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "4000",
          name: "Revenue",
          type: "income",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "5000",
          name: "Cost of Sales",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "6000",
          name: "Administrative Expenses",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "6100",
          name: "Selling Expenses",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "6200",
          name: "Finance Costs",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "1010",
          name: "Tangible Fixed Assets",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: "1000",
        },
        {
          id: generateId(),
          code: "1020",
          name: "Intangible Fixed Assets",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: "1000",
        },
        {
          id: generateId(),
          code: "1210",
          name: "Cash and Bank",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: "1200",
        },
        {
          id: generateId(),
          code: "1220",
          name: "Sundry Debtors",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: "1200",
        },
        {
          id: generateId(),
          code: "1230",
          name: "Inventory",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: "1200",
        },
        {
          id: generateId(),
          code: "1240",
          name: "Advances",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: "1200",
        },
        {
          id: generateId(),
          code: "2010",
          name: "Sundry Creditors",
          type: "liability",
          level: "group",
          isGroup: true,
          parentId: "2000",
        },
        {
          id: generateId(),
          code: "2020",
          name: "Expenses Payable",
          type: "liability",
          level: "group",
          isGroup: true,
          parentId: "2000",
        },
        {
          id: generateId(),
          code: "2030",
          name: "Taxes Payable",
          type: "liability",
          level: "group",
          isGroup: true,
          parentId: "2000",
        },
        {
          id: generateId(),
          code: "2110",
          name: "Long-term Loans",
          type: "liability",
          level: "group",
          isGroup: true,
          parentId: "2100",
        },
        {
          id: generateId(),
          code: "4010",
          name: "Sales Revenue",
          type: "income",
          level: "group",
          isGroup: true,
          parentId: "4000",
        },
        {
          id: generateId(),
          code: "4020",
          name: "Service Income",
          type: "income",
          level: "group",
          isGroup: true,
          parentId: "4000",
        },
        {
          id: generateId(),
          code: "5010",
          name: "Purchases",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: "5000",
        },
        {
          id: generateId(),
          code: "5020",
          name: "Direct Labour",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: "5000",
        },
        {
          id: generateId(),
          code: "6010",
          name: "Salaries and Wages",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: "6000",
        },
        {
          id: generateId(),
          code: "6020",
          name: "Rent",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: "6000",
        },
        {
          id: generateId(),
          code: "6030",
          name: "Utilities",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: "6000",
        },
        {
          id: generateId(),
          code: "6040",
          name: "Depreciation",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: "6000",
        },
        {
          id: generateId(),
          code: "6110",
          name: "Marketing Expenses",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: "6100",
        },
        {
          id: generateId(),
          code: "6210",
          name: "Bank Interest",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: "6200",
        },
        {
          id: generateId(),
          code: "1011",
          name: "Land",
          type: "asset",
          level: "ledger",
          isGroup: false,
          parentId: "1010",
        },
        {
          id: generateId(),
          code: "1012",
          name: "Building",
          type: "asset",
          level: "ledger",
          isGroup: false,
          parentId: "1010",
        },
        {
          id: generateId(),
          code: "1013",
          name: "Plant and Machinery",
          type: "asset",
          level: "ledger",
          isGroup: false,
          parentId: "1010",
        },
        {
          id: generateId(),
          code: "1014",
          name: "Furniture and Fixtures",
          type: "asset",
          level: "ledger",
          isGroup: false,
          parentId: "1010",
        },
        {
          id: generateId(),
          code: "1021",
          name: "Software",
          type: "asset",
          level: "ledger",
          isGroup: false,
          parentId: "1020",
        },
        {
          id: generateId(),
          code: "1211",
          name: "Cash",
          type: "asset",
          level: "ledger",
          isGroup: false,
          parentId: "1210",
        },
        {
          id: generateId(),
          code: "1212",
          name: "Bank",
          type: "asset",
          level: "ledger",
          isGroup: false,
          parentId: "1210",
        },
        {
          id: generateId(),
          code: "1221",
          name: "Trade Debtors",
          type: "asset",
          level: "ledger",
          isGroup: false,
          parentId: "1220",
        },
        {
          id: generateId(),
          code: "1231",
          name: "Raw Materials",
          type: "asset",
          level: "ledger",
          isGroup: false,
          parentId: "1230",
        },
        {
          id: generateId(),
          code: "1232",
          name: "Work in Progress",
          type: "asset",
          level: "ledger",
          isGroup: false,
          parentId: "1230",
        },
        {
          id: generateId(),
          code: "1233",
          name: "Finished Goods",
          type: "asset",
          level: "ledger",
          isGroup: false,
          parentId: "1230",
        },
        {
          id: generateId(),
          code: "2011",
          name: "Trade Creditors",
          type: "liability",
          level: "ledger",
          isGroup: false,
          parentId: "2010",
        },
        {
          id: generateId(),
          code: "2031",
          name: "VAT Payable",
          type: "liability",
          level: "ledger",
          isGroup: false,
          parentId: "2030",
        },
        {
          id: generateId(),
          code: "2032",
          name: "TDS Payable",
          type: "liability",
          level: "ledger",
          isGroup: false,
          parentId: "2030",
        },
        {
          id: generateId(),
          code: "4011",
          name: "Domestic Sales",
          type: "income",
          level: "ledger",
          isGroup: false,
          parentId: "4010",
        },
        {
          id: generateId(),
          code: "4012",
          name: "Export Sales",
          type: "income",
          level: "ledger",
          isGroup: false,
          parentId: "4010",
        },
        {
          id: generateId(),
          code: "5011",
          name: "Raw Material Purchases",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "5010",
        },
        {
          id: generateId(),
          code: "6011",
          name: "Manager Salary",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "6010",
        },
        {
          id: generateId(),
          code: "6012",
          name: "Staff Salaries",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "6010",
        },
        {
          id: generateId(),
          code: "6021",
          name: "Office Rent",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "6020",
        },
        {
          id: generateId(),
          code: "6031",
          name: "Electricity",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "6030",
        },
        {
          id: generateId(),
          code: "6032",
          name: "Water",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "6030",
        },
        {
          id: generateId(),
          code: "6041",
          name: "Building Depreciation",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "6040",
        },
        {
          id: generateId(),
          code: "6042",
          name: "Machine Depreciation",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "6040",
        },
        {
          id: generateId(),
          code: "6111",
          name: "Advertisement",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "6110",
        },
        {
          id: generateId(),
          code: "6211",
          name: "Bank Interest Expense",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "6210",
        },
      ],
    },
    {
      id: "service-business",
      name: "Service Business",
      description:
        "Designed for service-based companies with revenue streams, project costs, professional expenses, and client management accounts.",
      icon: <Users className="w-5 h-5 text-[var(--ds-action-primary)]" />,
      accounts: [
        {
          id: generateId(),
          code: "1000",
          name: "Fixed Assets",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "1100",
          name: "Current Assets",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "2000",
          name: "Current Liabilities",
          type: "liability",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "3000",
          name: "Capital Account",
          type: "equity",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "4000",
          name: "Revenue",
          type: "income",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "5000",
          name: "Operating Expenses",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "1110",
          name: "Cash",
          type: "asset",
          level: "ledger",
          isGroup: false,
          parentId: "1100",
        },
        {
          id: generateId(),
          code: "1120",
          name: "Bank",
          type: "asset",
          level: "ledger",
          isGroup: false,
          parentId: "1100",
        },
        {
          id: generateId(),
          code: "1130",
          name: "Sundry Debtors",
          type: "asset",
          level: "ledger",
          isGroup: false,
          parentId: "1100",
        },
        {
          id: generateId(),
          code: "2010",
          name: "Sundry Creditors",
          type: "liability",
          level: "ledger",
          isGroup: false,
          parentId: "2000",
        },
        {
          id: generateId(),
          code: "4010",
          name: "Service Revenue",
          type: "income",
          level: "ledger",
          isGroup: false,
          parentId: "4000",
        },
        {
          id: generateId(),
          code: "4020",
          name: "Consultancy Fees",
          type: "income",
          level: "ledger",
          isGroup: false,
          parentId: "4000",
        },
        {
          id: generateId(),
          code: "5010",
          name: "Professional Fees",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "5000",
        },
        {
          id: generateId(),
          code: "5020",
          name: "Travel Expenses",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "5000",
        },
        {
          id: generateId(),
          code: "5030",
          name: "Communication",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "5000",
        },
        {
          id: generateId(),
          code: "5040",
          name: "Office Supplies",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "5000",
        },
      ],
    },
    {
      id: "hotel-hospitality",
      name: "Hotel/Hospitality",
      description:
        "Complete hotel management with room revenue, food & beverage, laundry services, and departmental cost tracking.",
      icon: <Building className="w-5 h-5 text-[var(--ds-action-primary)]" />,
      accounts: [
        {
          id: generateId(),
          code: "1000",
          name: "Fixed Assets",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "1100",
          name: "Current Assets",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "2000",
          name: "Current Liabilities",
          type: "liability",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "3000",
          name: "Capital Account",
          type: "equity",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "4000",
          name: "Revenue",
          type: "income",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "5000",
          name: "Cost of Sales",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "6000",
          name: "Operating Expenses",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "1110",
          name: "Cash",
          type: "asset",
          level: "ledger",
          isGroup: false,
          parentId: "1100",
        },
        {
          id: generateId(),
          code: "1120",
          name: "Bank",
          type: "asset",
          level: "ledger",
          isGroup: false,
          parentId: "1100",
        },
        {
          id: generateId(),
          code: "1130",
          name: "Sundry Debtors",
          type: "asset",
          level: "ledger",
          isGroup: false,
          parentId: "1100",
        },
        {
          id: generateId(),
          code: "4010",
          name: "Room Revenue",
          type: "income",
          level: "group",
          isGroup: true,
          parentId: "4000",
        },
        {
          id: generateId(),
          code: "4020",
          name: "Food and Beverage Revenue",
          type: "income",
          level: "group",
          isGroup: true,
          parentId: "4000",
        },
        {
          id: generateId(),
          code: "4030",
          name: "Laundry Revenue",
          type: "income",
          level: "group",
          isGroup: true,
          parentId: "4000",
        },
        {
          id: generateId(),
          code: "5010",
          name: "Food Cost",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "5000",
        },
        {
          id: generateId(),
          code: "5020",
          name: "Beverage Cost",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "5000",
        },
        {
          id: generateId(),
          code: "6010",
          name: "Staff Salaries",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "6000",
        },
        {
          id: generateId(),
          code: "6020",
          name: "Maintenance",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "6000",
        },
      ],
    },
    {
      id: "ngo-non-profit",
      name: "NGO/Non-Profit",
      description:
        "Fund accounting structure for NGOs with programme funds, administrative funds, donor funds, and grant tracking.",
      icon: <Heart className="w-5 h-5 text-[var(--ds-action-primary)]" />,
      accounts: [
        {
          id: generateId(),
          code: "1000",
          name: "Fixed Assets",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "1100",
          name: "Current Assets",
          type: "asset",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "2000",
          name: "Current Liabilities",
          type: "liability",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "3000",
          name: "Funds",
          type: "equity",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "4000",
          name: "Grants and Contributions",
          type: "income",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "5000",
          name: "Programme Expenses",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "6000",
          name: "Administrative Expenses",
          type: "expense",
          level: "group",
          isGroup: true,
          parentId: null,
        },
        {
          id: generateId(),
          code: "1110",
          name: "Cash",
          type: "asset",
          level: "ledger",
          isGroup: false,
          parentId: "1100",
        },
        {
          id: generateId(),
          code: "1120",
          name: "Bank",
          type: "asset",
          level: "ledger",
          isGroup: false,
          parentId: "1100",
        },
        {
          id: generateId(),
          code: "3010",
          name: "Programme Fund",
          type: "equity",
          level: "ledger",
          isGroup: false,
          parentId: "3000",
        },
        {
          id: generateId(),
          code: "3020",
          name: "Administrative Fund",
          type: "equity",
          level: "ledger",
          isGroup: false,
          parentId: "3000",
        },
        {
          id: generateId(),
          code: "3030",
          name: "Donor Restricted Fund",
          type: "equity",
          level: "ledger",
          isGroup: false,
          parentId: "3000",
        },
        {
          id: generateId(),
          code: "4010",
          name: "Government Grants",
          type: "income",
          level: "ledger",
          isGroup: false,
          parentId: "4000",
        },
        {
          id: generateId(),
          code: "4020",
          name: "Private Donations",
          type: "income",
          level: "ledger",
          isGroup: false,
          parentId: "4000",
        },
        {
          id: generateId(),
          code: "5010",
          name: "Community Outreach",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "5000",
        },
        {
          id: generateId(),
          code: "5020",
          name: "Training Programmes",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "5000",
        },
        {
          id: generateId(),
          code: "6010",
          name: "Office Rent",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "6000",
        },
        {
          id: generateId(),
          code: "6020",
          name: "Staff Salaries",
          type: "expense",
          level: "ledger",
          isGroup: false,
          parentId: "6000",
        },
      ],
    },
  ];

  const loadCOATemplate = async (templateName: string) => {
    const template = templates.find((t) => t.name === templateName);
    if (!template) return;

    try {
      const db = getDB();
      const branchId = readActiveBranchId() || undefined;
      await db.accounts.bulkAdd(
        template.accounts.map((acc) => ({ ...acc, branchId })) as any[],
      );
      toast.success(
        `Template "${templateName}" loaded! ${template.accounts.length} accounts created.`,
      );
      setShowTemplateSelector(false);
    } catch (error) {
      console.error("Error loading template:", error);
      toast.error("Failed to load template. Please try again.");
    }
  };

  const filteredAccounts = accounts.filter((acc) => {
    const matchesSearch =
      acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !filterType || acc.type === filterType;
    const matchesLevel = !filterLevel || acc.level === filterLevel;
    return matchBranch((acc as any).branchId) && matchesSearch && matchesType && matchesLevel;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      ...form,
      branchId: selectedAccount?.branchId || readActiveBranchId() || undefined,
    };
    if (selectedAccount) {
      await updateAccount(selectedAccount.id, payload);
      toast.success("Account updated successfully");
    } else {
      await addAccount(payload);
      toast.success("Account created successfully");
    }

    setShowForm(false);
    resetForm();
  };

  const resetForm = () => {
    setForm({
      code: "",
      name: "",
      nameNepali: "",
      type: "asset",
      level: "group",
      parentId: "",
      openingBalanceDr: 0,
      openingBalanceCr: 0,
      alias: "",
      isGroup: false,
      isActive: true,
      creditLimit: 0,
      interestRate: 0,
      narrationTemplate: "",
      tags: "",
    });
    setSelectedAccount(null);
  };

  const handleEdit = (account: any) => {
    setSelectedAccount(account);
    setForm({
      code: account.code,
      name: account.name,
      nameNepali: account.nameNepali || "",
      type: account.type,
      level: account.level,
      parentId: account.parentId || "",
      openingBalanceDr: account.openingBalanceDr || 0,
      openingBalanceCr: account.openingBalanceCr || 0,
      alias: account.alias || "",
      isGroup: account.isGroup,
      isActive: account.isActive,
      creditLimit: account.creditLimit || 0,
      interestRate: account.interestRate || 0,
      narrationTemplate: account.narrationTemplate || "",
      tags: account.tags || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this account?")) {
      await deleteAccount(id);
      toast.success("Account deleted successfully");
    }
  };

  const exportToExcel = () => {
    const headers = [
      "Code",
      "Name",
      "Nepali Name",
      "Type",
      "Level",
      "Parent",
      "Is Group",
      "Is Active",
    ];
    const rows = filteredAccounts.map((acc) => [
      acc.code,
      acc.name,
      acc.nameNepali || "",
      acc.type,
      acc.level,
      acc.parentId || "",
      acc.isGroup ? "Yes" : "No",
      acc.isActive ? "Yes" : "No",
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Chart of Accounts");
    XLSX.writeFile(wb, "Chart_of_Accounts.xlsx");
    toast.success("Accounts exported to Excel");
  };

  if (showTemplateSelector) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-900">
                Select Chart of Accounts Template
              </h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Choose a starting template or build from scratch
              </p>
            </div>
            {accounts.length > 0 && (
              <button
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-lg hover:bg-gray-50"
                onClick={() => setShowTemplateSelector(false)}
              >
                Cancel
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-white border border-gray-200 rounded-lg p-5 hover:border-[var(--ds-action-primary)] hover:shadow-sm cursor-pointer flex flex-col transition-all group"
                onClick={() => loadCOATemplate(template.name)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-50 rounded-md">{template.icon}</div>
                  <h3 className="text-[14px] font-semibold text-gray-700">{template.name}</h3>
                </div>
                <p className="text-[11px] text-gray-500 mb-4 flex-grow leading-relaxed">
                  {template.description}
                </p>
                <button className="h-8 w-full bg-gray-50 text-[var(--ds-action-primary)] text-[12px] font-medium rounded-lg group-hover:bg-[var(--ds-action-primary)] group-hover:text-white transition-colors border border-gray-200 group-hover:border-[var(--ds-action-primary)]">
                  Load Template
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-900">Chart of Accounts</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Manage groups and ledgers</p>
          </div>
          <div className="flex items-center gap-2">
            {branchOptions.length > 0 && (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                aria-label="Branch"
              >
                <option value="all">All branches</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.code || b.id}
                  </option>
                ))}
              </select>
            )}
            <button
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-lg hover:bg-gray-50"
              onClick={() => setShowTemplateSelector(true)}
            >
              Load Template
            </button>
            <button
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-lg hover:bg-gray-50"
              onClick={exportToExcel}
            >
              Export
            </button>
            <button
              className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md"
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              Add Account
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                placeholder="Search accounts..."
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
              >
                <option value="">All Types</option>
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Level</label>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
              >
                <option value="">All Levels</option>
                <option value="group">Group</option>
                <option value="subgroup">Subgroup</option>
                <option value="ledger">Ledger</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-full">
          <table className="w-full min-w-max border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Code
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Name
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Nepali Name
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Type
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Level
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Parent
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((acc) => {
                const parentAcc = accounts.find((a) => a.id === acc.parentId);
                return (
                  <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono">{acc.code}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">
                      {acc.name}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700">
                      {acc.nameNepali || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 capitalize">{acc.type}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 capitalize">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          acc.level === "group"
                            ? "bg-blue-50 text-blue-700"
                            : acc.level === "subgroup"
                              ? "bg-[var(--ds-status-info-surface)] text-[var(--ds-status-info)]"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {acc.level}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-500">
                      {parentAcc ? parentAcc.name : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-right text-gray-700">
                      <button
                        className="text-[var(--ds-action-primary)] hover:text-[var(--ds-action-primary-hover)] mr-3 font-medium"
                        onClick={() => handleEdit(acc)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-red-600 hover:text-red-800 font-medium"
                        onClick={() => handleDelete(acc.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredAccounts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-[12px] text-gray-500">
                    No accounts found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Account Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-[15px] font-semibold text-gray-700">
                {selectedAccount ? "Edit Account" : "Add New Account"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto">
              <form id="accountForm" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Account Code *
                    </label>
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Account Name *
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Account Name (Nepali)
                    </label>
                    <input
                      type="text"
                      value={form.nameNepali}
                      onChange={(e) => setForm({ ...form, nameNepali: e.target.value })}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Account Type *
                    </label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                      required
                    >
                      <option value="asset">Asset</option>
                      <option value="liability">Liability</option>
                      <option value="equity">Equity</option>
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Account Level *
                    </label>
                    <select
                      value={form.level}
                      onChange={(e) => setForm({ ...form, level: e.target.value })}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                      required
                    >
                      <option value="group">Group</option>
                      <option value="subgroup">Subgroup</option>
                      <option value="ledger">Ledger</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Parent Account
                    </label>
                    <select
                      value={form.parentId}
                      onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                    >
                      <option value="">None</option>
                      {accounts
                        .filter((a) => a.isGroup)
                        .map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Opening Dr Balance
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.openingBalanceDr}
                      onChange={(e) =>
                        setForm({ ...form, openingBalanceDr: parseFloat(e.target.value) || 0 })
                      }
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Opening Cr Balance
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.openingBalanceCr}
                      onChange={(e) =>
                        setForm({ ...form, openingBalanceCr: parseFloat(e.target.value) || 0 })
                      }
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Alias / Short Name
                    </label>
                    <input
                      type="text"
                      value={form.alias}
                      onChange={(e) => setForm({ ...form, alias: e.target.value })}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Credit Limit (NPR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.creditLimit}
                      onChange={(e) =>
                        setForm({ ...form, creditLimit: parseFloat(e.target.value) || 0 })
                      }
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Interest Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.interestRate}
                      onChange={(e) =>
                        setForm({ ...form, interestRate: parseFloat(e.target.value) || 0 })
                      }
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Narration Template
                    </label>
                    <input
                      type="text"
                      value={form.narrationTemplate}
                      onChange={(e) => setForm({ ...form, narrationTemplate: e.target.value })}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={form.tags}
                      onChange={(e) => setForm({ ...form, tags: e.target.value })}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6 mt-5 pt-4 border-t border-gray-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isGroup}
                      onChange={(e) => setForm({ ...form, isGroup: e.target.checked })}
                      className="form-checkbox h-4 w-4 text-[var(--ds-action-primary)] rounded border-gray-300 focus:ring-[var(--ds-action-primary)]"
                    />
                    <span className="text-[12px] text-gray-700 font-medium">Is Group Account</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="form-checkbox h-4 w-4 text-[var(--ds-action-primary)] rounded border-gray-300 focus:ring-[var(--ds-action-primary)]"
                    />
                    <span className="text-[12px] text-gray-700 font-medium">Account is Active</span>
                  </label>
                </div>
              </form>
            </div>

            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-lg">
              <button
                type="button"
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-lg hover:bg-gray-50"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="accountForm"
                className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md"
              >
                {selectedAccount ? "Update Account" : "Save Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountGroupMaster;
