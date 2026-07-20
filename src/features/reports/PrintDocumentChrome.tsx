import * as React from "react";

export type PrintCompanyInfo = {
  companyName?: string;
  nameNepali?: string;
  address?: string;
  pan?: string;
  phone?: string;
  logoUrl?: string | null;
};

export type PrintDocumentHeaderProps = PrintCompanyInfo & {
  title: string;
  periodLabel?: string;
};

/** Auditor-ready print header — place before report body inside print flow (STEP 6.4). */
export function PrintDocumentHeader({
  companyName,
  nameNepali,
  address,
  pan,
  phone,
  logoUrl,
  title,
  periodLabel,
}: PrintDocumentHeaderProps) {
  return (
    <div className="print-document-header mb-4 flex items-start gap-3 border-b border-gray-300 pb-3 text-[12px] text-gray-800">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-12 w-12 shrink-0 object-contain" />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold">{companyName || "Company"}</div>
        {nameNepali ? (
          <div lang="ne" className="text-[12px]">
            {nameNepali}
          </div>
        ) : null}
        {address ? <div className="text-[11px] text-gray-600">{address}</div> : null}
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-gray-600">
          {pan ? <span>PAN: {pan}</span> : null}
          {phone ? <span>Tel: {phone}</span> : null}
        </div>
        <div className="mt-2 text-[13px] font-semibold">{title}</div>
        {periodLabel ? <div className="text-[11px] text-gray-600">{periodLabel}</div> : null}
      </div>
      <div className="shrink-0 text-right text-[10px] text-gray-500">
        <div>Printed: {new Date().toLocaleString("en-IN")}</div>
      </div>
    </div>
  );
}

/** Signature lines — place after report body for print (STEP 6.4). */
export function PrintDocumentSignatures() {
  return (
    <div className="print-signature-block mt-8 grid grid-cols-3 gap-6 border-t border-gray-300 pt-6 text-[11px] text-gray-800">
      {["Prepared by", "Checked by", "Approved by"].map((label) => (
        <div key={label}>
          <div className="mb-10 border-b border-gray-400" />
          <div className="font-medium text-gray-700">{label}</div>
          <div className="text-gray-500">Name / Date</div>
        </div>
      ))}
    </div>
  );
}

/** @deprecated Prefer PrintDocumentHeader + PrintDocumentSignatures around body. */
export function PrintDocumentChrome(
  props: PrintDocumentHeaderProps & { signatures?: boolean },
) {
  const { signatures = true, ...header } = props;
  return (
    <div className="print-document-chrome">
      <PrintDocumentHeader {...header} />
      {signatures ? <PrintDocumentSignatures /> : null}
    </div>
  );
}
