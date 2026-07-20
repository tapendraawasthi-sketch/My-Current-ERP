// src/components/CbmsStatusBadge.tsx

import React, { useMemo, useState } from "react";
import QRCode from "qrcode";
import toast from "@/lib/appToast";
import { cbmsService } from "../lib/cbmsService";
import { useStore } from "../store/useStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  Button,
} from "@/design-system";

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
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "failed"
        ? "bg-red-100 text-red-700 border-red-200"
        : "bg-amber-50 text-amber-700 border-amber-200";

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
    } else {
      setQrDataUrl("");
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
        onClick={() => void openModal()}
        className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded border ${badgeClass}`}
      >
        {label}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="small" showClose>
          <DialogHeader>
            <DialogTitle>CBMS Status</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4 text-[12px]">
            <div>
              <div className="text-gray-500 text-[10px] uppercase font-semibold tracking-wide">
                Invoice No.
              </div>
              <div className="font-medium text-[var(--ds-text-default)]">{invoice.invoiceNo}</div>
            </div>

            <div>
              <div className="text-gray-500 text-[10px] uppercase font-semibold tracking-wide">
                Status
              </div>
              <div className="mt-1">
                <span
                  className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${badgeClass}`}
                >
                  {label}
                </span>
              </div>
            </div>

            <div>
              <div className="text-gray-500 text-[10px] uppercase font-semibold tracking-wide">
                Full IRN
              </div>
              <div className="font-mono break-all text-[var(--ds-text-default)]">
                {invoice.cbmsIrn || "Not submitted"}
              </div>
            </div>

            <div>
              <div className="text-gray-500 text-[10px] uppercase font-semibold tracking-wide">
                Submitted At
              </div>
              <div>{invoice.cbmsSubmittedAt || "—"}</div>
            </div>

            {invoice.cbmsError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-3 text-[11px]">
                {invoice.cbmsError}
              </div>
            )}

            {qrDataUrl && (
              <div className="flex justify-center py-2">
                <img src={qrDataUrl} alt="CBMS QR" className="w-40 h-40" />
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" size="small" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              size="small"
              disabled={submitting}
              loading={submitting}
              onClick={() => void handleResubmit()}
            >
              {submitting ? "Submitting..." : "Resubmit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CbmsStatusBadge;
