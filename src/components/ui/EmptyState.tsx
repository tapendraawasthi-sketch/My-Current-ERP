/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center py-16 text-center px-4">
    {Icon && (
      <div className="h-14 w-14 rounded-full bg-[#EBF5E2] flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-[#000000]" />
      </div>
    )}
    <p className="text-[13px] font-bold text-[#000000] mb-1">{title}</p>
    {description && <p className="text-[11px] text-[#000000] max-w-xs">{description}</p>}
    {action && (
      <button
        type="button"
        onClick={action.onClick}
        className="mt-4 h-8 px-4 text-[12px] font-semibold text-[#000000] rounded-md transition-colors"
        style={{ background: "#3D6B25" }}
      >
        {action.label}
      </button>
    )}
  </div>
);

export default EmptyState;
