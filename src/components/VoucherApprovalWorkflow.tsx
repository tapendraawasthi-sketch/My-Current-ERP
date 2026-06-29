// @ts-nocheck
import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { CheckCircle, Clock, AlertCircle, ArrowRight, XCircle } from "lucide-react";
import toast from "react-hot-toast";

interface VoucherApprovalProps {
  voucherType: string;
  currentStatus: string;
  voucherId: string;
  onStatusChange: (newStatus: string) => void;
}

function getWorkflowPermission(
  role: string,
  currentStatus: string,
): { canAdvance: boolean; nextStatus: string; canReject: boolean; rejectStatus: string } {
  if (role === "accountant") {
    if (currentStatus === "draft")
      return { canAdvance: true, nextStatus: "submitted", canReject: false, rejectStatus: "" };
    return { canAdvance: false, nextStatus: "", canReject: false, rejectStatus: "" };
  }
  if (role === "manager") {
    if (currentStatus === "submitted")
      return {
        canAdvance: true,
        nextStatus: "under_review",
        canReject: true,
        rejectStatus: "draft",
      };
    if (currentStatus === "under_review")
      return { canAdvance: true, nextStatus: "approved", canReject: true, rejectStatus: "draft" };
    return { canAdvance: false, nextStatus: "", canReject: false, rejectStatus: "" };
  }
  if (role === "admin") {
    if (currentStatus === "draft")
      return { canAdvance: true, nextStatus: "submitted", canReject: false, rejectStatus: "" };
    if (currentStatus === "submitted")
      return { canAdvance: true, nextStatus: "approved", canReject: true, rejectStatus: "draft" };
    if (currentStatus === "under_review")
      return { canAdvance: true, nextStatus: "approved", canReject: true, rejectStatus: "draft" };
    if (currentStatus === "approved")
      return { canAdvance: true, nextStatus: "posted", canReject: false, rejectStatus: "" };
    return { canAdvance: false, nextStatus: "", canReject: false, rejectStatus: "" };
  }
  return { canAdvance: false, nextStatus: "", canReject: false, rejectStatus: "" };
}

const VoucherApprovalWorkflow: React.FC<VoucherApprovalProps> = ({
  voucherType,
  currentStatus,
  voucherId,
  onStatusChange,
}) => {
  const { currentUser } = useStore();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"advance" | "reject" | null>(null);

  const steps = ["draft", "submitted", "under_review", "approved", "posted"];
  const currentIndex = steps.indexOf(currentStatus);

  const permissions = getWorkflowPermission(currentUser?.role || "accountant", currentStatus);

  const getStatusIcon = (index: number) => {
    if (index < currentIndex) {
      return <CheckCircle className="w-4 h-4" />;
    } else if (index === currentIndex) {
      return <Clock className="w-4 h-4" />;
    } else {
      return <div className="w-2 h-2 rounded-full bg-gray-400" />;
    }
  };

  const getStatusClass = (index: number) => {
    if (index < currentIndex) {
      return "bg-green-600 text-white shadow-sm ring-2 ring-green-100";
    } else if (index === currentIndex) {
      return "bg-[#1557b0] text-white shadow-sm ring-4 ring-[#1557b0]/20";
    } else {
      return "bg-gray-100 border-2 border-gray-200 text-gray-500";
    }
  };

  const handleAction = (action: "advance" | "reject") => {
    if (action === "advance" && permissions.canAdvance) {
      onStatusChange(permissions.nextStatus);
    } else if (action === "reject" && permissions.canReject) {
      onStatusChange(permissions.rejectStatus || "rejected");
    }
    setShowConfirm(false);
    setConfirmAction(null);
  };

  return (
    <div className="w-full py-4 border-t border-gray-100 mt-4">
      {/* Stepper */}
      <div className="flex items-center justify-between relative px-4">
        {steps.map((step, index) => (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center relative z-10">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${getStatusClass(index)}`}
              >
                {getStatusIcon(index)}
              </div>
              <div
                className={`text-[10px] mt-2 font-medium capitalize tracking-wide ${index <= currentIndex ? "text-gray-800" : "text-gray-400"}`}
              >
                {step.replace("_", " ")}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 -mt-5 rounded-full transition-colors duration-300 ${index < currentIndex ? "bg-green-500" : "bg-gray-200"}`}
              ></div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Status Info */}
      <div className="mt-8 flex flex-col items-center">
        {currentStatus === "rejected" && (
          <div className="w-full bg-red-50 text-red-700 p-3 rounded-md border border-red-200 flex items-start gap-2 mb-4 text-[12px] font-medium shadow-sm">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p>This voucher has been rejected. Please correct any issues and resubmit.</p>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          {permissions.canAdvance && (
            <button
              className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
              onClick={() => {
                setConfirmAction("advance");
                setShowConfirm(true);
              }}
            >
              Advance to {permissions.nextStatus.replace("_", " ")}
              <ArrowRight size={14} />
            </button>
          )}

          {permissions.canReject && (
            <button
              className="h-8 px-4 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
              onClick={() => {
                setConfirmAction("reject");
                setShowConfirm(true);
              }}
            >
              <XCircle size={14} />
              Reject
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md shadow-xl border border-gray-200 w-full max-w-sm flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-100 bg-[#f5f6fa] flex items-center gap-2">
              {confirmAction === "advance" ? (
                <CheckCircle className="w-5 h-5 text-[#1557b0]" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <h3 className="text-[14px] font-semibold text-gray-800">
                Confirm {confirmAction === "advance" ? "Advance" : "Reject"}
              </h3>
            </div>

            <div className="p-5">
              <p className="text-[12px] text-gray-600">
                Are you sure you want to{" "}
                {confirmAction === "advance" ? (
                  <span className="font-semibold text-gray-800">
                    advance this to {permissions.nextStatus.replace("_", " ")}
                  </span>
                ) : (
                  <span className="font-semibold text-red-600">reject</span>
                )}{" "}
                this voucher?
              </p>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
              <button
                className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
                onClick={() => {
                  setShowConfirm(false);
                  setConfirmAction(null);
                }}
              >
                Cancel
              </button>
              <button
                className={`h-8 px-4 text-white text-[12px] font-medium rounded-md transition-colors shadow-sm ${
                  confirmAction === "advance"
                    ? "bg-[#1557b0] hover:bg-[#0f4a96]"
                    : "bg-red-600 hover:bg-red-700"
                }`}
                onClick={() => handleAction(confirmAction!)}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoucherApprovalWorkflow;
