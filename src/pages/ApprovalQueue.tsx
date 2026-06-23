import React, { useEffect, useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { ADToBSString } from "../lib/nepaliDate";
import { CheckCircle2, XCircle, Clock, Eye, MessageSquare, AlertCircle } from "lucide-react";
import { Badge, Button, Card, Modal } from "../components/ui";
import toast from "react-hot-toast";
import { ApprovalRequest, UserRole } from "../lib/types";

const ApprovalQueue = () => {
  const {
    approvalRequests,
    loadApprovalRequests,
    approveVoucher,
    rejectVoucher,
    currentUser,
    users,
  } = useStore();

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [comment, setComment] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadApprovalRequests().finally(() => setIsLoading(false));
  }, [loadApprovalRequests]);

  const canApprove = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.MANAGER;

  const pendingRequests = useMemo(() => {
    return approvalRequests.filter((r) => r.status === "pending").sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }, [approvalRequests]);

  const historyRequests = useMemo(() => {
    return approvalRequests.filter((r) => r.status !== "pending").sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }, [approvalRequests]);

  const displayedRequests = activeTab === "pending" ? pendingRequests : historyRequests;

  const handleAction = async () => {
    if (!selectedRequest || !actionType) return;
    if (actionType === "reject" && !comment.trim()) {
      toast.error("Please provide a rejection reason.");
      return;
    }

    setSubmitting(true);
    try {
      if (actionType === "approve") {
        await approveVoucher(selectedRequest.id, comment.trim());
        toast.success("Voucher approved & posted successfully.");
      } else {
        await rejectVoucher(selectedRequest.id, comment.trim());
        toast.success("Voucher rejected.");
      }
      setSelectedRequest(null);
      setComment("");
      setActionType(null);
    } catch (e: any) {
      toast.error(e.message || "Action failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center text-gray-500">Loading approval queue...</div>;
  }

  return (
    <div className="page-wrapper">
      <div className="page-toolbar">
        <div className="page-toolbar-left">
          <div className="page-title">Approval Queue</div>
          <div className="page-subtitle">Review and approve pending vouchers</div>
        </div>
      </div>

      <div className="page-content-area">
        <div className="flex gap-4 mb-4 border-b border-gray-200">
          <button
            className={`px-4 py-2 text-[13px] font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "pending"
                ? "border-[#1557b0] text-[#1557b0]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab("pending")}
          >
            <Clock className="w-4 h-4" />
            Pending ({pendingRequests.length})
          </button>
          <button
            className={`px-4 py-2 text-[13px] font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "history"
                ? "border-[#1557b0] text-[#1557b0]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab("history")}
          >
            <CheckCircle2 className="w-4 h-4" />
            History
          </button>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10 text-center">#</th>
                  <th>Submitted At</th>
                  <th>Submitted By</th>
                  <th>Voucher Type</th>
                  <th>Voucher No</th>
                  <th className="th-right">Amount</th>
                  <th className="text-center">Status</th>
                  {activeTab === "history" && <th>Reviewed By</th>}
                  <th className="w-24 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedRequests.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === "history" ? 9 : 8} className="text-center py-8 text-gray-500 text-[13px]">
                      {activeTab === "pending" ? "No pending approvals." : "No approval history."}
                    </td>
                  </tr>
                ) : (
                  displayedRequests.map((req, i) => (
                    <tr key={req.id}>
                      <td className="text-center text-gray-500">{i + 1}</td>
                      <td>
                        {new Date(req.submittedAt).toLocaleDateString()} <br />
                        <span className="text-[10px] text-gray-400">
                          {new Date(req.submittedAt).toLocaleTimeString()}
                        </span>
                      </td>
                      <td>{req.submittedByName}</td>
                      <td className="capitalize">{req.voucherType.replace("_", " ")}</td>
                      <td className="font-mono text-gray-600">{req.voucherNo}</td>
                      <td className="text-right font-mono font-medium">{formatNumber(req.amount)}</td>
                      <td className="text-center">
                        {req.status === "pending" && <Badge className="badge-warning">Pending</Badge>}
                        {req.status === "approved" && <Badge className="badge-success">Approved</Badge>}
                        {req.status === "rejected" && <Badge className="badge-danger">Rejected</Badge>}
                      </td>
                      {activeTab === "history" && (
                        <td>
                          {req.reviewedByName}
                          {req.reviewComment && (
                            <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                              <MessageSquare className="w-3 h-3" />
                              {req.reviewComment}
                            </div>
                          )}
                        </td>
                      )}
                      <td className="text-center">
                        {activeTab === "pending" && canApprove ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(req);
                              setActionType(null);
                              setComment("");
                            }}
                          >
                            Review
                          </Button>
                        ) : (
                          <span className="text-gray-400 text-[11px]">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal
        isOpen={!!selectedRequest}
        onClose={() => !submitting && setSelectedRequest(null)}
        title="Review Voucher"
      >
        {selectedRequest && (
          <div className="space-y-4 w-[400px]">
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div className="text-gray-500">Voucher Type:</div>
                <div className="font-semibold capitalize">{selectedRequest.voucherType.replace("_", " ")}</div>
                <div className="text-gray-500">Voucher No:</div>
                <div className="font-mono">{selectedRequest.voucherNo}</div>
                <div className="text-gray-500">Amount:</div>
                <div className="font-mono font-bold text-[#1557b0]">{formatNumber(selectedRequest.amount)}</div>
                <div className="text-gray-500">Submitted By:</div>
                <div>{selectedRequest.submittedByName}</div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-700">Reviewer Comment {actionType === "reject" && <span className="text-red-500">*</span>}</label>
              <textarea
                className="w-full text-[12px] p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                rows={3}
                placeholder="Add an optional comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={submitting}
              />
            </div>

            {!actionType ? (
              <div className="flex gap-2 justify-end mt-6">
                <Button variant="outline" onClick={() => setSelectedRequest(null)}>Cancel</Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => setActionType("reject")}
                >
                  <XCircle className="w-4 h-4 mr-1" /> Reject
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => setActionType("approve")}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                </Button>
              </div>
            ) : (
              <div className="flex justify-between items-center mt-6">
                <button
                  className="text-[12px] text-gray-500 hover:text-gray-700"
                  onClick={() => setActionType(null)}
                  disabled={submitting}
                >
                  &larr; Back
                </button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSelectedRequest(null)} disabled={submitting}>Cancel</Button>
                  {actionType === "approve" ? (
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={handleAction}
                      disabled={submitting}
                    >
                      {submitting ? "Processing..." : "Confirm Approve"}
                    </Button>
                  ) : (
                    <Button
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={handleAction}
                      disabled={submitting || !comment.trim()}
                    >
                      {submitting ? "Processing..." : "Confirm Reject"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ApprovalQueue;
