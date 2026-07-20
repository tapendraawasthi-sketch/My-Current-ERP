import React from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";

/** Tiny sparkline — only render when caller supplies ≥2 real points. */
export function MetricSparkline({
  points,
}: {
  points: Array<{ date: string; value: number }>;
}) {
  if (points.length < 2) return null;
  return (
    <div className="mt-2 h-8 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--ds-primary, var(--ox-primary, #1557b0))"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
