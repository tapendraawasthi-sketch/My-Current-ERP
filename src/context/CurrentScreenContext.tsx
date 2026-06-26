import React, { createContext } from 'react';

interface CurrentScreenContextValue {
  currentPage: string;
  screenTitle: string;
  canExport: boolean;
  canPrint: boolean;
  canShare: boolean;
  getExportData: () => Promise<any>;
  getPrintData: () => Promise<any>;
}

export const CurrentScreenContext = createContext<CurrentScreenContextValue>({
  currentPage: 'dashboard',
  screenTitle: 'Dashboard',
  canExport: false,
  canPrint: false,
  canShare: false,
  getExportData: async () => ({}),
  getPrintData: async () => ({}),
});

export const CurrentScreenProvider: React.FC<{
  currentPage: string;
  children: React.ReactNode;
}> = ({ currentPage, children }) => {
  const exportablePages = [
    'balance-sheet', 'trial-balance', 'profit-loss', 'day-book', 'ledger', 'billing', 'vouchers', 'stock-summary'
  ];
  const printablePages = [
    'billing', 'balance-sheet', 'trial-balance', 'profit-loss', 'ledger', 'day-book', 'vouchers'
  ];
  const shareablePages = [
    'billing', 'balance-sheet', 'trial-balance', 'profit-loss'
  ];

  return (
    <CurrentScreenContext.Provider
      value={{
        currentPage,
        screenTitle: currentPage.charAt(0).toUpperCase() + currentPage.slice(1).replace(/-/g, ' '),
        canExport: exportablePages.includes(currentPage),
        canPrint: printablePages.includes(currentPage),
        canShare: shareablePages.includes(currentPage),
        getExportData: async () => ({}), // To be implemented by active screen component
        getPrintData: async () => ({}),
      }}
    >
      {children}
    </CurrentScreenContext.Provider>
  );
};
