import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useGlobalSearch } from '../../hooks/useGlobalSearch';

export const GoToPanel: React.FC = () => {
  const navigate = useNavigate();
  const { gotoOpen, setGotoOpen } = useStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { results, isSearching } = useGlobalSearch(query);

  useEffect(() => {
    if (gotoOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [gotoOpen]);

  if (!gotoOpen) return null;

  const handleClose = () => setGotoOpen(false);

  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[500px] bg-white rounded-md shadow-2xl border border-gray-200 z-50">
      <div className="flex items-center px-4 py-2 border-b border-gray-200">
        <Search size={16} className="text-gray-400 mr-2" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Go to page, voucher, account... (Alt+G)"
          className="flex-1 outline-none text-[13px] bg-transparent"
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleClose();
          }}
        />
        <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">×</button>
      </div>
      <div className="max-h-96 overflow-y-auto p-2">
        {isSearching && <div className="text-[12px] text-gray-500 p-2">Searching...</div>}
        {!isSearching && query.length >= 2 && (
          <div className="flex flex-col gap-2">
            {results.pages.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-2 py-1">Pages</h3>
                {results.pages.map((p) => (
                  <button
                    key={p.path}
                    onClick={() => { navigate({ to: `/${p.path}` as any }); handleClose(); }}
                    className="w-full text-left px-2 py-1.5 text-[12px] hover:bg-[#f5f6fa] rounded"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            {/* Show other results like vouchers, accounts similarly */}
          </div>
        )}
      </div>
    </div>
  );
};
