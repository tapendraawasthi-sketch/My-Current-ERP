import React from 'react';
import { CompanyMenu } from './CompanyMenu';
import { DataMenu } from './DataMenu';
import { ExchangeMenu } from './ExchangeMenu';
import { ImportMenu } from './ImportMenu';
import { ExportMenu } from './ExportMenu';
import { ShareMenu } from './ShareMenu';
import { PrintMenu } from './PrintMenu';
import { HelpMenu } from './HelpMenu';
import { GoToPanel } from './GoToPanel';
import { SwitchToPanel } from './SwitchToPanel';
import { Search } from 'lucide-react';
import { useStore } from '../../store/useStore';

export const TopMenuBar: React.FC = () => {
  const { setGotoOpen } = useStore();

  return (
    <div className="flex items-center h-8 bg-[#1e2433] text-white px-2 justify-between shrink-0 relative z-50">
      <div className="flex items-center space-x-1">
        <CompanyMenu />
        <DataMenu />
        <ExchangeMenu />
        <ImportMenu />
        <ExportMenu />
        <ShareMenu />
        <PrintMenu />
        <HelpMenu />
      </div>

      <div className="flex items-center space-x-3">
        <button
          onClick={() => setGotoOpen(true)}
          className="flex items-center text-[11px] text-gray-300 hover:text-white bg-[#273148] px-2 py-1 rounded"
          title="Go To (Alt+G)"
        >
          <Search size={12} className="mr-1" />
          Go To (Alt+G)
        </button>
      </div>

      {/* Overlays */}
      <GoToPanel />
      <SwitchToPanel />
    </div>
  );
};
