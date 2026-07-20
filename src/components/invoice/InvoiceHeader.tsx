/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Invoice document toolbar + essential/advanced header fields (STEP 5.2).
 */

import React from "react";
import { Badge, Button, Input, Select, PartySelect, NepaliDatePicker } from "../ui";
import { ArrowLeft, Link2 } from "lucide-react";
import { PartyType, VoucherStatus } from "@/lib/types";

interface InvoiceHeaderMeta {
  isSales: boolean;
  party: PartyType;
}

interface SelectOption {
  value: string;
  label: string;
}

interface InvoiceHeaderProps {
  invoiceNoPreview: string;
  documentId: string | null;
  existing?: {
    status?: VoucherStatus;
    cbmsSubmitted?: boolean | null;
  } | null;
  companySettings?: {
    cbmsEnabled?: boolean;
  } | null;
  meta: InvoiceHeaderMeta;
  type: "sales" | "purchase" | "sales-return" | "purchase-return";
  partyId: string;
  party?: { pan?: string } | null;
  date: string;
  dueDate: string;
  billTo: string;
  referenceNo: string;
  originalInvoiceId: string;
  originalSalesInvoiceOptions: SelectOption[];
  originalPurchaseInvoiceOptions: SelectOption[];
  headerAdvanced: boolean;
  readOnly: boolean;
  onBack: () => void;
  onCopyLink: () => void;
  onPartyIdChange: (v: string) => void;
  onDateChange: (v: string) => void;
  onDueDateChange: (v: string) => void;
  onBillToChange: (v: string) => void;
  onReferenceNoChange: (v: string) => void;
  onOriginalInvoiceChange: (v: string) => void;
  onHeaderAdvancedToggle: () => void;
}

const InvoiceHeader: React.FC<InvoiceHeaderProps> = ({
  invoiceNoPreview,
  documentId,
  existing,
  companySettings,
  meta,
  type,
  partyId,
  party,
  date,
  dueDate,
  billTo,
  referenceNo,
  originalInvoiceId,
  originalSalesInvoiceOptions,
  originalPurchaseInvoiceOptions,
  headerAdvanced,
  readOnly,
  onBack,
  onCopyLink,
  onPartyIdChange,
  onDateChange,
  onDueDateChange,
  onBillToChange,
  onReferenceNoChange,
  onOriginalInvoiceChange,
  onHeaderAdvancedToggle,
}) => {
  return (
    <>
      {/* Compact doc toolbar — title lives on TransactionWorkspace */}
      <div className="flex items-center justify-between py-2 px-3 border-b border-[var(--ds-border-default)] sticky top-0 z-10 bg-[var(--ds-surface)]">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-2 rounded-md hover:bg-[var(--ds-surface-muted)] text-[var(--ds-text-default)]"
            aria-label="Back"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="font-mono text-[12px] font-medium text-[var(--ds-text-default)]">
            {invoiceNoPreview}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {documentId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCopyLink}
              icon={<Link2 className="h-3.5 w-3.5" />}
              title="Copy shareable link"
            >
              Copy link
            </Button>
          )}
          <Badge
            variant={
              existing?.status === VoucherStatus.POSTED
                ? "success"
                : existing?.status === VoucherStatus.CANCELLED
                  ? "danger"
                  : "default"
            }
            size="sm"
          >
            {existing?.status === VoucherStatus.POSTED
              ? "Posted"
              : existing?.status === VoucherStatus.CANCELLED
                ? "Cancelled"
                : existing?.status === VoucherStatus.DRAFT
                  ? "Draft"
                  : "New"}
          </Badge>
          {companySettings?.cbmsEnabled && (
            <Badge
              variant={
                existing?.cbmsSubmitted === true
                  ? "success"
                  : existing?.cbmsSubmitted === false
                    ? "danger"
                    : "default"
              }
              size="sm"
            >
              {existing?.cbmsSubmitted === true
                ? "CBMS synced"
                : existing?.cbmsSubmitted === false
                  ? "CBMS failed"
                  : "CBMS pending"}
            </Badge>
          )}
        </div>
      </div>

      {/* Essential header — Party · Date · Doc no (STEP 2.3) */}
      <div className="form-section mb-3" data-testid="invoice-essential-header">
        <div className="form-section-title">Party Details</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <PartySelect
            label={meta.isSales ? "Customer" : "Supplier"}
            partyType={meta.party}
            value={partyId}
            onChange={onPartyIdChange}
            required
            disabled={readOnly}
          />
          <Input
            label="PAN"
            value={party?.pan || ""}
            onChange={() => {}}
            disabled
            placeholder="—"
          />
          <NepaliDatePicker
            label="Invoice Date"
            value={date}
            onChange={onDateChange}
            required
            disabled={readOnly}
          />
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-[var(--ds-text-default)]">Invoice No</span>
            <span className="inline-flex items-center h-8 px-2.5 rounded-md bg-[var(--ds-surface-muted)] border border-[var(--ds-border-default)] font-mono font-medium text-[var(--ds-text-default)] text-[12px]">
              {invoiceNoPreview}
            </span>
          </div>
          {type === "sales-return" && (
            <Select
              label="Original Sales Invoice"
              value={originalInvoiceId}
              onChange={onOriginalInvoiceChange}
              options={originalSalesInvoiceOptions}
              placeholder="Select original invoice"
              disabled={readOnly}
            />
          )}
          {type === "purchase-return" && (
            <Select
              label="Original Purchase Invoice"
              value={originalInvoiceId}
              onChange={onOriginalInvoiceChange}
              options={originalPurchaseInvoiceOptions}
              placeholder="Select original invoice"
              disabled={readOnly}
            />
          )}
        </div>

        <div className="mt-3 rounded-md border border-[var(--ds-border-default)]">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[var(--ds-surface-muted)]"
            aria-expanded={headerAdvanced}
            onClick={onHeaderAdvancedToggle}
            data-testid="invoice-header-advanced"
          >
            <span className="text-[12px] font-medium text-[var(--ds-text-default)]">
              More header fields
              <span className="ml-1.5 font-normal text-[var(--ds-text-muted)]">
                Due date · Address · Reference
              </span>
            </span>
            <span className="text-[12px] font-medium text-[var(--ds-action-primary)]">
              {headerAdvanced ? "Hide" : "Show"}
            </span>
          </button>
          {headerAdvanced ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border-t border-[var(--ds-border-default)] p-3">
              <NepaliDatePicker
                label="Due Date"
                value={dueDate}
                onChange={onDueDateChange}
                disabled={readOnly}
              />
              <div className="md:col-span-2">
                <Input
                  label="Bill To Address"
                  value={billTo}
                  onChange={onBillToChange}
                  placeholder="Auto-filled from party"
                  disabled={readOnly}
                />
              </div>
              <Input
                label="Reference No"
                value={referenceNo}
                onChange={onReferenceNoChange}
                placeholder="Optional"
                disabled={readOnly}
              />
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default InvoiceHeader;
