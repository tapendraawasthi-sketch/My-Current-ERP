// src/components/F12Panel.tsx
// F12 Configuration Panel — Modal overlay UI

import React, { useEffect, useCallback } from 'react';
import { useF12Config } from '../hooks/useF12Config';
import { type F12FieldDef, type F12SectionDef, type F12ValueMap } from '../lib/f12Types';

// ─── Individual field renderers ───────────────────────────────────────────────

interface FieldRowProps {
  field: F12FieldDef;
  value: boolean | string | number;
  onChange: (key: string, val: boolean | string | number) => void;
}

const FieldRow: React.FC<FieldRowProps> = ({ field, value, onChange }) => {
  const renderControl = () => {
    if (field.type === 'boolean') {
      const boolVal = Boolean(value);
      return (
        <div className="flex rounded-md shadow-sm">
          <button
            type="button"
            onClick={() => onChange(field.key, true)}
            className={`px-3 py-1 text-[11px] font-semibold border ${
              boolVal
                ? 'bg-[#1557b0] text-white border-[#1557b0] z-10'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            } rounded-l-md`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => onChange(field.key, false)}
            className={`px-3 py-1 text-[11px] font-semibold border-y border-r ${
              !boolVal
                ? 'bg-red-600 text-white border-red-600 z-10'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            } rounded-r-md -ml-px`}
          >
            No
          </button>
        </div>
      );
    }

    if (field.type === 'dropdown') {
      return (
        <select
          value={String(value)}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] min-w-[180px]"
        >
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === 'integer') {
      return (
        <input
          type="number"
          value={Number(value)}
          min={field.min ?? 0}
          max={field.max ?? 99}
          onChange={(e) => onChange(field.key, parseInt(e.target.value, 10) || 0)}
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-[80px] text-center"
        />
      );
    }

    if (field.type === 'text' || field.type === 'char') {
      return (
        <input
          type="text"
          value={String(value)}
          maxLength={field.type === 'char' ? 1 : undefined}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={`h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] ${
            field.type === 'char' ? 'w-[50px] text-center' : 'w-[200px]'
          }`}
        />
      );
    }

    return null;
  };

  return (
    <div className="flex items-start justify-between px-4 py-3 min-h-[48px] hover:bg-gray-50 transition-colors">
      <div className="flex-1 min-w-0 pr-4">
        <span className="text-[12px] font-medium text-gray-800 block leading-tight">
          {field.label}
        </span>
        <span className="text-[11px] text-gray-500 block mt-1 leading-snug">
          {field.description}
        </span>
      </div>
      <div className="flex-shrink-0 flex items-center pt-0.5">
        {renderControl()}
      </div>
    </div>
  );
};

// ─── Section renderer ────────────────────────────────────────────────────────

interface SectionProps {
  section: F12SectionDef;
  values: F12ValueMap;
  onChange: (key: string, val: boolean | string | number) => void;
}

const F12Section: React.FC<SectionProps> = ({ section, values, onChange }) => {
  return (
    <div className="mb-2">
      <div className="bg-[#f5f6fa] border-y border-gray-200 px-4 py-2">
        <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
          {section.sectionLabel}
        </h3>
      </div>
      <div className="divide-y divide-gray-100">
        {section.fields.map((field) => (
          <FieldRow
            key={field.key}
            field={field}
            value={values[field.key] ?? field.defaultValue}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Main F12 Panel ───────────────────────────────────────────────────────────

const F12Panel: React.FC = () => {
  const {
    isOpen,
    closeF12,
    screenDef,
    values,
    setValues,
    saveValues,
    resetToDefaults,
    activeScreenId,
  } = useF12Config();

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeF12();
      }
      if (e.key === 'F12') {
        e.preventDefault();
        closeF12();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, closeF12]);

  const handleFieldChange = useCallback(
    (key: string, val: boolean | string | number) => {
      setValues({ [key]: val });
    },
    [setValues],
  );

  const handleSave = useCallback(() => {
    saveValues();
    closeF12();
  }, [saveValues, closeF12]);

  const handleReset = useCallback(() => {
    const confirmed = window.confirm(
      'Reset all F12 settings for this screen to default values?\n\nThis cannot be undone.',
    );
    if (confirmed) {
      resetToDefaults();
    }
  }, [resetToDefaults]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4" 
      onClick={(e) => { if (e.target === e.currentTarget) closeF12(); }}
    >
      <div 
        className="w-[680px] max-h-[85vh] bg-white rounded-md shadow-2xl flex flex-col overflow-hidden" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="bg-[#1e2433] px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold !text-white leading-tight">
              {screenDef ? screenDef.screenLabel : `Screen: ${activeScreenId}`}
            </span>
            <span className="text-[11px] !text-gray-400 mt-0.5 uppercase tracking-wide">
              F12 — Configuration Settings
            </span>
          </div>
          <button 
            type="button" 
            onClick={closeF12}
            className="!text-gray-400 hover:!text-white transition-colors text-lg leading-none p-1"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-white min-h-0 pb-4">
          {screenDef ? (
            screenDef.sections.map((section) => (
              <F12Section
                key={section.sectionKey}
                section={section}
                values={values}
                onChange={handleFieldChange}
              />
            ))
          ) : (
            <div className="p-12 text-center text-gray-500">
              <p className="font-semibold mb-2 text-[13px] text-gray-700">No F12 configuration available</p>
              <p className="text-[12px]">
                This screen ({activeScreenId}) does not have any F12 settings registered.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-gray-500 flex items-center">
            Press <kbd className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-700 font-sans mx-1">Esc</kbd> or <kbd className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-700 font-sans mx-1">F12</kbd> to close
          </span>
          <div className="flex items-center gap-2">
            <button 
              type="button" 
              onClick={handleReset}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
            >
              Reset to Defaults
            </button>
            <button 
              type="button" 
              onClick={closeF12}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleSave}
              className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md"
            >
              ✓ Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default F12Panel;
