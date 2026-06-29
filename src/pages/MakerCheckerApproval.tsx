import React, { useMemo, useState } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Filter,
  Download,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { useStore } from "@/store/useStore";

type ApprovalTab = "pending" | "approved" | "rejected";

const VOUCHER_TYPES = [
  "ALL",
  "SALES",
  "PURCHASE",
  "PAYMENT",
  "RECEIPT",
  "JOURNAL",
  "DEBIT_NOTE",
  "CREDIT_NOTE",
];

function getVoucherNo(voucher: any): string {
  return voucher?.voucherNo ?? voucher?.invoiceNo ?? voucher?.no ?? "—";
}

function getVoucherAmount(voucher: any): number {
  return Number(voucher?.totalDebit ?? voucher?.totalAmount ?? voucher?.grandTotal ?? 0);
}

function formatAmount(value: number): string {
  return value.toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeType(type: string): string {
  return String(type || "")
    .replace(/-/g, "_")
    .toUpperCase();
}

function getStatusBadge(status: string) {
  const s = String(status || "").toLowerCase();

  if (s === "pending") {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-100 text-amber-700">
        Pending
      </span>
    );
  }

  if (s === "approved") {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-green-100 text-green-700">
        Approved
      </span>
    );
  }

  if (s === "rejected") {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-red-100 text-red-700">
        Rejected
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-gray-100 text-gray-700">
      Draft
    </span>
  );
}

export default function MakerCheckerApproval() {
  const store = useStore() as any;
  const vouchers = store.vouchers ?? [];

  const [activeTab, setActiveTab] = useState<ApprovalTab>("pending");
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [selectedVoucher, setSelectedVoucher] = useState<any | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approveRemark, setApproveRemark] = useState("");
  const [rejectAttempted, setRejectAttempted] = useState(false);

  const filterVoucherList = (list: any[]) => {
    const q = searchText.trim().toLowerCase();

    return list.filter((voucher) => {
      const no = getVoucherNo(voucher).toLowerCase();
      const narration = String(voucher?.narration ?? "").toLowerCase();
      const type = normalizeType(voucher?.type);

      const matchesSearch = !q || no.includes(q) || narration.includes(q);
      const matchesType = filterType === "ALL" || type === filterType;

      return matchesSearch && matchesType;
    });
  };

  const pendingVouchers = useMemo(
    () =>
      filterVoucherList(vouchers.filter((v: any) => String(v?.status).toLowerCase() === "pending")),
    [vouchers, searchText, filterType],
  );

  const approvedVouchers = useMemo(
    () =>
      filterVoucherList(
        vouchers.filter((v: any) => String(v?.status).toLowerCase() === "approved"),
      ),
    [vouchers, searchText, filterType],
  );

  const rejectedVouchers = useMemo(
    () =>
      filterVoucherList(
        vouchers.filter((v: any) => String(v?.status).toLowerCase() === "rejected"),
      ),
    [vouchers, searchText, filterType],
  );

  const currentList =
    activeTab === "pending"
      ? pendingVouchers
      : activeTab === "approved"
        ? approvedVouchers
        : rejectedVouchers;

  const approvedTodayCount = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return vouchers.filter(
      (voucher: any) =>
        String(voucher?.status).toLowerCase() === "approved" &&
        String(voucher?.approvedAt ?? "").startsWith(today),
    ).length;
  }, [vouchers]);

  const handleApprove = async (voucherId: string) => {
    try {
      const updateVoucher = store.updateVoucher;

      if (typeof updateVoucher !== "function") {
        alert("updateVoucher function is not available in store");
        return;
      }

      await updateVoucher(voucherId, {
        status: "approved",
        approvedBy: "Current User",
        approvedAt: new Date().toISOString(),
        approveRemark,
      });

      setShowApproveModal(false);
      setSelectedVoucher(null);
      setApproveRemark("");
      alert("Voucher approved successfully");
    } catch (error: any) {
      alert(error?.message || "Failed to approve voucher");
    }
  };

  const handleReject = async (voucherId: string) => {
    try {
      setRejectAttempted(true);

      if (!rejectReason.trim()) {
        alert("Please enter rejection reason");
        return;
      }

      const updateVoucher = store.updateVoucher;

      if (typeof updateVoucher !== "function") {
        alert("updateVoucher function is not available in store");
        return;
      }

      await updateVoucher(voucherId, {
        status: "rejected",
        rejectedBy: "Current User",
        rejectedAt: new Date().toISOString(),
        rejectionReason: rejectReason,
      });

      setShowRejectModal(false);
      setSelectedVoucher(null);
      setRejectReason("");
      setRejectAttempted(false);
      alert("Voucher rejected");
    } catch (error: any) {
      alert(error?.message || "Failed to reject voucher");
    }
  };

  const openApproveModal = (voucher: any) => {
    setSelectedVoucher(voucher);
    setApproveRemark("");
    setShowApproveModal(true);
  };

  const openRejectModal = (voucher: any) => {
    setSelectedVoucher(voucher);
    setRejectReason("");
    setRejectAttempted(false);
    setShowRejectModal(true);
  };

  return (
    <div className="p-6 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Voucher Approval Queue</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Review and approve/reject vouchers submitted for posting
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>

          <div className="relative">
            <Filter className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={filterType}
              onChange={(event) => setFilterType(event.target.value)}
              className="h-8 pl-7 pr-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              {VOUCHER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type === "ALL" ? "All Types" : type.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search vouchers..."
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-48"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-gray-500 font-medium">Pending Approval</p>
              <p className="text-[22px] font-semibold text-amber-700 mt-1">
                {pendingVouchers.length}
              </p>
            </div>
            <Clock className="h-7 w-7 text-amber-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-gray-500 font-medium">Approved Today</p>
              <p className="text-[22px] font-semibold text-green-700 mt-1">{approvedTodayCount}</p>
            </div>
            <CheckCircle className="h-7 w-7 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-gray-500 font-medium">Rejected</p>
              <p className="text-[22px] font-semibold text-red-700 mt-1">
                {rejectedVouchers.length}
              </p>
            </div>
            <XCircle className="h-7 w-7 text-red-600" />
          </div>
        </div>
      </div>

      <div className="flex border-b border-gray-200 mb-4">
        {(["pending", "approved", "rejected"] as ApprovalTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={
              activeTab === tab
                ? "px-4 py-2 border-b-2 border-[#1557b0] text-[#1557b0] text-[12px] font-medium"
                : "px-4 py-2 text-gray-500 text-[12px] hover:text-gray-700"
            }
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="bg-[#f5f6fa] border-b border-gray-200">
            <tr>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Voucher No
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Type
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Date (BS)
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Narration
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Amount (Dr)
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Created By
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Status
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {currentList.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center">
                  <FileText className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-[12px] text-gray-400">No vouchers found</p>
                </td>
              </tr>
            ) : (
              currentList.map((voucher: any) => (
                <tr key={voucher.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono font-medium">
                    {getVoucherNo(voucher)}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">
                    {String(voucher?.type ?? "—").replace(/_/g, " ")}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">
                    {voucher?.dateNepali ?? voucher?.date ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700 max-w-[300px] truncate">
                    {voucher?.narration ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right font-mono">
                    {formatAmount(getVoucherAmount(voucher))}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">
                    {voucher?.createdByName ?? voucher?.createdBy ?? "Unknown"}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">
                    {getStatusBadge(voucher?.status)}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">
                    {activeTab === "pending" ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openApproveModal(voucher)}
                          className="h-7 px-2 text-[11px] rounded bg-green-600 hover:bg-green-700 text-white font-medium"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => openRejectModal(voucher)}
                          className="h-7 px-2 text-[11px] rounded bg-red-600 hover:bg-red-700 text-white font-medium"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedVoucher(voucher)}
                          className="h-7 w-7 border border-gray-300 rounded bg-white hover:bg-gray-50 inline-flex items-center justify-center"
                          title="View"
                        >
                          <Eye className="h-3.5 w-3.5 text-gray-600" />
                        </button>
                      </div>
                    ) : activeTab === "approved" ? (
                      <div className="text-[11px] text-gray-500">
                        <div>Approved by {voucher?.approvedBy ?? "—"}</div>
                        <div>
                          {voucher?.approvedAt
                            ? new Date(voucher.approvedAt).toLocaleString()
                            : "—"}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-500">
                        <div>Rejected by {voucher?.rejectedBy ?? "—"}</div>
                        <div title={voucher?.rejectionReason ?? ""}>
                          {String(voucher?.rejectionReason ?? "—").length > 30
                            ? `${String(voucher?.rejectionReason).slice(0, 30)}...`
                            : (voucher?.rejectionReason ?? "—")}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showApproveModal && selectedVoucher && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-[14px] font-semibold text-gray-800">Approve Voucher</h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-[#f5f6fa] border border-gray-200 rounded-md p-3 text-[12px] text-gray-700">
                <div className="flex justify-between mb-1">
                  <span>Voucher No</span>
                  <span className="font-mono font-medium">{getVoucherNo(selectedVoucher)}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Type</span>
                  <span>{String(selectedVoucher?.type ?? "—").replace(/_/g, " ")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount</span>
                  <span className="font-mono">
                    {formatAmount(getVoucherAmount(selectedVoucher))}
                  </span>
                </div>
              </div>
              <textarea
                value={approveRemark}
                onChange={(event) => setApproveRemark(event.target.value)}
                placeholder="Add approval remark (optional)"
                rows={3}
                className="w-full px-2.5 py-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              />
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowApproveModal(false);
                  setSelectedVoucher(null);
                }}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleApprove(selectedVoucher.id)}
                className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && selectedVoucher && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-[14px] font-semibold text-red-700">Reject Voucher</h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-md p-3 flex gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-[12px] text-red-700">
                  This voucher will be sent back for correction.
                </p>
              </div>
              <textarea
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="Enter rejection reason"
                rows={3}
                className={`w-full px-2.5 py-2 text-[12px] border rounded-md bg-white focus:outline-none focus:ring-2 ${
                  rejectAttempted && !rejectReason.trim()
                    ? "border-red-400 focus:ring-red-200 focus:border-red-500"
                    : "border-gray-300 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                }`}
              />
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedVoucher(null);
                }}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleReject(selectedVoucher.id)}
                className="h-8 px-3 bg-red-600 hover:bg-red-700 text-white text-[12px] font-medium rounded-md"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
