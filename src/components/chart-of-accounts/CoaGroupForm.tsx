import React from "react";
import { Lock, Trash2, Copy, Save } from "lucide-react";
import type { AccountGroup } from "./types";
import { inputCls, labelCls } from "./constants";

export interface CoaGroupFormProps {
  mode: "add" | "edit";
  gForm: Partial<AccountGroup>;
  gErrors: Record<string, string>;
  editingGroupId: string | null;
  allGroups: AccountGroup[];
  onChange: React.Dispatch<React.SetStateAction<Partial<AccountGroup>>>;
  onSave: (andNew?: boolean) => void;
  onCancel: () => void;
  onDelete: (group: AccountGroup) => void;
  onCopy: (group: AccountGroup) => void;
}

export const CoaGroupForm: React.FC<CoaGroupFormProps> = ({
  mode,
  gForm,
  gErrors,
  editingGroupId,
  allGroups,
  onChange,
  onSave,
  onCancel,
  onDelete,
  onCopy,
}) => {
  const isEdit = mode === "edit";
  const editGroup =
    isEdit && editingGroupId ? allGroups.find((g) => g.id === editingGroupId) : null;
  const isSystemGroup = editGroup?.isSystem;

  return (
      <div className="p-4 max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-bold text-gray-800">
            {isEdit ? `Modify Group â€” ${editGroup?.name}` : "Add Account Group"}
          </h2>
          <div className="text-[12px] text-gray-500">F2=Save Â· Esc=Cancel</div>
        </div>

        {isSystemGroup && (
          <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded text-[12px] text-amber-800 flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            System group â€” limited editing allowed
          </div>
        )}

        <div className="flex flex-col gap-3">
          {/* Name */}
          <div>
            <label className={labelCls}>
              Group Name <span className="text-red-500">*</span>
            </label>
            <input
              value={gForm.name || ""}
              onChange={(e) => onChange((p) => ({ ...p, name: e.target.value }))}
              disabled={isSystemGroup}
              className={`${inputCls} ${gErrors.name ? "border-red-400" : ""} ${isSystemGroup ? "bg-gray-50 cursor-not-allowed" : ""}`}
              placeholder="e.g. Office Equipment"
            />
            {gErrors.name && <p className="text-[12px] text-red-600 mt-0.5">{gErrors.name}</p>}
          </div>

          {/* Alias */}
          <div>
            <label className={labelCls}>Alias / Short Name (optional)</label>
            <input
              value={gForm.alias || ""}
              onChange={(e) => onChange((p) => ({ ...p, alias: e.target.value }))}
              disabled={isSystemGroup}
              className={`${inputCls} ${isSystemGroup ? "bg-gray-50 cursor-not-allowed" : ""}`}
              placeholder="e.g. OffEq"
            />
          </div>

          {/* Primary Group toggle */}
          {!isSystemGroup && (
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <label className="text-[12px] font-medium text-gray-700 mb-2 block">
                Is Primary Group?
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onChange((p) => ({ ...p, isPrimary: true, parentId: undefined }))}
                  className={`flex-1 h-8 text-[12px] font-semibold rounded border transition-colors ${gForm.isPrimary ? "bg-[var(--ds-action-primary)] text-white border-[var(--ds-action-primary)]" : "bg-white text-gray-700 border-[var(--ds-border-default)] hover:bg-gray-50"}`}
                >
                  Y (Top Level)
                </button>
                <button
                  type="button"
                  onClick={() => onChange((p) => ({ ...p, isPrimary: false }))}
                  className={`flex-1 h-8 text-[12px] font-semibold rounded border transition-colors ${!gForm.isPrimary ? "bg-[var(--ds-action-primary)] text-white border-[var(--ds-action-primary)]" : "bg-white text-gray-700 border-[var(--ds-border-default)] hover:bg-gray-50"}`}
                >
                  N (Sub-Group)
                </button>
              </div>
              <p className="text-[12px] text-gray-500 mt-1">
                Primary = Top-level. Non-primary = Sub-group under an existing group.
              </p>
            </div>
          )}

          {/* Under Group */}
          {!gForm.isPrimary && !isSystemGroup && (
            <div>
              <label className={labelCls}>
                Under Group <span className="text-red-500">*</span>
              </label>
              <select
                value={gForm.parentId || ""}
                onChange={(e) => {
                  const pg = allGroups.find((g) => g.id === e.target.value);
                  onChange((p) => ({
                    ...p,
                    parentId: e.target.value,
                    nature: pg?.nature || p.nature,
                    category: pg?.category || p.category,
                  }));
                }}
                className={`${inputCls} ${gErrors.parentId ? "border-red-400" : ""}`}
              >
                <option value="">â€” Select Parent Group â€”</option>
                {allGroups
                  .filter((g) => g.id !== editingGroupId)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.isPrimary ? g.name : `  ${g.name}`} {g.isSystem ? "(System)" : ""}
                    </option>
                  ))}
              </select>
              {gErrors.parentId && (
                <p className="text-[12px] text-red-600 mt-0.5">{gErrors.parentId}</p>
              )}
            </div>
          )}

          {/* Nature */}
          {!isSystemGroup && (
            <div>
              <label className={labelCls}>Nature</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onChange((p) => ({ ...p, nature: "debit" }))}
                  className={`flex-1 h-8 text-[12px] font-semibold rounded border ${gForm.nature === "debit" ? "bg-[var(--ds-action-primary)] text-white border-[var(--ds-action-primary)]" : "bg-white text-gray-700 border-[var(--ds-border-default)]"}`}
                >
                  Debit (Assets/Expenses)
                </button>
                <button
                  type="button"
                  onClick={() => onChange((p) => ({ ...p, nature: "credit" }))}
                  className={`flex-1 h-8 text-[12px] font-semibold rounded border ${gForm.nature === "credit" ? "bg-[var(--ds-action-primary)] text-white border-[var(--ds-action-primary)]" : "bg-white text-gray-700 border-[var(--ds-border-default)]"}`}
                >
                  Credit (Liabilities/Income)
                </button>
              </div>
            </div>
          )}

          {/* Narration */}
          <div>
            <label className={labelCls}>Narration / Description (optional)</label>
            <textarea
              value={gForm.narration || ""}
              onChange={(e) => onChange((p) => ({ ...p, narration: e.target.value }))}
              rows={2}
              className="w-full px-2.5 py-1.5 text-[12px] border border-[var(--ds-border-default)] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[var(--ds-action-primary)] resize-none"
              placeholder="Internal description..."
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <div className="flex gap-2">
              {isEdit && !isSystemGroup && (
                <button
                  onClick={() => editGroup && onDelete(editGroup)}
                  className="h-8 px-3 bg-red-600 text-white text-[12px] font-medium rounded hover:bg-red-700 flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete (F8)
                </button>
              )}
              {editGroup && (
                <button
                  onClick={() => onCopy(editGroup)}
                  className="h-8 px-3 bg-white border border-[var(--ds-border-default)] text-gray-700 text-[12px] rounded hover:bg-gray-50 flex items-center gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy (F12)
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onCancel()}
                className="h-8 px-3 bg-white border border-[var(--ds-border-default)] text-gray-700 text-[12px] rounded hover:bg-gray-50"
              >
                Cancel (Esc)
              </button>
              {!isSystemGroup && (
                <>
                  <button
                    onClick={() => onSave(true)}
                    className="h-8 px-3 bg-gray-100 border border-[var(--ds-border-default)] text-gray-700 text-[12px] rounded hover:bg-gray-200"
                  >
                    Save & New
                  </button>
                  <button
                    onClick={() => onSave(false)}
                    className="h-8 px-3 bg-[var(--ds-action-primary)] text-white text-[12px] font-medium rounded hover:bg-[var(--ds-action-primary-hover)] flex items-center gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" /> Save (F2)
                  </button>
                </>
              )}
              {isSystemGroup && (
                <button
                  onClick={() => onCancel()}
                  className="h-8 px-3 bg-[var(--ds-action-primary)] text-white text-[12px] rounded"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );

};
