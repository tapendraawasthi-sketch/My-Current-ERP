// src/components/F12Panel.tsx
// F12 Configuration Panel — DS Dialog shell

import React, { useEffect, useCallback } from "react";
import { useF12Config } from "../hooks/useF12Config";
import { type F12FieldDef, type F12SectionDef, type F12ValueMap } from "../lib/f12Types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  Button,
} from "@/design-system";

// ─── Individual field renderers ───────────────────────────────────────────────

interface FieldRowProps {
  field: F12FieldDef;
  value: boolean | string | number;
  onChange: (key: string, val: boolean | string | number) => void;
}

const FieldRow: React.FC<FieldRowProps> = ({ field, value, onChange }) => {
  const renderControl = () => {
    if (field.type === "boolean") {
      const boolVal = Boolean(value);
      return (
        <div className="flex rounded-md shadow-sm">
          <button
            type="button"
            onClick={() => onChange(field.key, true)}
            className={`px-3 py-1 text-[12px] font-semibold border ${
              boolVal
                ? "bg-[var(--ds-action-primary)] text-white border-[var(--ds-action-primary)] z-10"
                : "bg-white text-gray-700 border-[var(--ds-border-default)] hover:bg-gray-50"
            } rounded-l-md`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => onChange(field.key, false)}
            className={`px-3 py-1 text-[12px] font-semibold border-y border-r ${
              !boolVal
                ? "bg-[var(--ds-status-danger)] text-white border-[var(--ds-status-danger)] z-10"
                : "bg-white text-gray-700 border-[var(--ds-border-default)] hover:bg-gray-50"
            } rounded-r-md -ml-px`}
          >
            No
          </button>
        </div>
      );
    }

    if (field.type === "dropdown") {
      return (
        <select
          value={String(value)}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] min-w-[180px]"
        >
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "integer") {
      return (
        <input
          type="number"
          value={Number(value)}
          min={field.min ?? 0}
          max={field.max ?? 99}
          onChange={(e) => onChange(field.key, parseInt(e.target.value, 10) || 0)}
          className="h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-[80px] text-center"
        />
      );
    }

    if (field.type === "text" || field.type === "char") {
      return (
        <input
          type="text"
          value={String(value)}
          maxLength={field.type === "char" ? 1 : undefined}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={`h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] ${
            field.type === "char" ? "w-[50px] text-center" : "w-[200px]"
          }`}
        />
      );
    }

    return null;
  };

  return (
    <div className="flex items-start justify-between px-5 py-3.5 min-h-[48px] hover:bg-gray-50 transition-colors">
      <div className="flex-1 min-w-0 pr-4">
        <span className="text-[12px] font-medium text-gray-700 block leading-tight">
          {field.label}
        </span>
        <span className="text-[11px] text-gray-400 block mt-1 leading-snug">
          {field.description}
        </span>
      </div>
      <div className="flex-shrink-0 flex items-center pt-0.5">{renderControl()}</div>
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
      <div className="bg-gray-50 border-y border-gray-100 px-5 py-2.5">
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
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

  // F12 toggles closed while open (Escape handled by Dialog)
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "F12") {
        e.preventDefault();
        closeF12();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
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
      "Reset all F12 settings for this screen to default values?\n\nThis cannot be undone.",
    );
    if (confirmed) {
      resetToDefaults();
    }
  }, [resetToDefaults]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeF12()}>
      <DialogContent size="large" showClose className="no-print" data-modal-open="true">
        <DialogHeader>
          <DialogTitle>
            {screenDef ? screenDef.screenLabel : `Screen: ${activeScreenId}`}
          </DialogTitle>
          <DialogDescription>F12 — Configuration settings</DialogDescription>
        </DialogHeader>

        <DialogBody className="px-0 py-0">
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
              <p className="font-semibold mb-2 text-[14px] text-gray-600">
                No F12 configuration available
              </p>
              <p className="text-[12px]">
                This screen ({activeScreenId}) does not have any F12 settings registered.
              </p>
            </div>
          )}
        </DialogBody>

        <DialogFooter className="justify-between sm:justify-between">
          <span className="text-[11px] text-gray-400 flex items-center mr-auto">
            Press{" "}
            <kbd className="bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded text-gray-500 font-mono text-[10px] mx-0.5">
              Esc
            </kbd>{" "}
            or{" "}
            <kbd className="bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded text-gray-500 font-mono text-[10px] mx-0.5">
              F12
            </kbd>{" "}
            to close
          </span>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="small" onClick={handleReset}>
              Reset to Defaults
            </Button>
            <Button variant="secondary" size="small" onClick={closeF12}>
              Cancel
            </Button>
            <Button variant="primary" size="small" onClick={handleSave}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default F12Panel;
