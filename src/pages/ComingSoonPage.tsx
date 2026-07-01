import React from "react";
import { Construction } from "lucide-react";

const ComingSoonPage: React.FC<{ pageKey: string }> = ({ pageKey }) => (
  <div className="p-6 flex items-center justify-center min-h-[60vh]">
    <div className="text-center max-w-md">
      <Construction className="h-10 w-10 text-gray-400 mx-auto mb-3" />
      <h2 className="text-[15px] font-semibold text-gray-800">
        {pageKey.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
      </h2>
      <p className="text-[11px] text-gray-500 mt-1">
        This module is not yet implemented. Contact your administrator if you need this feature
        prioritized.
      </p>
    </div>
  </div>
);

export default ComingSoonPage;
