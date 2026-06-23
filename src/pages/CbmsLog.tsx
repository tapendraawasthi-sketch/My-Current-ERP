import React, { useState, useEffect } from "react";
import { ActionToolbar } from "../components/ui";
import { Activity, RefreshCw, XCircle, CheckCircle, AlertCircle } from "lucide-react";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Table from "../components/ui/Table";
import { getDB } from "../lib/db";
import { CbmsLog } from "../lib/types";
import { batchSubmitPending } from "../lib/cbmsApi";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import toast from "react-hot-toast";

const CbmsLogPage: React.FC = () => {
  const { companySettings } = useStore();
  const [logs, setLogs] = useState<CbmsLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchLogs = async () => {
    try {
      const db = getDB();
      const allLogs = await db.cbmsLogs.orderBy('submittedAt').reverse().toArray();
      setLogs(allLogs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleBatchSync = async () => {
    if (!companySettings) return;
    setIsSyncing(true);
    try {
      const db = getDB();
      const res = await batchSubmitPending(db, companySettings);
      toast.success(`Sync complete: ${res.submitted} submitted, ${res.failed} failed out of ${res.total}`);
      await fetchLogs();
    } catch (err: any) {
      toast.error(err.message || "Batch sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const columns = [
    {
      key: "date",
      header: "Date/Time",
      render: (log: CbmsLog) => new Date(log.submittedAt).toLocaleString(),
    },
    {
      key: "invoiceNo",
      header: "Invoice No",
      render: (log: CbmsLog) => <span className="font-mono font-medium">{log.invoiceNo}</span>,
    },
    {
      key: "partyName",
      header: "Party Name",
    },
    {
      key: "amount",
      header: "Amount",
      render: (log: CbmsLog) => formatNumber(log.amount),
    },
    {
      key: "status",
      header: "Status",
      render: (log: CbmsLog) => {
        let icon = <Activity className="h-3 w-3 mr-1" />;
        let variant: any = "default";
        
        if (log.cbmsStatus === 'submitted') {
          icon = <CheckCircle className="h-3 w-3 mr-1" />;
          variant = "success";
        } else if (log.cbmsStatus === 'failed') {
          icon = <AlertCircle className="h-3 w-3 mr-1" />;
          variant = "danger";
        } else if (log.cbmsStatus === 'cancelled') {
          icon = <XCircle className="h-3 w-3 mr-1" />;
          variant = "warning";
        }

        return (
          <Badge variant={variant} className="flex items-center w-fit">
            {icon}
            {log.cbmsStatus.toUpperCase()}
          </Badge>
        );
      },
    },
    {
      key: "cbmsRefNo",
      header: "CBMS Ref No",
      render: (log: CbmsLog) => <span className="font-mono text-gray-500">{log.cbmsRefNo || '-'}</span>,
    },
    {
      key: "response",
      header: "Response Message",
      render: (log: CbmsLog) => <span className="text-xs text-gray-500 truncate max-w-[200px] inline-block" title={log.responseMessage}>{log.responseMessage || '-'}</span>,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <ActionToolbar title="CBMS Log" subtitle="Central Billing Management System Sync History" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CBMS Sync Logs</h1>
          <p className="text-sm text-gray-500 mt-1">Review the status of your invoice submissions to IRD</p>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={handleBatchSync}
          disabled={isSyncing}
          icon={<RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />}
        >
          {isSyncing ? "Syncing..." : "Sync Pending Invoices"}
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          data={logs}
          rowKey="id"
          emptyMessage={isLoading ? "Loading logs..." : "No CBMS sync logs found"}
        />
      </Card>
    </div>
  );
};

export default CbmsLogPage;
