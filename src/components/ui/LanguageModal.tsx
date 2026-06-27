// @ts-nocheck
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export const DisplayLanguageModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [selected, setSelected] = useState(
    localStorage.getItem('displayLanguage') || 'en-IN'
  );

  const DISPLAY_LANGUAGES = [
    { code: 'en-IN', label: 'English (India)', script: 'Latin', region: 'India' },
    { code: 'en-GB', label: 'English (United Kingdom)', script: 'Latin', region: 'UK' },
    { code: 'hi', label: 'हिंदी (Hindi)', script: 'Devanagari', region: 'North India' },
    { code: 'ta', label: 'தமிழ் (Tamil)', script: 'Tamil', region: 'Tamil Nadu' },
    { code: 'te', label: 'తెలుగు (Telugu)', script: 'Telugu', region: 'Andhra/Telangana' },
    { code: 'kn', label: 'ಕನ್ನಡ (Kannada)', script: 'Kannada', region: 'Karnataka' },
    { code: 'ml', label: 'മലയാളം (Malayalam)', script: 'Malayalam', region: 'Kerala' },
    { code: 'mr', label: 'मराठी (Marathi)', script: 'Devanagari', region: 'Maharashtra' },
    { code: 'gu', label: 'ગુજરાતી (Gujarati)', script: 'Gujarati', region: 'Gujarat' },
    { code: 'bn', label: 'বাংলা (Bengali)', script: 'Bengali', region: 'West Bengal' },
    { code: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)', script: 'Gurmukhi', region: 'Punjab' },
    { code: 'or', label: 'ଓଡ଼ିଆ (Odia)', script: 'Odia', region: 'Odisha' },
    { code: 'ar', label: 'العربية (Arabic)', script: 'Arabic (RTL)', region: 'Middle East' },
    { code: 'fr', label: 'Français (French)', script: 'Latin', region: 'France/Africa' },
    { code: 'id', label: 'Bahasa Indonesia', script: 'Latin', region: 'Indonesia' },
  ];

  const selectedLanguage = DISPLAY_LANGUAGES.find(lang => lang.code === selected);

  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleApply = () => {
    localStorage.setItem('displayLanguage', selected);
    toast.success(`Display language changed to ${selectedLanguage?.label}. App restart may be needed for full effect.`);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center font-sans"
      onClick={onClose}
    >
      <div 
        className="w-[480px] bg-white border border-gray-300 rounded-lg shadow-xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#1e2433] px-4 py-3 flex justify-between items-center border-b border-gray-700">
          <div>
            <div className="text-[14px] font-bold text-white tracking-wide">
              SELECT DISPLAY LANGUAGE
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              Ctrl+K
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center bg-transparent hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded transition-colors"
            title="Close (Esc)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Current Language Band */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <span className="text-[11px] text-gray-500 uppercase tracking-wide font-semibold">Current:</span>
          <span className="text-[12px] font-medium text-gray-800">{selectedLanguage?.label}</span>
        </div>

        {/* Note Band */}
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-start gap-2">
          <svg className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-[11px] text-blue-800 leading-snug">
            This changes menus, buttons, labels and report headings only. Your data is not affected.
          </div>
        </div>

        {/* Language List */}
        <div className="flex-1 overflow-y-auto py-1">
          {DISPLAY_LANGUAGES.map((lang) => {
            const isSelected = selected === lang.code;
            return (
              <div
                key={lang.code}
                onClick={() => setSelected(lang.code)}
                className={`px-4 py-2.5 flex items-center gap-3 border-b border-gray-100 cursor-pointer transition-colors ${
                  isSelected ? 'bg-blue-50/50' : 'hover:bg-gray-50'
                }`}
              >
                {/* Radio Button */}
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                  isSelected ? 'border-[#1557b0] bg-[#1557b0]' : 'border-gray-300 bg-white'
                }`}>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className={`text-[13px] truncate ${
                    isSelected ? 'font-semibold text-[#1557b0]' : 'font-medium text-gray-800'
                  }`}>
                    {lang.label}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate mt-0.5">
                    {lang.region}
                  </div>
                </div>
                
                <div className="text-[10px] bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 font-medium">
                  {lang.script}
                </div>
              </div>
            );
          })}
        </div>

        {/* RTL Note */}
        {selected === 'ar' && (
          <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 flex items-start gap-2">
            <svg className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-[11px] text-amber-800 leading-snug">
              Arabic is RTL — layout will mirror. Menus appear on the right, text flows right-to-left.
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md transition-colors shadow-sm"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export const DataEntryLanguageModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [selectedLang, setSelectedLang] = useState(
    localStorage.getItem('dataEntryLanguage') || 'en'
  );
  const [selectedMode, setSelectedMode] = useState(
    localStorage.getItem('dataEntryMode') || 'direct'
  );
  const [previewInput, setPreviewInput] = useState('');
  const [previewOutput, setPreviewOutput] = useState('');

  const DATA_ENTRY_OPTIONS = [
    { code: 'en', label: 'English', mode: 'direct', description: 'Direct keyboard input (default)' },
    { code: 'hi-phonetic', label: 'Hindi — Phonetic', mode: 'phonetic', description: 'Type "Mera Naam" → मेरा नाम' },
    { code: 'hi-inscript', label: 'Hindi — Inscript', mode: 'inscript', description: 'Inscript keyboard layout' },
    { code: 'ta-phonetic', label: 'Tamil — Phonetic', mode: 'phonetic', description: 'Type "Vanakkam" → வணக்கம்' },
    { code: 'gu-phonetic', label: 'Gujarati — Phonetic', mode: 'phonetic', description: 'Phonetic Gujarati input' },
    { code: 'unicode', label: 'Unicode Direct', mode: 'unicode', description: 'Direct bilingual keyboard input — accepts any Unicode character' },
  ];

  const selectedOption = DATA_ENTRY_OPTIONS.find(opt => opt.code === selectedLang);

  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (selectedOption) {
      setSelectedMode(selectedOption.mode);
    }
  }, [selectedLang, selectedOption]);

  useEffect(() => {
    if (selectedLang.includes('phonetic')) {
      if (selectedLang.startsWith('hi')) {
        setPreviewOutput('e.g. type "Rahul" → राहुल (Hindi)');
      } else if (selectedLang.startsWith('ta')) {
        setPreviewOutput('e.g. type "Vanakkam" → வணக்கம் (Tamil)');
      } else if (selectedLang.startsWith('gu')) {
        setPreviewOutput('e.g. type "Namo Namo" → નમો નમો (Gujarati)');
      }
    } else {
      setPreviewOutput('');
    }
  }, [selectedLang]);

  if (!isOpen) return null;

  const handleApplySession = () => {
    localStorage.setItem('dataEntryLanguage', selectedLang);
    localStorage.setItem('dataEntryMode', selectedMode);
    toast.success('Data entry language set for this session');
    onClose();
  };

  const handleApplyDefault = () => {
    localStorage.setItem('dataEntryLanguage', selectedLang);
    localStorage.setItem('dataEntryMode', selectedMode);
    toast.success('Saved as default data entry language');
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center font-sans"
      onClick={onClose}
    >
      <div 
        className="w-[500px] bg-white border border-gray-300 rounded-lg shadow-xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#1e2433] px-4 py-3 flex justify-between items-center border-b border-gray-700">
          <div>
            <div className="text-[14px] font-bold text-white tracking-wide">
              SELECT DATA ENTRY LANGUAGE
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              Ctrl+W — changes keyboard input for data fields
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center bg-transparent hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded transition-colors"
            title="Close (Esc)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Info Band */}
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-start gap-2">
          <svg className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-[11px] text-blue-800 leading-snug">
            Data entry language controls what language you TYPE in text fields (ledger names, narrations, addresses). It is separate from the display language.
          </div>
        </div>

        {/* Option List */}
        <div className="flex-1 overflow-y-auto py-1">
          {DATA_ENTRY_OPTIONS.map((option) => {
            const isSelected = selectedLang === option.code;
            return (
              <div
                key={option.code}
                onClick={() => setSelectedLang(option.code)}
                className={`px-4 py-2.5 flex items-center gap-3 border-b border-gray-100 cursor-pointer transition-colors ${
                  isSelected ? 'bg-blue-50/50' : 'hover:bg-gray-50'
                }`}
              >
                {/* Radio Button */}
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                  isSelected ? 'border-[#1557b0] bg-[#1557b0]' : 'border-gray-300 bg-white'
                }`}>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className={`text-[13px] truncate ${
                    isSelected ? 'font-semibold text-[#1557b0]' : 'font-medium text-gray-800'
                  }`}>
                    {option.label}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate mt-0.5">
                    {option.description}
                  </div>
                </div>
                
                {option.mode === 'phonetic' && (
                  <div className="text-[9px] bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5 text-purple-700 font-semibold uppercase tracking-wider">
                    Phonetic
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Phonetic Preview Section */}
        {selectedLang.includes('phonetic') && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
            <div className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
              Phonetic Preview — Type here to test:
            </div>
            
            <input
              type="text"
              value={previewInput}
              onChange={(e) => setPreviewInput(e.target.value)}
              placeholder="Type here to see phonetic conversion"
              className="h-8 w-full px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] mb-2 shadow-sm"
            />
            
            <div className={`bg-white border border-gray-300 rounded-md px-2.5 py-1.5 min-h-[32px] text-[13px] flex items-center ${
              previewOutput ? 'text-gray-800' : 'text-gray-400 italic'
            }`}>
              {previewOutput || '(output will appear here)'}
            </div>
          </div>
        )}

        {/* Applicable Fields Note */}
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 flex items-start gap-2">
          <svg className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-[11px] text-amber-800 leading-snug">
            <span className="font-semibold">Applies to:</span> Ledger Name, Narration, Address, Item Description, Notes. <span className="font-semibold">Does NOT apply to:</span> Amounts, Dates, GSTIN, PAN (must be in English).
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApplySession}
            className="h-8 px-3 bg-white border border-gray-300 text-[#1557b0] text-[12px] font-medium rounded-md hover:bg-blue-50 transition-colors"
          >
            Apply to This Session
          </button>
          <button
            onClick={handleApplyDefault}
            className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md transition-colors shadow-sm"
          >
            Apply & Save as Default
          </button>
        </div>
      </div>
    </div>
  );
};

export default DisplayLanguageModal;
