import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { MenuDropdown } from './MenuDropdown';
import { useTopMenu } from '../../hooks/useTopMenu';

export const CompanyMenu: React.FC = () => {
  const navigate = useNavigate();
  const { closeMenu } = useTopMenu();

  const handleNav = (path: string) => {
    navigate({ to: path as any });
    closeMenu();
  };

  return (
    <MenuDropdown id="company" label="Company" shortcut="Alt+K">
      <div className="flex flex-col">
        <button onClick={() => handleNav('/settings')} className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full">Select Company</button>
        <button onClick={() => handleNav('/company-features')} className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full">Features & Modules</button>
        <button onClick={() => handleNav('/license-management')} className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full">License Management</button>
        <div className="border-t border-gray-100 my-1"></div>
        <button onClick={() => handleNav('/users')} className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full">Security & Users</button>
        <button onClick={() => handleNav('/data-encryption')} className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full">Data Encryption</button>
      </div>
    </MenuDropdown>
  );
};
