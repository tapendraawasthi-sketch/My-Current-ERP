"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = InsightBar;
function InsightBar(_a) {
    var insights = _a.insights, onDismiss = _a.onDismiss, onPartyClick = _a.onPartyClick, onGrowthLadderYes = _a.onGrowthLadderYes, onGrowthLadderNo = _a.onGrowthLadderNo;
    if (insights.length === 0)
        return null;
    return (<div className="border-b border-gray-200 bg-blue-50 px-3 py-2">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">Insights</p>
        <button type="button" onClick={onDismiss} className="text-[11px] text-blue-700">
          ✕
        </button>
      </div>
      <ul className="space-y-2">
        {insights.map(function (insight) { return (<li key={insight.id} className="text-[12px] text-blue-900">
            {insight.party_name ? (<button type="button" onClick={function () { return onPartyClick === null || onPartyClick === void 0 ? void 0 : onPartyClick(insight.party_name); }}>
                {insight.message}
              </button>) : (insight.message)}
            {insight.type === "growth_ladder" && (<div className="mt-2 flex gap-2">
                <button type="button" onClick={onGrowthLadderYes} className="h-7 rounded-md bg-[#1557b0] px-2 text-[11px] font-medium text-white">
                  Hunchha
                </button>
                <button type="button" onClick={onGrowthLadderNo} className="h-7 rounded-md border border-gray-300 bg-white px-2 text-[11px] font-medium text-gray-700">
                  Pardaina
                </button>
              </div>)}
          </li>); })}
      </ul>
    </div>);
}
