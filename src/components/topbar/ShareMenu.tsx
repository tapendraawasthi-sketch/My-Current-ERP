import React, { useContext } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { MenuDropdown } from './MenuDropdown';
import { useTopMenu } from '../../hooks/useTopMenu';
import { CurrentScreenContext } from '../../context/CurrentScreenContext';
import { generateWhatsAppLink, generateShareEmailSubject, generateShareEmailBody } from '../../lib/emailUtils';

export const ShareMenu: React.FC = () => {
  const navigate = useNavigate();
  const { closeMenu } = useTopMenu();
  const { canShare, currentPage } = useContext(CurrentScreenContext);

  const handleEmail = () => {
    if (!canShare) return;
    alert('Email sharing triggered for ' + currentPage);
    closeMenu();
  };

  const handleWhatsApp = () => {
    if (!canShare) return;
    alert('WhatsApp sharing triggered for ' + currentPage);
    closeMenu();
  };

  const handleLink = () => {
    if (!canShare) return;
    alert('Share link generated for ' + currentPage);
    closeMenu();
  };

  return (
    <MenuDropdown id="share" label="Share" shortcut="Alt+S">
      <div className="flex flex-col">
        <button
          onClick={handleEmail}
          disabled={!canShare}
          className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Current (Email)
        </button>
        <button
          onClick={handleWhatsApp}
          disabled={!canShare}
          className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Current (WhatsApp)
        </button>
        <button
          onClick={handleLink}
          disabled={!canShare}
          className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Generate Link
        </button>
        <div className="border-t border-gray-100 my-1"></div>
        <button
          onClick={() => { navigate({ to: '/share-history' as any }); closeMenu(); }}
          className="text-left px-4 py-1.5 text-[12px] text-gray-700 hover:bg-[#f5f6fa] hover:text-[#1557b0] w-full"
        >
          Share History
        </button>
      </div>
    </MenuDropdown>
  );
};
