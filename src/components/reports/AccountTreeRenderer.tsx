import React from "react";
import { getProfitDecimalPlaces } from "../../lib/utils";

export type ReportDepth = "summary" | "detailed" | "ultra_deep";

export interface ReportNode {
  id: string;
  name: string;
  code?: string;
  level: "group" | "subgroup" | "ledger";
  balance: number;
  isGroup: boolean;
  children: ReportNode[];
}

interface AccountTreeRendererProps {
  nodes: ReportNode[];
  depth: ReportDepth;
  creditNature?: boolean;
  indent?: number;
  // New optional props (Step 2)
  onNodeClick?: (node: ReportNode) => void;
  expandedIds?: Set<string>;
  onToggle?: (id: string) => void;
  // Optional alt balance map for prev-year comparison
  altBalanceMap?: Record<string, number>;
  showAltColumn?: boolean;
}

const depthLevels: Record<ReportDepth, number> = {
  summary: 0,
  detailed: 1,
  ultra_deep: 99,
};

function fmt(n: number): string {
  const dp = getProfitDecimalPlaces();
  return Math.abs(n).toLocaleString("en-IN", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

const AccountTreeRenderer: React.FC<AccountTreeRendererProps> = ({
  nodes,
  depth,
  creditNature = false,
  indent = 0,
  onNodeClick,
  expandedIds,
  onToggle,
  altBalanceMap,
  showAltColumn = false,
}) => {
  const maxDepth = depthLevels[depth];
  const useAccordion = expandedIds !== undefined;

  const renderNode = (
    node: ReportNode,
    currentIndent: number,
    depthLevel: number,
  ): React.ReactNode => {
    const hasChildren = node.isGroup || (node.children && node.children.length > 0);
    const isExpanded = useAccordion ? expandedIds!.has(node.id) : depthLevel < maxDepth;
    const isLedger = node.level === "ledger";
    const balance = node.balance ?? 0;
    const altBalance = altBalanceMap ? (altBalanceMap[node.id] ?? 0) : 0;

    const displayBalance = creditNature ? -balance : balance;
    const displayAlt = creditNature ? -altBalance : altBalance;

    const indentPx = currentIndent * 16;

    const rowClick = () => {
      if (onNodeClick) onNodeClick(node);
    };

    const chevronClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onToggle) onToggle(node.id);
    };

    // Determine row styling
    let rowCls = "border-b border-gray-100 ";
    if (isLedger && onNodeClick) {
      rowCls += "cursor-pointer hover:bg-[#e8f0fe] ";
    }
    if (node.level === "group") {
      rowCls += "bg-[#f5f6fa] font-semibold ";
    }

    const amtCls =
      "px-3 py-1.5 text-right font-mono text-[12px] " +
      (isLedger && onNodeClick ? "underline decoration-dotted " : "");

    return (
      <React.Fragment key={node.id}>
        <tr className={rowCls} onClick={rowClick}>
          {/* Name cell */}
          <td className="px-3 py-1.5 text-[12px] text-gray-700">
            <div className="flex items-center gap-1" style={{ paddingLeft: `${indentPx}px` }}>
              {hasChildren && (
                <button
                  className="text-gray-500 hover:text-[var(--ds-action-primary)] text-[10px] w-4 shrink-0 text-center"
                  onClick={chevronClick}
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? "▼" : "▶"}
                </button>
              )}
              {!hasChildren && <span className="w-4 shrink-0" />}
              <span className={node.level === "group" ? "font-semibold text-gray-800" : ""}>
                {node.name}
              </span>
              {node.code && <span className="text-gray-400 text-[10px] ml-1">{node.code}</span>}
            </div>
          </td>

          {/* Balance cell */}
          <td className={amtCls}>{displayBalance !== 0 ? fmt(displayBalance) : "—"}</td>

          {/* Alt (prev year) column */}
          {showAltColumn && (
            <td className="px-3 py-1.5 text-right font-mono text-[12px] text-gray-500">
              {displayAlt !== 0 ? fmt(displayAlt) : "—"}
            </td>
          )}
        </tr>

        {/* Children */}
        {isExpanded &&
          hasChildren &&
          node.children.map((child) => renderNode(child, currentIndent + 1, depthLevel + 1))}
      </React.Fragment>
    );
  };

  return (
    <>
      {showAltColumn && (
        <thead>
          <tr className="bg-[#f5f6fa] border-b border-gray-200">
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Account
            </th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Current
            </th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Prev Year
            </th>
          </tr>
        </thead>
      )}
      <tbody>{nodes.map((node) => renderNode(node, indent, 0))}</tbody>
    </>
  );
};

export default AccountTreeRenderer;
