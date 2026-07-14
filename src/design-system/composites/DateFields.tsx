import * as React from "react";
import NepaliDatePicker from "@/components/ui/NepaliDatePicker";
import { DualDate } from "@/components/ui/DualDate";
import { Button } from "../primitives/Button/Button";
import { Inline } from "../primitives/Layout/Layout";

/** DualDateField wraps retokened NepaliDatePicker (IMPLEMENT_NOW §3.3). */
export function DualDateField(
  props: React.ComponentProps<typeof NepaliDatePicker>,
) {
  return <NepaliDatePicker {...props} />;
}

export { DualDate as DualDateDisplay };

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "month", label: "This month" },
  { id: "fy", label: "This FY" },
  { id: "custom", label: "Custom" },
] as const;

export type DateRangePreset = (typeof PRESETS)[number]["id"];

export function DateRangeField({
  from,
  to,
  onChangeFrom,
  onChangeTo,
  preset,
  onPreset,
  className,
}: {
  from: string;
  to: string;
  onChangeFrom: (ad: string) => void;
  onChangeTo: (ad: string) => void;
  preset?: DateRangePreset;
  onPreset?: (p: DateRangePreset) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <Inline gap={2} className="mb-2 flex-wrap">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            size="small"
            variant={preset === p.id ? "primary" : "secondary"}
            onClick={() => onPreset?.(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </Inline>
      <Inline gap={3} className="flex-wrap">
        <NepaliDatePicker label="From" value={from} onChange={onChangeFrom} />
        <NepaliDatePicker label="To" value={to} onChange={onChangeTo} />
      </Inline>
    </div>
  );
}
