import React from 'react';

export const CompanyFeatures: React.FC = () => {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Company Features</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Enable or disable modules for your company</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md">Save Features</button>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <p className="text-[12px] text-gray-600">Company features configuration will be added here.</p>
      </div>
    </div>
  );
};
export default CompanyFeatures;
