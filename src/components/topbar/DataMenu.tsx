import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { MenuDropdown } from './MenuDropdown';
import { useTopMenu } from '../../hooks/useTopMenu';

export const DataMenu: React.FC = () => {
  const navigate = useNavigate();
  const { closeMenu } = useTopMenu();

  const handleNav = (path: string) => {
    navigate({ to: path as any });
    closeMenu();
  };

  return (
    <MenuDropdown id="data" label="Data" shortcut="Alt+Y">
      <div className="flex flex-col">
        <button onClick={() => handleNav('/backup')} className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full">Backup/Restore</button>
        <button onClick={() => handleNav('/cloud-backup-settings')} className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full">Cloud Backup</button>
        <div className="border-t border-gray-100 my-1"></div>
        <button onClick={() => handleNav('/data-migration')} className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full">Data Migration</button>
        <button onClick={() => handleNav('/split-company-data')} className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full">Split Company Data</button>
        <div className="border-t border-gray-100 my-1"></div>
        <button onClick={() => handleNav('/data-repair')} className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full text-red-600">Repair Data</button>
      </div>
    </MenuDropdown>
  );
};
