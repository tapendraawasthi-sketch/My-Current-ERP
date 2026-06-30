import React from "react";

export interface ActionToolbarProps {
  onSave?: () => void;
  onPost?: () => void;
  onCancel?: () => void;
  onPrint?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  saveLabel?: string;
  postLabel?: string;
  cancelLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  showPost?: boolean;
  showDelete?: boolean;
  showDuplicate?: boolean;
  showPrint?: boolean;
  /** Extra action elements (Fix BUG-021: children prop was missing) */
  children?: React.ReactNode;
  className?: string;
}

const ActionToolbar: React.FC<ActionToolbarProps> = ({
  onSave,
  onPost,
  onCancel,
  onPrint,
  onDelete,
  onDuplicate,
  saveLabel = "Save Draft",
  postLabel = "Post",
  cancelLabel = "Cancel",
  disabled = false,
  loading = false,
  showPost = true,
  showDelete = false,
  showDuplicate = false,
  showPrint = false,
  children,
  className = "",
}) => {
  const btnBase = "h-8 px-3 text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled || loading}
          className={`${btnBase} bg-white border border-gray-300 text-gray-700 hover:bg-gray-50`}
        >
          {cancelLabel}
        </button>
      )}

      {showDelete && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled || loading}
          className={`${btnBase} bg-white border border-red-300 text-red-600 hover:bg-red-50`}
        >
          Delete
        </button>
      )}

      {showDuplicate && onDuplicate && (
        <button
          type="button"
          onClick={onDuplicate}
          disabled={disabled || loading}
          className={`${btnBase} bg-white border border-gray-300 text-gray-700 hover:bg-gray-50`}
        >
          Duplicate
        </button>
      )}

      {showPrint && onPrint && (
        <button
          type="button"
          onClick={onPrint}
          disabled={disabled || loading}
          className={`${btnBase} bg-white border border-gray-300 text-gray-700 hover:bg-gray-50`}
        >
          Print
        </button>
      )}

      {/* Extra custom actions — Fix BUG-021 */}
      {children}

      {onSave && (
        <button
          type="button"
          onClick={onSave}
          disabled={disabled || loading}
          className={`${btnBase} bg-white border border-[#1557b0] text-[#1557b0] hover:bg-[#e8f0fe]`}
        >
          {loading ? "Saving…" : saveLabel}
        </button>
      )}

      {showPost && onPost && (
        <button
          type="button"
          onClick={onPost}
          disabled={disabled || loading}
          className={`${btnBase} bg-[#1557b0] hover:bg-[#0f4a96] text-white border border-[#1557b0]`}
        >
          {loading ? "Posting…" : postLabel}
        </button>
      )}
    </div>
  );
};

export default ActionToolbar;
