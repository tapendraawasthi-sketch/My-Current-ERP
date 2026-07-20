import React from "react";
import {
  Plus,
  Search,
  Download,
  Copy,
  Settings,
} from "lucide-react";
import type { AccountGroup } from "./types";
import { ACCOUNT_TYPES } from "./constants";

export interface CoaToolbarProps {
  allGroups: AccountGroup[];
  allLedgersCount: number;
  clipboardItem: { data: { name: string } } | null;
  onPaste: () => void;
  onOpenFeatures: () => void;
  onOpenMasterConfig: () => void;
  onExport: () => void;
  onAddGroup: () => void;
  onAddLedger: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterGroup: string;
  onFilterGroupChange: (value: string) => void;
  filterType: string;
  onFilterTypeChange: (value: string) => void;
  isSearchActive: boolean;
  onClearFilters: () => void;
}

export const CoaToolbar: React.FC<CoaToolbarProps> = ({
  allGroups,
  allLedgersCount,
  clipboardItem,
  onPaste,
  onOpenFeatures,
  onOpenMasterConfig,
  onExport,
  onAddGroup,
  onAddLedger,
  searchTerm,
  onSearchChange,
  filterGroup,
  onFilterGroupChange,
  filterType,
  onFilterTypeChange,
  isSearchActive,
  onClearFilters,
}) => (
  <>
    <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200">
      <div>
        <h1 className="text-[15px] font-semibold text-gray-900">Account list</h1>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {allGroups.length} groups · {allLedgersCount} ledgers
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {clipboardItem && (
          <button
            onClick={onPaste}
            className="h-8 px-3 bg-amber-50 border border-amber-300 text-amber-700 text-[12px] font-medium rounded-md flex items-center gap-1 hover:bg-amber-100"
          >
            <Copy className="h-3 w-3" /> Paste ({clipboardItem.data.name.slice(0, 15)})
          </button>
        )}
        <button
          onClick={onOpenFeatures}
          className="h-8 px-3 bg-white border border-gray-200 text-gray-700 text-[12px] font-medium rounded-md flex items-center gap-1 hover:bg-gray-50 transition-colors"
        >
          <Settings className="h-3.5 w-3.5" /> Features
        </button>
        <button
          onClick={onOpenMasterConfig}
          className="h-8 px-3 bg-white border border-gray-200 text-gray-700 text-[12px] font-medium rounded-md flex items-center gap-1 hover:bg-gray-50 transition-colors"
        >
          <Settings className="h-3.5 w-3.5" /> Master Config
        </button>
        <button
          onClick={onExport}
          className="h-8 px-3 bg-white border border-gray-200 text-gray-700 text-[12px] font-medium rounded-md flex items-center gap-1 hover:bg-gray-50 transition-colors"
        >
          <Download className="h-3.5 w-3.5" /> Export
        </button>
        <button
          onClick={onAddGroup}
          className="h-8 px-3 bg-white border border-gray-200 text-gray-700 text-[12px] font-medium rounded-md flex items-center gap-1 hover:bg-gray-50 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add Group (F3)
        </button>
        <button
          onClick={onAddLedger}
          className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-lg flex items-center gap-1 shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" /> Add Ledger
        </button>
      </div>
    </div>

    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200">
      <div className="relative flex-1 max-w-xs">
        <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, alias, GSTIN..."
          className="h-8 pl-8 pr-3 text-[12px] border border-gray-200 rounded-lg bg-white w-full focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
        />
      </div>
      <select
        value={filterGroup}
        onChange={(e) => onFilterGroupChange(e.target.value)}
        className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
      >
        <option value="ALL">All Groups</option>
        {allGroups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.isPrimary ? g.name : `  ${g.name}`}
          </option>
        ))}
      </select>
      <select
        value={filterType}
        onChange={(e) => onFilterTypeChange(e.target.value)}
        className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
      >
        <option value="ALL">All Types</option>
        <option value="group">Groups Only</option>
        {ACCOUNT_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {isSearchActive && (
        <button
          onClick={onClearFilters}
          className="h-7 px-3 text-[12px] text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition-colors"
        >
          Clear Filters
        </button>
      )}
      <div className="ml-auto flex items-center gap-2 text-[11px] text-gray-300">
        <span>F3=Add Ledger · DblClick=Edit · F8=Delete</span>
      </div>
    </div>
  </>
);
