import type { InsightItem } from "../lib/insightEngine";

interface InsightBarProps {
  insights: InsightItem[];
  onDismiss: () => void;
  onPartyClick?: (partyName: string) => void;
  onGrowthLadderYes?: () => void;
  onGrowthLadderNo?: () => void;
}

export default function InsightBar({
  insights,
  onDismiss,
  onPartyClick,
  onGrowthLadderYes,
  onGrowthLadderNo,
}: InsightBarProps) {
  if (insights.length === 0) return null;

  return (
    <div className="border-b border-gray-200 bg-blue-50 px-3 py-2">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">Insights</p>
        <button type="button" onClick={onDismiss} className="text-[11px] text-blue-700">
          ✕
        </button>
      </div>
      <ul className="space-y-2">
        {insights.map((insight) => (
          <li key={insight.id} className="text-[12px] text-blue-900">
            {insight.party_name ? (
              <button type="button" onClick={() => onPartyClick?.(insight.party_name!)}>
                {insight.message}
              </button>
            ) : (
              insight.message
            )}
            {insight.type === "growth_ladder" && (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={onGrowthLadderYes}
                  className="h-7 rounded-md bg-[#1557b0] px-2 text-[11px] font-medium text-white"
                >
                  Hunchha
                </button>
                <button
                  type="button"
                  onClick={onGrowthLadderNo}
                  className="h-7 rounded-md border border-gray-300 bg-white px-2 text-[11px] font-medium text-gray-700"
                >
                  Pardaina
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
