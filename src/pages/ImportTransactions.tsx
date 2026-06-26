import React from 'react';

export const ImportTransactions: React.FC = () => {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Import Transactions</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Import vouchers and invoices from Excel/CSV</p>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <p className="text-[12px] text-gray-600">Import wizard will be added here.</p>
      </div>
    </div>
  );
};
export default ImportTransactions;
