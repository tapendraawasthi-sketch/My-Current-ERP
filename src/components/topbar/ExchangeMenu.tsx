import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { MenuDropdown } from './MenuDropdown';
import { useTopMenu } from '../../hooks/useTopMenu';

export const ExchangeMenu: React.FC = () => {
  const navigate = useNavigate();
  const { closeMenu } = useTopMenu();

  const handleNav = (path: string) => {
    navigate({ to: path as any });
    closeMenu();
  };

  return (
    <MenuDropdown id="exchange" label="Exchange" shortcut="Alt+X">
      <div className="flex flex-col">
        <button onClick={() => handleNav('/exchange-sync')} className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full">Data Sync</button>
        <button onClick={() => handleNav('/exchange-sync')} className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full">Connection Settings</button>
      </div>
    </MenuDropdown>
  );
};
