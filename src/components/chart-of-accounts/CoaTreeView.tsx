import React from "react";
import {
  Search,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  BookOpen,
  Copy,
} from "lucide-react";
import type { AccountGroup, Ledger, TreeNode } from "./types";
import { CATEGORY_COLORS, CATEGORY_ORDER, fmt } from "./constants";

export interface CoaTreeViewProps {
  isSearchActive: boolean;
  displayRows: TreeNode[] | null;
  tree: Record<string, TreeNode[]>;
  expandedIds: Set<string>;
  selectedId: string | null;
  allGroups: AccountGroup[];
  onSelect: (id: string, isGroup: boolean, hasChildren: boolean) => void;
  onToggleExpand: (id: string) => void;
  onEditGroup: (group: AccountGroup) => void;
  onEditLedger: (ledger: Ledger) => void;
  onCopyGroup: (group: AccountGroup) => void;
  onCopyLedger: (ledger: Ledger) => void;
  onDeleteGroup: (group: AccountGroup) => void;
  onDeleteLedger: (ledger: Ledger) => void;
  getGroupBalance: (groupId: string) => number;
}

function categoryHeadingClass(cat: string): string {
  const map: Record<string, string> = {
    Assets: "report-section-heading report-section-heading-assets",
    Liabilities: "report-section-heading report-section-heading-liab",
    "Income/Revenue": "report-section-heading report-section-heading-income",
    Expenses: "report-section-heading report-section-heading-expense",
    "Capital/Equity": "report-section-heading report-section-heading-capital",
  };
  return map[cat] || "report-section-heading";
}

export const CoaTreeView: React.FC<CoaTreeViewProps> = ({
  isSearchActive,
  displayRows,
  tree,
  expandedIds,
  selectedId,
  allGroups,
  onSelect,
  onToggleExpand,
  onEditGroup,
  onEditLedger,
  onCopyGroup,
  onCopyLedger,
  onDeleteGroup,
  onDeleteLedger,
  getGroupBalance,
}) => {
  function renderTreeRow(item: TreeNode & { kind?: "group" | "ledger" }) {
    const isGroup = item.kind === "group";
    const isExpanded = expandedIds.has(item.id);
    const hasChildren =
      isGroup && ((item.children?.length ?? 0) > 0 || (item.ledgers?.length ?? 0) > 0);
    const color = CATEGORY_COLORS[item.category] || "var(--ds-action-primary)";
    const group = !isGroup ? allGroups.find((g) => g.id === item.groupId) : null;
    const nature = item.nature || group?.nature || "debit";
    const balance = isGroup ? getGroupBalance(item.id) : item.balance || 0;
    const isSelected = selectedId === item.id;
    const isSystem = item.isSystem;

    return (
      <React.Fragment key={item.id}>
        <tr
          onClick={() => onSelect(item.id, isGroup, !!hasChildren)}
          onDoubleClick={() =>
            isGroup ? onEditGroup(item as unknown as AccountGroup) : onEditLedger(item as unknown as Ledger)
          }
          className={`cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors ${isSelected ? "bg-blue-50" : ""}`}
        >
          <td className="px-2 py-1.5" style={{ paddingLeft: `${8 + (item.depth || 0) * 18}px` }}>
            <div className="flex items-center gap-1.5">
              {isGroup && hasChildren ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand(item.id);
                  }}
                  className="p-0.5 rounded text-gray-400 hover:text-gray-600"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : (
                <span className="w-4 shrink-0" />
              )}

              {isGroup ? (
                <FolderOpen className="h-3.5 w-3.5 shrink-0" style={{ color }} />
              ) : (
                <BookOpen className="h-3 w-3 shrink-0 text-gray-400" />
              )}

              <span
                className={`text-[12px] ${isGroup ? "font-semibold" : "font-medium"} text-gray-700 truncate max-w-[280px]`}
              >
                {item.name}
              </span>
              {item.alias && <span className="text-[12px] text-gray-400 ml-1">({item.alias})</span>}
              {isSystem && <span className="badge badge-info ml-1">SYS</span>}
              {isGroup && item.isPrimary && <span className="badge ml-1">PRIMARY</span>}
            </div>
          </td>

          <td className="px-3 py-1.5 text-[12px] text-gray-500 max-w-[160px] truncate">
            {isGroup
              ? item.isPrimary
                ? item.category
                : allGroups.find((g) => g.id === item.parentId)?.name || "—"
              : group?.name || "—"}
          </td>

          <td className="px-3 py-1.5">
            {!isGroup && (
              <span
                className={`px-1.5 py-0.5 text-[12px] font-semibold rounded ${
                  item.accountType === "Bank"
                    ? "bg-blue-100 text-blue-700"
                    : item.accountType === "Cash"
                      ? "bg-green-100 text-green-700"
                      : item.accountType === "Party"
                        ? "bg-[var(--ds-status-info-surface)] text-[var(--ds-status-info)]"
                        : "bg-gray-100 text-gray-600"
                }`}
              >
                {item.accountType}
              </span>
            )}
          </td>

          <td className="px-3 py-1.5">
            <span
              className={`text-[12px] font-bold ${nature === "credit" ? "text-green-600" : "text-blue-600"}`}
            >
              {nature === "credit" ? "Cr" : "Dr"}
            </span>
          </td>

          <td className={`px-3 py-1.5 ${isGroup ? "number-cell-bold" : "number-cell"}`}>
            {balance !== 0 ? fmt(balance) : "—"}
          </td>

          <td className="px-3 py-1.5 text-[12px] text-gray-500 font-mono">
            {!isGroup && item.gstin ? item.gstin.slice(0, 15) : ""}
          </td>

          <td className="px-2 py-1.5 text-right">
            <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  isGroup
                    ? onEditGroup(item as unknown as AccountGroup)
                    : onEditLedger(item as unknown as Ledger);
                }}
                className="p-1 rounded text-gray-400 hover:text-[var(--ds-action-primary)] hover:bg-blue-50"
              >
                <Edit2 className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  isGroup
                    ? onCopyGroup(item as unknown as AccountGroup)
                    : onCopyLedger(item as unknown as Ledger);
                }}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <Copy className="h-3 w-3" />
              </button>
              {!isSystem && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    isGroup
                      ? onDeleteGroup(item as unknown as AccountGroup)
                      : onDeleteLedger(item as unknown as Ledger);
                  }}
                  className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </td>
        </tr>
      </React.Fragment>
    );
  }

  function renderCategorySection(cat: string, nodes: TreeNode[]) {
    const catBalance = nodes.reduce((s, n) => s + getGroupBalance(n.id), 0);
    return (
      <React.Fragment key={cat}>
        <tr>
          <td colSpan={7} className={categoryHeadingClass(cat)}>
            <div className="flex items-center justify-between">
              <span>{cat}</span>
              {catBalance !== 0 && <span className="number-cell-bold">{fmt(catBalance)}</span>}
            </div>
          </td>
        </tr>
        {nodes.map((n) => renderGroupNode(n))}
      </React.Fragment>
    );
  }

  function renderGroupNode(node: TreeNode): React.ReactNode {
    const isExpanded = expandedIds.has(node.id);
    const rows: React.ReactNode[] = [renderTreeRow({ ...node, kind: "group" })];
    if (isExpanded) {
      node.ledgers?.forEach((l) => {
        rows.push(renderTreeRow({ ...l, kind: "ledger", depth: (node.depth || 0) + 1 }));
      });
      node.children?.forEach((child) => {
        rows.push(...(renderGroupNode(child) as React.ReactNode[]));
      });
    }
    return rows;
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-[12px] border-collapse">
        <thead className="sticky top-0 bg-gray-50 z-10">
          <tr className="border-b-2 border-gray-200">
            <th className="px-3 py-2 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              Account Name / Group
            </th>
            <th className="px-3 py-2 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              Under / Category
            </th>
            <th className="px-3 py-2 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              Type
            </th>
            <th className="px-3 py-2 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              Nature
            </th>
            <th className="px-3 py-2 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              Balance
            </th>
            <th className="px-3 py-2 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              GSTIN
            </th>
            <th className="px-3 py-2 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-20">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {isSearchActive
            ? displayRows!.map((item) => renderTreeRow(item))
            : CATEGORY_ORDER.map((cat) => {
                const nodes = tree[cat];
                if (!nodes?.length) return null;
                return renderCategorySection(cat, nodes);
              })}
          {isSearchActive && displayRows!.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center py-12 text-[12px] text-gray-500">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No accounts match your search.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
