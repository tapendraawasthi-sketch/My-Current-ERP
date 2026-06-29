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
    <div className="bg-white border border-gray-200 rounded-md p-3">
      <h3 className="text-[12px] font-semibold text-gray-800 mb-2">Document Trail</h3>

      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        {trail.map((doc, index) => (
          <React.Fragment key={doc.id}>
            {index > 0 && <span className="text-gray-400">→</span>}

            <button
              type="button"
              onClick={() => onOpen?.(doc.id)}
              className="px-2 py-1 border border-gray-300 rounded bg-gray-50 hover:bg-yellow-50"
            >
              <span className="font-mono">{docNo(doc)}</span>
              <span className="ml-1 text-[10px] text-gray-500">
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
