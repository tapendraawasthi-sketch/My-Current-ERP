// src/components/CbmsStatusBadge.tsx

import React, { useMemo, useState } from "react";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import { cbmsService } from "../lib/cbmsService";
import { useStore } from "../store/useStore";

interface CbmsStatusBadgeProps {
  invoice: any;
  onUpdated?: () => void;
}

const CbmsStatusBadge: React.FC<CbmsStatusBadgeProps> = ({ invoice, onUpdated }) => {
  const { companySettings } = useStore() as any;
  const [open, setOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const status = useMemo(() => {
    if (invoice.cbmsSubmitted && invoice.cbmsIrn) return "submitted";
    if (invoice.cbmsStatus === "failed" || invoice.cbmsError) return "failed";
    return "pending";
  }, [invoice]);

  const badgeClass =
    status === "submitted"
      ? "bg-green-100 text-green-700 border-green-200"
      : status === "failed"
        ? "bg-red-100 text-red-700 border-red-200"
        : "bg-yellow-100 text-yellow-700 border-yellow-200";

  const label =
    status === "submitted"
      ? `IRN: ${String(invoice.cbmsIrn).slice(0, 8)}`
      : status === "failed"
        ? "Submission Failed"
        : "Pending Submission";

  const openModal = async () => {
    setOpen(true);

    const qrString = invoice.cbmsQrString || invoice.cbmsQrCode || invoice.cbmsIrn || "";

    if (qrString) {
      const dataUrl = await QRCode.toDataURL(qrString, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 180,
      });
      setQrDataUrl(dataUrl);
    }
  };

  const handleResubmit = async () => {
    try {
      setSubmitting(true);
      const result = await cbmsService.submitInvoice(invoice, companySettings);

      if (result.success) {
        toast.success("Invoice submitted to CBMS.");
        setOpen(false);
        onUpdated?.();
      } else {
        toast.error(result.message || "CBMS submission failed.");
      }
    } catch (error: any) {
      toast.error(error?.message || "CBMS submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded border ${badgeClass}`}
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-[15px] font-semibold text-gray-800">CBMS Status</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-800"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 text-[12px]">
              <div>
                <div className="text-gray-500 text-[10px] uppercase font-semibold">Invoice No.</div>
                <div className="font-semibold">{invoice.invoiceNo}</div>
              </div>

              <div>
                <div className="text-gray-500 text-[10px] uppercase font-semibold">Status</div>
                <div className="mt-1">
                  <span
                    className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${badgeClass}`}
                  >
                    {label}
                  </span>
                </div>
              </div>

              <div>
                <div className="text-gray-500 text-[10px] uppercase font-semibold">Full IRN</div>
                <div className="font-mono break-all">{invoice.cbmsIrn || "Not submitted"}</div>
              </div>

              <div>
                <div className="text-gray-500 text-[10px] uppercase font-semibold">
                  Submitted At
                </div>
                <div>{invoice.cbmsSubmittedAt || "—"}</div>
              </div>

              {invoice.cbmsError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded p-2">
                  {invoice.cbmsError}
                </div>
              )}

              {qrDataUrl && (
                <div className="flex justify-center py-2">
                  <img src={qrDataUrl} alt="CBMS QR" className="w-40 h-40" />
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md"
              >
                Close
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleResubmit}
                className="h-8 px-3 bg-[#1557b0] text-white text-[12px] rounded-md disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Resubmit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CbmsStatusBadge;
