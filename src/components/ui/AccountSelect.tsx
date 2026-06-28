// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import { useStore } from "../../store/useStore";
import { Search } from "lucide-react";
import toast from "react-hot-toast";

interface AccountSelectProps {
  value: string;
  onChange: (id: string, account?: any) => void;
  placeholder?: string;
  allowedTypes?: string[];
  allowedLevels?: string[];
  disabled?: boolean;
  className?: string;
}

const AccountSelect: React.FC<AccountSelectProps> = ({
  value,
  onChange,
  placeholder = "Select an account...",
  allowedTypes,
  allowedLevels,
  disabled = false,
  className = ""
}) => {
  const { accounts } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter accounts based on allowedTypes and allowedLevels
  const filteredAccounts = accounts.filter(acc => {
    const matchesType = !allowedTypes || allowedTypes.includes(acc.type);
    const matchesLevel = !allowedLevels || allowedLevels.includes(acc.level);
    const matchesSearch = acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (acc.alias && acc.alias.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesType && matchesLevel && matchesSearch;
  });

  // Find the currently selected account
  const selectedAccount = accounts.find(acc => acc.id === value);

  // Handle outside clicks
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, filteredAccounts.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (highlightedIndex >= 0) {
          const account = filteredAccounts[highlightedIndex];
          onChange(account.id, account);
          setIsOpen(false);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, highlightedIndex, filteredAccounts, onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (!isOpen) setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleOptionClick = (account: any) => {
    onChange(account.id, account);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleQuickCreate = () => {
    toast.info("Please open Account Master to create a new account.");
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm || (selectedAccount ? selectedAccount.name : "")}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          disabled={disabled}
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white w-full focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
        />
        <Search className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5 pointer-events-none" />
      </div>

      {isOpen && (
        <div className="absolute bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto z-50 w-full mt-1">
          {filteredAccounts.length > 0 ? (
            <>
              {filteredAccounts.map((account, index) => (
                <div
                  key={account.id}
                  className={`px-3 py-2 text-[12px] cursor-pointer text-gray-700 hover:bg-gray-50 ${
                    index === highlightedIndex ? "bg-gray-50" : ""
                  }`}
                  onClick={() => handleOptionClick(account)}
                >
                  <div className="font-medium">{account.code} | {account.name}</div>
                  {account.alias && (
                    <div className="text-[10px] text-gray-500 mt-0.5">Alias: {account.alias}</div>
                  )}
                </div>
              ))}
              <div
                className="px-3 py-2 text-[12px] font-medium text-[#1557b0] cursor-pointer hover:bg-gray-50 border-t border-gray-100"
                onClick={handleQuickCreate}
              >
                + Create New Account...
              </div>
            </>
          ) : (
            <div className="px-3 py-3 text-[12px] text-gray-500 text-center">No accounts found</div>
          )}
        </div>
      )}
    </div>
  );
};

export default AccountSelect;
