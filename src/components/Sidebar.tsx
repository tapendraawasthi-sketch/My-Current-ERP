// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { 
  LayoutDashboard, 
  FolderOpen, 
  Users, 
  Package, 
  Tags, 
  BookOpen, 
  Wallet,
  Download, 
  ArrowLeftRight, 
  ScrollText, 
  FileText, 
  CreditCard, 
  ShoppingCart,
  ClipboardList, 
  Truck, 
  Archive, 
  RefreshCw, 
  Store, 
  Scale, 
  TrendingUp,
  TrendingDown, 
  BarChart2, 
  Activity, 
  FileBarChart, 
  BookMarked, 
  Calendar,
  Banknote, 
  Landmark, 
  Layers, 
  PieChart, 
  Map, 
  Settings, 
  Shield, 
  Database,
  FileClock, 
  ChevronDown, 
  ChevronRight, 
  LogOut, 
  Sliders, 
  ChevronLeft,
  Lock,
  Monitor,
  Printer,
  Building,
  CheckCircle,
  AlertTriangle,
  Tag,
  Building2,
  History
} from "lucide-react";

interface NavItem {
  label: string;
  nepaliLabel?: string;
  page: string;
  icon: React.ComponentType<{ className?: string, size?: number }>;
}

interface MenuGroup {
  title: string;
  items: NavItem[];
}

const menuGroups: MenuGroup[] = [
  {
    title: "Gateway",
    items: [
      { label: "Dashboard", page: "dashboard", icon: LayoutDashboard },
      { label: "Reports Hub", page: "reports-hub", icon: BarChart2 },
      { label: "Configuration Hub", page: "configuration-hub", icon: Sliders },
      { label: "Data Import/Export", page: "data-import-export", icon: Download },
    ],
  },
  {
    title: "Overview",
    items: [
      { label: "Dashboard", page: "dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Masters",
    items: [
      { label: "Chart of Accounts", page: "chart-of-accounts", icon: BookOpen },
      { label: "Party Master", page: "party-master", icon: Users },
      { label: "Item Master", page: "item-master", icon: Package },
      { label: "Unit Conversion", page: "unit-conversion", icon: Scale },
      { label: "Bill Sundries", page: "bill-sundry", icon: Tags },
    ],
  },
  {
    title: "Transactions",
    items: [
      { label: "Voucher Entry", page: "voucher-entry", icon: FileText },
      { label: "Sales Register", page: "sales-register", icon: TrendingUp },
      { label: "Purchase Register", page: "purchase-register", icon: TrendingDown },
      { label: "Journal Register", page: "journal-register", icon: ScrollText },
      { label: "Day Book", page: "day-book", icon: BookMarked },
      { label: "Voucher Approval", page: "maker-checker", icon: CheckCircle },
      { label: "Missing Vouchers", page: "missing-vouchers", icon: AlertTriangle },
      { label: "Quotations", page: "quotations", icon: FileText },
    ],
  },
  {
    title: "Books",
    items: [
      { label: "General Ledger", page: "ledger", icon: BookOpen },
      { label: "Trial Balance", page: "trial-balance", icon: FileBarChart },
      { label: "Profit & Loss", page: "profit-loss", icon: TrendingUp },
      { label: "Balance Sheet", page: "balance-sheet", icon: PieChart },
      { label: "Cash Flow Statement", page: "cash-flow", icon: Activity },
      { label: "Funds Flow Statement", page: "funds-flow", icon: ArrowLeftRight },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Stock Book", page: "stock-book", icon: Archive },
      { label: "Stock Summary", page: "stock-summary", icon: Package },
      { label: "Stock Categories", page: "stock-categories", icon: FolderOpen },
      { label: "Batch Management", page: "batch-management", icon: Package },
      { label: "Serial Tracking", page: "serial-tracking", icon: Tag },
    ],
  },
  {
    title: "Reports",
    items: [
      { label: "Sales Order Outstanding", page: "sales-order-outstanding", icon: ClipboardList },
      { label: "Purchase Order Outstanding", page: "purchase-order-outstanding", icon: ClipboardList },
      { label: "Debtors Aging", page: "debtors-aging", icon: Calendar },
      { label: "Creditors Aging", page: "creditors-aging", icon: Calendar },
      { label: "Bank Reconciliation", page: "bank-reconciliation", icon: Banknote },
      { label: "GST Reports", page: "gst-reports", icon: FileText },
      { label: "TDS Reports", page: "tds-reports", icon: FileText },
      { label: "VAT Reports", page: "vat-reports", icon: FileText },
      { label: "CBMS Dashboard", page: "cbms-dashboard", icon: FileText },
      { label: "Sales & Purchase Analysis", page: "sales-purchase-analysis", icon: BarChart2 },
      { label: "Price History & Rates", page: "price-history", icon: History },
      { label: "Payroll Reports", page: "payroll-reports", icon: FileText },
      { label: "Budget Reports", page: "budgets", icon: Banknote },
      { label: "Ratio Analysis", page: "ratio-analysis", icon: PieChart },
      { label: "Statistics Report", page: "statistics-report", icon: BarChart2 },
      { label: "Exception Reports", page: "exception-reports", icon: FileBarChart },
      { label: "Party Reconciliation", page: "party-reconciliation", icon: Users },
      { label: "Credit Limits", page: "credit-limits", icon: CreditCard },
    ],
  },
  {
    title: "Payroll",
    items: [
      { label: "Payroll", page: "payroll", icon: Wallet },
    ],
  },
  {
    title: "Security",
    items: [
      { label: 'TallyVault / Encryption', page: 'tally-vault', icon: Lock },
      { label: 'Security Control', page: 'security-control', icon: Shield },
      { label: 'Roles Management', page: 'roles-management', icon: Users },
      { label: 'Control Centre', page: 'control-centre', icon: Monitor },
      { label: 'Audit Trail', page: 'audit-trail', icon: Shield },
      { label: 'Period Lock', page: 'period-lock', icon: Lock },
    ],
  },
  {
    title: "Configuration",
    items: [
      { label: 'Print Configuration', page: 'print-configuration', icon: Printer },
      { label: 'F11 Features', page: 'f11-features', icon: Settings },
      { label: 'Backup & Restore', page: 'backup-restore', icon: Database },
      { label: 'Users Management', page: 'users', icon: Users },
      { label: 'Audit Logs', page: 'audit-logs', icon: FileClock },
    ],
  },
  {
    title: "Tools",
    items: [
      { label: 'Bulk Updations', page: 'bulk-updations', icon: RefreshCw },
      { label: 'Troubleshooting', page: 'troubleshooting', icon: Settings },
    ],
  },
  {
    title: "Company",
    items: [
      { label: 'Company Information', page: 'company-info', icon: Building },
      { label: 'Fiscal Year', page: 'fiscal-year', icon: Calendar },
      { label: 'Company Settings', page: 'company-settings', icon: Settings },
    ],
  },
  {
    title: "Assets",
    items: [
      { label: "Fixed Assets", page: "fixed-assets", icon: Building2 },
    ],
  },
  {
    title: "POS",
    items: [
      { label: "POS Billing", page: "pos", icon: ShoppingCart },
    ],
  },
];

const Sidebar: React.FC<{ collapsed: boolean; setCollapsed: (b: boolean) => void }> = ({ collapsed, setCollapsed }) => {
  const { currentPage, setCurrentPage, currentUser, logout, currentFiscalYear, companySettings, users, items, stockMovements } = useStore();
  
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Gateway: true,
    Overview: true,
    Masters: false,
    Transactions: true,
    Payroll: false,
    Inventory: false,
    Books: false,
    Reports: false,
    Admin: false,
    "Inventory Masters": false,
    "Accounting Masters": false,
    "Statutory Masters (Nepal)": false,
    "Payroll Masters": false,
    "Security": true,
    "Configuration": false,
    "Tools": false,
    "Company": false,
  });

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const groupedNavItems = useMemo(() => {
    const itemsWithCounts: Record<string, { item: NavItem; count?: number }[]> = {};
    
    menuGroups.forEach(group => {
      itemsWithCounts[group.title] = group.items.map(item => {
        let count: number | undefined;
        
        // Logic for counts
        if (item.page === 'users') {
          count = users?.length || 0;
        } else if (item.page === 'items') {
          count = items?.length || 0;
        } else if (item.page === 'stock-movements') {
          count = stockMovements?.length || 0;
        }
        
        return { item, count };
      });
    });
    
    return itemsWithCounts;
  }, [users, items, stockMovements]);

  const isActive = (page: string) => currentPage === page;

  return (
    <div className={`bg-[#1e2433] text-white transition-all duration-300 ${collapsed ? 'w-[60px]' : 'w-[240px]'} flex flex-col border-r border-[#2d3748] h-full`}>
      {/* Sidebar Header & Collapse Toggle */}
      <div className="p-3 border-b border-[#2d3748] flex justify-end">
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-7 h-7 rounded bg-transparent hover:bg-[#273148] text-gray-300 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      
      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto py-3 custom-scrollbar">
        {menuGroups.map((group) => {
          const isExpanded = expandedGroups[group.title];
          const items = groupedNavItems[group.title] || [];
          
          if (items.length === 0) return null;
          
          return (
            <div key={group.title} className="mb-1.5">
              <button
                onClick={() => toggleGroup(group.title)}
                className={`w-full flex items-center justify-between px-3 py-1.5 transition-colors ${
                  collapsed ? 'justify-center' : ''
                } hover:bg-[#273148] group`}
                title={collapsed ? group.title : undefined}
              >
                {!collapsed && (
                  <>
                    <span className="text-[10px] font-semibold uppercase text-[#475c8a] tracking-wider group-hover:text-[#5f7ab3] transition-colors">
                      {group.title}
                    </span>
                    {isExpanded ? (
                      <ChevronDown size={14} className="text-gray-500 group-hover:text-gray-300" />
                    ) : (
                      <ChevronRight size={14} className="text-gray-500 group-hover:text-gray-300" />
                    )}
                  </>
                )}
                {collapsed && (
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    {group.title.substring(0, 3)}
                  </span>
                )}
              </button>
              
              {isExpanded && !collapsed && (
                <div className="mt-0.5 mb-1 px-2 space-y-0.5">
                  {items.map(({ item, count }, index) => {
                    const active = isActive(item.page);
                    return (
                      <button
                        key={index}
                        onClick={() => setCurrentPage(item.page)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-[12px] rounded-md transition-colors group ${
                          active 
                            ? 'bg-[#1557b0] text-white' 
                            : 'text-[#cbd5e1] hover:bg-[#273148] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <item.icon size={14} className={active ? 'text-white' : 'text-[#cbd5e1] group-hover:text-white'} />
                          <span>{item.label}</span>
                        </div>
                        {count !== undefined && count > 0 && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm ${
                            active ? 'bg-white/20 text-white' : 'bg-[#2d3748] text-gray-300'
                          }`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      
      {/* Footer Profile & Logout */}
      <div className="p-3 border-t border-[#2d3748] bg-[#1a1f2c]">
        <button
          onClick={logout}
          className={`w-full flex items-center gap-2 px-2.5 py-2 text-[12px] font-medium text-gray-300 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 border border-transparent rounded transition-all ${
            collapsed ? 'justify-center' : ''
          }`}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut size={14} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
        {!collapsed && currentUser && (
          <div className="mt-3 px-1">
            <div className="text-[11px] font-semibold text-gray-200 truncate">{currentUser.username}</div>
            {currentFiscalYear && (
              <div className="text-[10px] text-gray-500 truncate mt-0.5">{currentFiscalYear.label}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
