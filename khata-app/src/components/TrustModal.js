"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = TrustModal;
function TrustModal(_a) {
    var open = _a.open, onClose = _a.onClose;
    if (!open)
        return null;
    return (<div className="fixed inset-0 z-50 flex items-end bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-md bg-white p-4 shadow-lg">
        <h2 className="text-[15px] font-semibold text-gray-800">Privacy</h2>
        <p className="mt-3 text-[12px] text-gray-700">
          यो app तपाईंको निजी हिसाबकिताबको लागि हो। यहाँ राखिएको जानकारी कर विभाग वा कुनै
          सरकारी निकायलाई पठाइदैन।
        </p>
        <p className="mt-3 text-[12px] text-gray-700">
          Mobile Khata is your private record book. Your data is never reported to the tax office
          or any government body.
        </p>
        <button type="button" onClick={onClose} className="mt-4 h-8 w-full rounded-md border border-gray-300 text-[12px] font-medium text-gray-700">
          Close
        </button>
      </div>
    </div>);
}
