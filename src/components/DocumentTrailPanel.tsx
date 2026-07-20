import React, { useMemo } from "react";
import { buildDocumentTrail, docNo } from "../lib/workflowUtils";

interface Props {
  voucher: any;
  vouchers: any[];
  onOpen?: (voucherId: string) => void;
}

const DocumentTrailPanel: React.FC<Props> = ({ voucher, vouchers, onOpen }) => {
  const trail = useMemo(
    () => (voucher ? buildDocumentTrail(voucher, vouchers || []) : []),
    [voucher, vouchers],
  );

  if (!voucher) return null;

  return (
    <div className="bg-white border border-gray-100 rounded-lg p-4 shadow-sm">
      <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">
        Document Trail
      </h3>

      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        {trail.map((doc, index) => (
          <React.Fragment key={doc.id}>
            {index > 0 && <span className="text-gray-300">→</span>}

            <button
              type="button"
              onClick={() => onOpen?.(doc.id)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white hover:bg-blue-50 hover:border-blue-200 transition-colors shadow-sm"
            >
              <span className="font-mono text-[11px] text-gray-700">{docNo(doc)}</span>
              <span className="ml-1 text-[9px] text-gray-400 font-medium">
                {doc.workflowStatus === "closed"
                  ? "✓"
                  : doc.workflowStatus === "partial"
                    ? "(Part)"
                    : ""}
              </span>
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default DocumentTrailPanel;
