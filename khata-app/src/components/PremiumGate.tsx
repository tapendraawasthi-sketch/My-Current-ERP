interface PremiumGateProps {
  open: boolean;
  onDismiss: () => void;
}

export default function PremiumGate({ open, onDismiss }: PremiumGateProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white p-4 shadow-lg">
      <p className="text-[12px] text-gray-700">
        Yo feature Premium ma chha — 90 din ko history, party summary, export, ra multi-staff access.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="h-8 flex-1 rounded-md bg-[#1557b0] text-[12px] font-medium text-white"
        >
          Upgrade
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="h-8 flex-1 rounded-md border border-gray-300 text-[12px] font-medium text-gray-700"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
