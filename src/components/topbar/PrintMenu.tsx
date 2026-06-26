import React, { useContext } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { MenuDropdown } from './MenuDropdown';
import { useTopMenu } from '../../hooks/useTopMenu';
import { CurrentScreenContext } from '../../context/CurrentScreenContext';
import { printCurrentScreen } from '../../lib/printUtils';

export const PrintMenu: React.FC = () => {
  const navigate = useNavigate();
  const { closeMenu } = useTopMenu();
  const { canPrint, currentPage, getPrintData } = useContext(CurrentScreenContext);

  const handlePrint = async () => {
    if (!canPrint) return;
    try {
      await printCurrentScreen(currentPage, getPrintData);
    } catch (err) {
      alert('Print failed: ' + String(err));
    }
    closeMenu();
  };

  return (
    <MenuDropdown id="print" label="Print" shortcut="Alt+P">
      <div className="flex flex-col">
        <button
          onClick={handlePrint}
          disabled={!canPrint}
          className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Current Screen
        </button>
        <button
          disabled={!canPrint}
          className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Print Setup
        </button>
        <div className="border-t border-gray-100 my-1"></div>
        <button
          onClick={() => { navigate({ to: '/print-logs' as any }); closeMenu(); }}
          className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full"
        >
          Print Logs
        </button>
      </div>
    </MenuDropdown>
  );
};
