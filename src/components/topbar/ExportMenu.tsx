import React, { useContext } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { MenuDropdown } from './MenuDropdown';
import { useTopMenu } from '../../hooks/useTopMenu';
import { CurrentScreenContext } from '../../context/CurrentScreenContext';
import { exportCurrentScreen } from '../../lib/exportUtils';

export const ExportMenu: React.FC = () => {
  const navigate = useNavigate();
  const { closeMenu } = useTopMenu();
  const { canExport, currentPage, getExportData } = useContext(CurrentScreenContext);

  const handleExport = async (format: 'excel' | 'pdf' | 'json' | 'csv' | 'xml') => {
    if (!canExport) return;
    try {
      await exportCurrentScreen(format, currentPage, getExportData);
    } catch (err) {
      alert('Export failed: ' + String(err));
    }
    closeMenu();
  };

  return (
    <MenuDropdown id="export" label="Export" shortcut="Alt+E">
      <div className="flex flex-col">
        <button
          onClick={() => handleExport('excel')}
          disabled={!canExport}
          className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Current (Excel)
        </button>
        <button
          onClick={() => handleExport('pdf')}
          disabled={!canExport}
          className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Current (PDF)
        </button>
        <button
          onClick={() => handleExport('json')}
          disabled={!canExport}
          className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Current (JSON)
        </button>
        <button
          onClick={() => handleExport('xml')}
          disabled={!canExport}
          className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Current (XML)
        </button>
        <div className="border-t border-gray-100 my-1"></div>
        <button
          onClick={() => { navigate({ to: '/export-logs' as any }); closeMenu(); }}
          className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full"
        >
          Export Logs
        </button>
      </div>
    </MenuDropdown>
  );
};
