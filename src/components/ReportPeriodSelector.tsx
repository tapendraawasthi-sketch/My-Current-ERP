import React, { useState, useEffect } from "react";
import { Calendar } from "lucide-react";
import NepaliDatePicker from "./ui/NepaliDatePicker";
import { adToBS } from "../lib/nepaliDate";

export interface ReportFilters {
  periodType: "today" | "week" | "month" | "quarter" | "fy" | "custom";
  fromDate: string;
  toDate: string;
  accountId?: number;
  partyId?: number;
  warehouseId?: number;
}

interface ReportPeriodSelectorProps {
  value: ReportFilters;
  onChange: (filters: ReportFilters) => void;
  showAccountFilter?: boolean;
  showPartyFilter?: boolean;
  showWarehouseFilter?: boolean;
}

export const ReportPeriodSelector: React.FC<ReportPeriodSelectorProps> = ({
  value,
  onChange,
  showAccountFilter,
  showPartyFilter,
  showWarehouseFilter,
}) => {
  const [accounts] = useState<any[]>([]);
  const [parties] = useState<any[]>([]);
  const [warehouses] = useState<any[]>([]);

  const presets = [
    { label: "Today", value: "today" as const },
    { label: "This Week", value: "week" as const },
    { label: "This Month", value: "month" as const },
    { label: "This Quarter", value: "quarter" as const },
    { label: "This FY", value: "fy" as const },
    { label: "Custom", value: "custom" as const },
  ];

  const getPeriodLabel = (): string => {
    if (!value.fromDate || !value.toDate) return "No period selected";

    const fy = getFiscalYear(value.toDate);
    return `${value.fromDate} to ${value.toDate} (FY ${fy})`;
  };

  const getFiscalYear = (date: string): string => {
    const parts = date.split(" ");
    const year = parseInt(parts[2]);
    const month = parts[1];

    const fiscalMonths = [
      "Baisakh",
      "Jestha",
      "Ashadh",
      "Shrawan",
      "Bhadra",
      "Ashwin",
      "Kartik",
      "Mangsir",
      "Poush",
      "Magh",
      "Falgun",
      "Chaitra",
    ];
    const monthIndex = fiscalMonths.indexOf(month);

    if (monthIndex >= 0 && monthIndex < 9) {
      return `${year}/${(year + 1).toString().slice(-2)}`;
    } else {
      return `${year - 1}/${year.toString().slice(-2)}`;
    }
  };

  const handlePresetChange = (preset: typeof value.periodType) => {
    const today = new Date();
    const nepaliToday = formatNepaliDate(today);

    let fromDate = nepaliToday;
    let toDate = nepaliToday;

    switch (preset) {
      case "today":
        fromDate = toDate = nepaliToday;
        break;
      case "week":
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        fromDate = formatNepaliDate(weekStart);
        toDate = nepaliToday;
        break;
      case "month":
        fromDate = `01 ${nepaliToday.split(" ")[1]} ${nepaliToday.split(" ")[2]}`;
        toDate = nepaliToday;
        break;
      case "quarter":
        const currentMonth = nepaliToday.split(" ")[1];
        const year = nepaliToday.split(" ")[2];
        const quarters = {
          Baisakh: "01 Baisakh",
          Jestha: "01 Baisakh",
          Ashadh: "01 Baisakh",
          Shrawan: "01 Shrawan",
          Bhadra: "01 Shrawan",
          Ashwin: "01 Shrawan",
          Kartik: "01 Kartik",
          Mangsir: "01 Kartik",
          Poush: "01 Kartik",
          Magh: "01 Magh",
          Falgun: "01 Magh",
          Chaitra: "01 Magh",
        };
        fromDate = `${quarters[currentMonth as keyof typeof quarters]} ${year}`;
        toDate = nepaliToday;
        break;
      case "fy":
        const fyYear = parseInt(nepaliToday.split(" ")[2]);
        const fyMonth = nepaliToday.split(" ")[1];
        const fiscalMonths = [
          "Baisakh",
          "Jestha",
          "Ashadh",
          "Shrawan",
          "Bhadra",
          "Ashwin",
          "Kartik",
          "Mangsir",
          "Poush",
          "Magh",
          "Falgun",
          "Chaitra",
        ];
        const mIndex = fiscalMonths.indexOf(fyMonth);

        if (mIndex >= 0 && mIndex < 9) {
          fromDate = `01 Baisakh ${fyYear}`;
          toDate = `30 Chaitra ${fyYear}`;
        } else {
          fromDate = `01 Baisakh ${fyYear - 1}`;
          toDate = `30 Chaitra ${fyYear}`;
        }
        break;
    }

    onChange({ ...value, periodType: preset, fromDate, toDate });
  };

  const formatNepaliDate = (date: Date): string => {
    try {
      const bs = adToBS(date);
      const months = [
        "Baisakh",
        "Jestha",
        "Ashadh",
        "Shrawan",
        "Bhadra",
        "Ashwin",
        "Kartik",
        "Mangsir",
        "Poush",
        "Magh",
        "Falgun",
        "Chaitra",
      ];
      const day = bs.day.toString().padStart(2, "0");
      const month = months[bs.month - 1];
      const year = bs.year;
      return `${day} ${month} ${year}`;
    } catch {
      return "";
    }
  };

  return (
    <div className="space-y-4 p-4 bg-[var(--ds-surface-muted)] dark:bg-[var(--ds-surface-muted)] rounded-lg border border-[var(--ds-border-default)] dark:border-[var(--ds-border-default)]">
      {/* Period Presets */}
      <div className="flex gap-2 flex-wrap">
        {presets.map((preset) => (
          <button
            key={preset.value}
            onClick={() => handlePresetChange(preset.value)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              value.periodType === preset.value
                ? "bg-[var(--ds-surface-hover)] text-white"
                : "bg-white dark:bg-[var(--ds-surface-muted)] text-[#000000] dark:text-[#000000] hover:bg-[var(--ds-surface-muted)] dark:hover:bg-[var(--ds-surface-muted)] border border-[var(--ds-border-default)] dark:border-[var(--ds-border-default)]"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Custom Date Range */}
      {value.periodType === "custom" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#000000] dark:text-[#000000] mb-1">
              From Date
            </label>
            <NepaliDatePicker
              value={value.fromDate}
              onChange={(date: string) => onChange({ ...value, fromDate: date })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#000000] dark:text-[#000000] mb-1">
              To Date
            </label>
            <NepaliDatePicker
              value={value.toDate}
              onChange={(date: string) => onChange({ ...value, toDate: date })}
            />
          </div>
        </div>
      )}

      {/* Optional Filters */}
      {(showAccountFilter || showPartyFilter || showWarehouseFilter) && (
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[var(--ds-border-default)] dark:border-[var(--ds-border-default)]">
          {showAccountFilter && (
            <div>
              <label className="block text-sm font-medium text-[#000000] dark:text-[#000000] mb-1">
                Account
              </label>
              <select
                value={value.accountId || ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    accountId: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                className="w-full px-3 py-2 border border-[var(--ds-border-default)] dark:border-[var(--ds-border-default)] rounded-md bg-white dark:bg-[var(--ds-surface-muted)] text-[#000000] dark:text-[#000000]"
              >
                <option value="">All Accounts</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showPartyFilter && (
            <div>
              <label className="block text-sm font-medium text-[#000000] dark:text-[#000000] mb-1">
                Party
              </label>
              <select
                value={value.partyId || ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    partyId: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                className="w-full px-3 py-2 border border-[var(--ds-border-default)] dark:border-[var(--ds-border-default)] rounded-md bg-white dark:bg-[var(--ds-surface-muted)] text-[#000000] dark:text-[#000000]"
              >
                <option value="">All Parties</option>
                {parties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showWarehouseFilter && (
            <div>
              <label className="block text-sm font-medium text-[#000000] dark:text-[#000000] mb-1">
                Warehouse
              </label>
              <select
                value={value.warehouseId || ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    warehouseId: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                className="w-full px-3 py-2 border border-[var(--ds-border-default)] dark:border-[var(--ds-border-default)] rounded-md bg-white dark:bg-[var(--ds-surface-muted)] text-[#000000] dark:text-[#000000]"
              >
                <option value="">All Warehouses</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Period Label */}
      <div className="flex items-center gap-2 text-sm text-[#000000] dark:text-[#000000] pt-2 border-t border-[var(--ds-border-default)] dark:border-[var(--ds-border-default)]">
        <Calendar className="w-4 h-4" />
        <span className="font-medium">{getPeriodLabel()}</span>
      </div>
    </div>
  );
};
