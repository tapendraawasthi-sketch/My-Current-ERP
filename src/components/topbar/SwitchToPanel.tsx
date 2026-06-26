import React, { useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';

export const SwitchToPanel: React.FC = () => {
  const { switchToOpen, setSwitchToOpen, companySettings } = useStore();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (switchToOpen && panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setSwitchToOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [switchToOpen, setSwitchToOpen]);

  if (!switchToOpen) return null;

  return (
    <div ref={panelRef} className="absolute top-12 left-4 w-80 bg-white rounded-md shadow-2xl border border-gray-200 z-50 p-4">
      <h3 className="text-[12px] font-semibold text-gray-800 mb-2">Switch Context (Ctrl+G)</h3>
      <div className="text-[12px] text-gray-600 mb-4">
        Current Company: <strong>{companySettings?.name || 'None'}</strong>
      </div>
      <div className="flex flex-col gap-2">
        <button className="text-left px-3 py-2 text-[12px] border border-gray-200 rounded hover:bg-[#f5f6fa]">
          Switch Company
        </button>
        <button className="text-left px-3 py-2 text-[12px] border border-gray-200 rounded hover:bg-[#f5f6fa]">
          Switch Financial Year
        </button>
      </div>
    </div>
  );
};
