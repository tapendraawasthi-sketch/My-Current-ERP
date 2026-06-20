import React from "react";

const PageLoader: React.FC<{ rows?: number }> = ({ rows = 8 }) => (
  <div className="flex flex-col gap-3 p-4 animate-pulse">
    <div className="h-10 bg-gray-100 rounded-lg w-full" />
    <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
      <div className="h-9 bg-gray-100 w-full border-b border-gray-100" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`flex items-center gap-4 px-4 py-2.5 border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
          <div className="h-4 bg-gray-100 rounded w-16" />
          <div className="h-4 bg-gray-100 rounded flex-1" />
          <div className="h-4 bg-gray-100 rounded w-24" />
          <div className="h-4 bg-gray-100 rounded w-20" />
          <div className="h-4 bg-gray-100 rounded w-16" />
        </div>
      ))}
    </div>
  </div>
);

export default PageLoader;
