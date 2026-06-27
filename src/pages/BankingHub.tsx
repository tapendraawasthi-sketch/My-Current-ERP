// @ts-nocheck
import React, { useMemo } from "react";
import { ActionToolbar, Button } from "../components/ui";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { Landmark, Printer, FileText, Building2, FileCheck, BarChart2, Zap, Send, CalendarClock, Clock } from "lucide-react";

interface BankingTileProps {
  title: string;
  icon: React.ReactNode;
  description: string;
  onClick: () => void;
}

const BankingTile: React.FC<BankingTileProps> = ({ title, icon, description, onClick }) => {
  return (
    <div 
      className="bg-white border border-[#9DC07A] rounded-lg p-6 shadow-sm hover:shadow-md hover:border-[#3D6B25] transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex flex-col items-center text-center">
        <div className="p-3 rounded-full bg-[#EBF5E2] mb-3">
          {icon}
        </div>
        <h3 className="font-bold text-[14px] mb-1">{title}</h3>
        <p className="text-[11px] text-gray-600">{description}</p>
      </div>
    </div>
  );
};

export default function BankingHub() {
  const { 
    setCurrentPage, 
    cheques, 
    pdCheques, 
    bankStatements, 
    auditLogs 
  } = useStore();

  // Calculate quick stats
  const pendingChequesToPrint = useMemo(() => {
    return cheques.filter(c => !c.isPrinted).length;
  }, [cheques]);

  const pdcDueThisWeek = useMemo(() => {
    const today = new Date();
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    return pdCheques.filter(p => {
      const chequeDate = new Date(p.chequeDate);
      const timeDiff = chequeDate.getTime() - today.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      return daysDiff >= 0 && daysDiff <= 7 && (p.status === "pending" || p.status === "due");
    }).length;
  }, [pdCheques]);

  const unreconciledStatementRows = useMemo(() => {
    return bankStatements.filter(bs => !bs.reconciled).length;
  }, [bankStatements]);

  // Recent banking activities
  const recentActivities = useMemo(() => {
    return auditLogs
      .filter(log => log.module === "banking")
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  }, [auditLogs]);

  const navigateToPage = (page: string) => {
    setCurrentPage(page);
  };

  return (
    <div className="flex flex-col h-full">
      <ActionToolbar 
        title="Banking" 
        icon={<Landmark size={16} />}
      >
        <Button size="sm" variant="outline" onClick={() => setCurrentPage("dashboard")}>
          Back to Dashboard
        </Button>
      </ActionToolbar>
      
      <div className="flex-1 overflow-auto p-4">
        {/* Banking Tiles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <BankingTile
            title="Cheque Printing"
            icon={<Printer size={28} className="text-[#3D6B25]" />}
            description="Print cheques from payment vouchers"
            onClick={() => navigateToPage("cheque-printing")}
          />
          
          <BankingTile
            title="Cheque Register"
            icon={<FileText size={28} className="text-[#3D6B25]" />}
            description="Track all issued cheques and status"
            onClick={() => navigateToPage("cheque-register")}
          />
          
          <BankingTile
            title="Deposit Slip"
            icon={<Building2 size={28} className="text-[#3D6B25]" />}
            description="Generate bank deposit slips"
            onClick={() => navigateToPage("deposit-slip")}
          />
          
          <BankingTile
            title="Payment Advice"
            icon={<FileCheck size={28} className="text-[#3D6B25]" />}
            description="Remittance advice for suppliers"
            onClick={() => navigateToPage("payment-advice")}
          />
          
          <BankingTile
            title="Bank Reconciliation"
            icon={<BarChart2 size={28} className="text-[#3D6B25]" />}
            description="Manual bank reconciliation"
            onClick={() => navigateToPage("bank-reconciliation")}
          />
          
          <BankingTile
            title="Auto Reconciliation"
            icon={<Zap size={28} className="text-[#3D6B25]" />}
            description="Import statement & auto-match"
            onClick={() => navigateToPage("auto-bank-reconciliation")}
          />
          
          <BankingTile
            title="e-Payments"
            icon={<Send size={28} className="text-[#3D6B25]" />}
            description="NEFT/RTGS payment file generation"
            onClick={() => navigateToPage("e-payments")}
          />
          
          <BankingTile
            title="PDC Summary"
            icon={<CalendarClock size={28} className="text-[#3D6B25]" />}
            description="Post-dated cheque tracker"
            onClick={() => navigateToPage("pdc-summary")}
          />
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-[#9DC07A] rounded-lg p-4 shadow-sm">
            <div className="flex items-center">
              <div className="p-2 rounded-full bg-yellow-100 mr-3">
                <Printer size={20} className="text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Pending Cheques to Print</p>
                <p className="text-2xl font-bold">{pendingChequesToPrint}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-[#9DC07A] rounded-lg p-4 shadow-sm">
            <div className="flex items-center">
              <div className="p-2 rounded-full bg-orange-100 mr-3">
                <CalendarClock size={20} className="text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">PDCs Due This Week</p>
                <p className="text-2xl font-bold">{pdcDueThisWeek}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-[#9DC07A] rounded-lg p-4 shadow-sm">
            <div className="flex items-center">
              <div className="p-2 rounded-full bg-blue-100 mr-3">
                <BarChart2 size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Unreconciled Statement Rows</p>
                <p className="text-2xl font-bold">{unreconciledStatementRows}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Recent Activities */}
        <div className="bg-white border border-[#9DC07A] rounded-lg p-4 shadow-sm">
          <h3 className="font-bold text-[14px] mb-3">Recent Banking Activities</h3>
          <div className="space-y-2">
            {recentActivities.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No recent banking activities</p>
            ) : (
              recentActivities.map((log, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{log.action}</p>
                    <p className="text-xs text-gray-500">{log.recordType} - {log.recordId}</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
