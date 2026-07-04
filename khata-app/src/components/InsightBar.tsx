import type { InsightItem } from "../lib/insightEngine";

interface InsightBarProps {
  insights: InsightItem[];
  onDismiss: () => void;
  onPartyClick?: (partyName: string) => void;
}

export default function InsightBar({ insights, onDismiss, onPartyClick }: InsightBarProps) {
  if (insights.length === 0) return null;

  return (
    <div className="border-b border-gray-200 bg-blue-50 px-3 py-2">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">Insights</p>
        <button type="button" onClick={onDismiss} className="text-[11px] text-blue-700">
          ✕
        </button>
      </div>
      <ul className="space-y-1">
        {insights.map((insight) => (
          <li key={insight.id} className="text-[12px] text-blue-900">
            {insight.party_name ? (
              <button type="button" onClick={() => onPartyClick?.(insight.party_name!)}>
                {insight.message}
              </button>
            ) : (
              insight.message
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
