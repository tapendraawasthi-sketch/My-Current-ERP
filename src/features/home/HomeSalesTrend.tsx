import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button, SectionHeader } from "@/design-system";
import { formatHomeAmount } from "./format";
import type { HomeSalesTrendModel } from "./types";

function TrendTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { date?: string; amount?: number } }>;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row?.date) return null;
  return (
    <div className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-2.5 py-1.5 text-[11px] shadow-sm">
      <p className="text-[var(--ds-text-muted)]">{row.date}</p>
      <p className="ds-financial-value font-medium text-[var(--ds-text)]">
        {formatHomeAmount(Number(row.amount ?? 0), currency)}
      </p>
    </div>
  );
}

export function HomeSalesTrend({
  trend,
  onNavigate,
}: {
  trend: HomeSalesTrendModel;
  onNavigate: (page: string) => void;
}) {
  const hasSeries = trend.points.length >= 2;
  const summary = hasSeries
    ? `Posted sales on ${trend.points.length} day(s); ${trend.periodLabel}.`
    : "Not enough posted sales history for a trend.";

  return (
    <div
      className="mt-3 rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface-muted)] p-3"
      data-testid="home-sales-trend"
      data-trend-points={trend.points.length}
    >
      <SectionHeader
        title="Sales trend"
        description={`Daily posted sales · ${trend.periodLabel}`}
        actions={
          <Button variant="quiet" size="small" onClick={() => onNavigate(trend.drillDownRoute)}>
            View billing
          </Button>
        }
      />
      <p className="sr-only">{summary}</p>
      {!hasSeries ? (
        <p className="mt-3 text-[12px] text-[var(--ds-text-muted)]">Not enough history yet</p>
      ) : (
        <div
          className="mt-3 h-[120px] w-full"
          role="img"
          aria-label={summary}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend.points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--ds-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--ds-text-subtle)", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "var(--ds-border)" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "var(--ds-text-subtle)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v) =>
                  Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v)
                }
              />
              <Tooltip content={<TrendTooltip currency={trend.currency} />} />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="var(--ds-primary, var(--ox-primary, #1557b0))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, fill: "var(--ds-primary, var(--ox-primary, #1557b0))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
