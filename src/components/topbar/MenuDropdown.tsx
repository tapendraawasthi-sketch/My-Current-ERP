import React, { useRef, useEffect } from 'react';
import { useTopMenu } from '../../hooks/useTopMenu';

interface MenuDropdownProps {
  id: string;
  label: string;
  shortcut: string;
  children: React.ReactNode;
}

export const MenuDropdown: React.FC<MenuDropdownProps> = ({ id, label, shortcut, children }) => {
  const { activeTopMenu, toggleMenu, closeMenu } = useTopMenu();
  const isOpen = activeTopMenu === id;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closeMenu]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => toggleMenu(id)}
        className={`px-3 py-1.5 text-[12px] font-medium transition-colors rounded ${
          isOpen ? 'bg-[#273148] text-white' : 'text-gray-300 hover:bg-[#273148] hover:text-white'
        }`}
        title={`Shortcut: ${shortcut}`}
      >
        <span className="underline decoration-1 underline-offset-2">{label.charAt(0)}</span>
        {label.slice(1)}
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-64 bg-white rounded-md shadow-xl border border-gray-200 py-1 z-50">
          {children}
        </div>
      )}
    </div>
  );
};
