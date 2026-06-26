import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { MenuDropdown } from './MenuDropdown';
import { useTopMenu } from '../../hooks/useTopMenu';

export const ImportMenu: React.FC = () => {
  const navigate = useNavigate();
  const { closeMenu } = useTopMenu();

  const handleNav = (path: string) => {
    navigate({ to: path as any });
    closeMenu();
  };

  return (
    <MenuDropdown id="import" label="Import" shortcut="Alt+O">
      <div className="flex flex-col">
        <button onClick={() => handleNav('/import-masters')} className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full">Masters</button>
        <button onClick={() => handleNav('/import-transactions')} className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full">Transactions</button>
        <button onClick={() => handleNav('/e-invoice')} className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full">E-Invoice</button>
        <button onClick={() => handleNav('/e-waybill')} className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full">E-Way Bill</button>
        <div className="border-t border-gray-100 my-1"></div>
        <button onClick={() => handleNav('/import-logs')} className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full">Import Logs</button>
      </div>
    </MenuDropdown>
  );
};
