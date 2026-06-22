import React, { ReactNode } from "react";
import { FileSearch } from "lucide-react";

interface ReportEmptyStateProps {
  message?: string;
  icon?: ReactNode;
}

export const ReportEmptyState: React.FC<ReportEmptyStateProps> = ({
  message = "Select filters and click Generate to view report",
  icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="text-gray-400 dark:text-gray-600 mb-4">
        {icon || <FileSearch className="w-16 h-16" />}
      </div>
      <p className="text-gray-600 dark:text-gray-400 text-center text-lg">{message}</p>
    </div>
  );
};
