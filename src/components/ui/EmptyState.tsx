import React from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title = "No records found",
  description = "There is no data to display here yet.",
  actionLabel,
  onAction,
}) => (
  <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
    <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
      <Icon className="h-6 w-6 text-gray-400" />
    </div>
    <p className="text-[13px] font-medium text-gray-700">{title}</p>
    <p className="text-[12px] text-gray-500 mt-1 max-w-xs">{description}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-4 h-8 px-4 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md transition-colors"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export default EmptyState;
