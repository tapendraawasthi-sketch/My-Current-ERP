"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = BalanceSummary;
var fmt = function (value) {
    return new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(value);
};
function BalanceSummary(_a) {
    var udhaarOut = _a.udhaarOut, udhaarIn = _a.udhaarIn, recentCreditSales = _a.recentCreditSales, recentPaymentsIn = _a.recentPaymentsIn, activeChip = _a.activeChip, onChipClick = _a.onChipClick, onCloseList = _a.onCloseList;
    var list = activeChip === "out" ? recentCreditSales : recentPaymentsIn;
    return (<div className="border-b border-gray-200 bg-white px-3 py-2">
      <div className="flex gap-2">
        <button type="button" onClick={function () { return onChipClick("out"); }} className="rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">
          Udhaar out: {fmt(udhaarOut)}
        </button>
        <button type="button" onClick={function () { return onChipClick("in"); }} className="rounded-md bg-green-100 px-2 py-1 text-[11px] font-semibold text-green-700">
          Udhaar in: {fmt(udhaarIn)}
        </button>
      </div>
      {activeChip && (<div className="mt-2 rounded-md border border-gray-200 bg-[#f5f6fa] p-2">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Last 10 entries
            </p>
            <button type="button" onClick={onCloseList} className="text-[11px] text-gray-500">
              Close
            </button>
          </div>
          <ul className="space-y-1">
            {list.slice(0, 10).map(function (entry) {
                var _a, _b;
                return (<li key={entry.id} className="flex justify-between text-[12px] text-gray-700">
                <span>{(_b = (_a = entry.party_name) !== null && _a !== void 0 ? _a : entry.item) !== null && _b !== void 0 ? _b : entry.voucher_type}</span>
                <span className="font-mono">{fmt(entry.amount)}</span>
              </li>);
            })}
            {list.length === 0 && <li className="text-[12px] text-gray-500">No entries yet</li>}
          </ul>
        </div>)}
    </div>);
}
