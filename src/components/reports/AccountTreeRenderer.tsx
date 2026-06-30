import React from "react";
import { formatNumber } from "../../lib/utils";
import type { ReportDepth } from "./ReportShell";

export interface ReportNode {
  id: string;
  name: string;
  code?: string;
  level: "group" | "subgroup" | "ledger";
  balance: number;         // net signed balance
  isGroup: boolean;
  children: ReportNode[];
}

interface Props {
  nodes: ReportNode[];
  depth: ReportDepth;
  /** If true, show credit nature amounts as positive (Liability / Equity / Income) */
  creditNature?: boolean;
  indent?: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

const AccountTreeRenderer: React.FC<Props> = ({
  nodes,
  depth,
  creditNature = false,
  indent = 0,
}) => {
  if (!nodes || nodes.length === 0) return null;

  return (
    <>
      {nodes.map(node => {
        const bal = r2(node.balance);
        const absAmt = Math.abs(bal);
        const sign = creditNature ? (bal < 0 ? " Dr" : "") : (bal < 0 ? " Cr" : "");

        // In SUMMARY mode: only show group-level rows
        if (depth === "summary" && node.level !== "group") return null;

        // In DETAILED: show groups and subgroups (even zero balance), not ledger level
        if (depth === "detailed" && node.level === "ledger") return null;

        // In ULTRA_DEEP: show groups and subgroups always, ledgers only if non-zero
        if (depth === "ultra_deep" && node.level === "ledger" && bal === 0) return null;

        const isGroupRow = node.level === "group";
        const isSubgroupRow = node.level === "subgroup";

        const rowBg = isGroupRow
          ? "bg-[#e8f0fe]"
          : isSubgroupRow
          ? "bg-[#f5f6fa]"
          : "bg-white";

        const textStyle = isGroupRow
          ? "font-bold text-[#1557b0] text-[12px]"
          : isSubgroupRow
          ? "font-semibold text-gray-700 text-[12px]"
          : "text-gray-600 text-[12px]";

        const amtStyle = isGroupRow
          ? "font-bold text-[12px] font-mono"
          : "text-[12px] font-mono text-gray-700";

        const paddingLeft = 12 + indent * 18;

        return (
          <React.Fragment key={node.id}>
            <tr className={`${rowBg} border-b border-gray-100`}>
              <td
                className={`py-2 pr-3 ${textStyle}`}
                style={{ paddingLeft }}
              >
                {isGroupRow && (
                  <span className="text-[10px] text-gray-400 font-mono mr-1">
                    {node.code || ""}
                  </span>
                )}
                {node.name}
              </td>
              <td className={`py-2 px-3 text-right ${amtStyle}`}>
                {absAmt === 0 && !isGroupRow
                  ? <span className="text-gray-300">—</span>
                  : `Rs. ${formatNumber(absAmt)}${sign}`
                }
              </td>
            </tr>

            {/* Recurse into children */}
            {node.children && node.children.length > 0 && (
              <AccountTreeRenderer
                nodes={node.children}
                depth={depth}
                creditNature={creditNature}
                indent={indent + 1}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};

export default AccountTreeRenderer;
