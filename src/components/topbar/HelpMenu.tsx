import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { MenuDropdown } from './MenuDropdown';
import { useTopMenu } from '../../hooks/useTopMenu';
import { useStore } from '../../store/useStore';

export const HelpMenu: React.FC = () => {
  const navigate = useNavigate();
  const { closeMenu } = useTopMenu();
  const { showHelp } = useStore();

  const handleNav = (path: string) => {
    navigate({ to: path as any });
    closeMenu();
  };

  return (
    <MenuDropdown id="help" label="Help" shortcut="Alt+H">
      <div className="flex flex-col">
        <button onClick={() => alert('Opening user manual')} className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full">Local Help</button>
        <button onClick={() => window.open('https://help.sutraerp.com')} className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full">Web Help</button>
        <button onClick={() => alert('Show shortcuts')} className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full">Keyboard Shortcuts (Ctrl+?)</button>
        <div className="border-t border-gray-100 my-1"></div>
        <button onClick={() => handleNav('/troubleshoot')} className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full">Troubleshooting</button>
      </div>
    </MenuDropdown>
  );
};
