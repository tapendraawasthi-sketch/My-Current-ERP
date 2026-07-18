// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../../store/useStore";
import { getDB } from "../../lib/db";
import { AlertTriangle } from "lucide-react";

interface BatchSerialSelectorProps {
  itemId: string;
  itemName: string;
  quantity: number;
  onBatchSelect: (batchId: string, batchNo: string, rate: number) => void;
  onSerialSelect: (serials: string[]) => void;
  mode: "batch" | "serial" | "none";
}

const BatchSerialSelector: React.FC<BatchSerialSelectorProps> = ({
  itemId,
  itemName,
  quantity,
  onBatchSelect,
  onSerialSelect,
  mode,
}) => {
  const { batches } = useStore();
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
  const [availableSerials, setAvailableSerials] = useState<any[]>([]);
  const [error, setError] = useState<string>("");

  // Load available serial numbers for the item
  useEffect(() => {
    if (mode === "serial" && itemId) {
      const db = getDB();
      db.serialNumbers
        .where("itemId")
        .equals(itemId)
        .and((s) => s.status === "in-stock")
        .toArray()
        .then(setAvailableSerials)
        .catch(() => setAvailableSerials([]));
    }
  }, [mode, itemId]);

  // Filter batches for the specific item
  const itemBatches = useMemo(() => {
    if (!itemId) return [];

    return batches
      .filter((batch) => batch.itemId === itemId && batch.currentQty > 0 && batch.isActive)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()); // FEFO
  }, [batches, itemId]);

  // Calculate days to expiry
  const calculateDaysToExpiry = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Handle batch selection
  useEffect(() => {
    if (mode === "batch" && itemBatches.length > 0 && !selectedBatch) {
      // Auto-select first batch (earliest expiry)
      const firstBatch = itemBatches[0];
      setSelectedBatch(firstBatch.id);
      onBatchSelect(firstBatch.id, firstBatch.batchNo, firstBatch.saleRate);
    }
  }, [mode, itemBatches]);

  // Handle batch change
  const handleBatchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const batchId = e.target.value;
    setSelectedBatch(batchId);

    const batch = itemBatches.find((b) => b.id === batchId);
    if (batch) {
      onBatchSelect(batch.id, batch.batchNo, batch.saleRate);
    }
  };

  // Handle serial selection
  const handleSerialToggle = (serialNo: string) => {
    setSelectedSerials((prev) => {
      if (prev.includes(serialNo)) {
        return prev.filter((s) => s !== serialNo);
      } else {
        if (prev.length >= quantity) {
          return prev; // Don't allow selecting more than quantity
        }
        return [...prev, serialNo];
      }
    });
  };

  // Validate serial count
  useEffect(() => {
    if (mode === "serial") {
      if (selectedSerials.length > 0 && selectedSerials.length !== quantity) {
        setError(`Selected count (${selectedSerials.length}) must equal quantity (${quantity})`);
      } else {
        setError("");
        onSerialSelect(selectedSerials);
      }
    }
  }, [selectedSerials, quantity, mode]);

  if (mode === "none") return null;

  return (
    <div className="mt-2 bg-gray-50 border border-gray-200 rounded-md p-3">
      {mode === "batch" && (
        <div>
          <label className="block text-[11px] font-medium text-gray-700 mb-1.5">Select Batch</label>
          {itemBatches.length > 0 ? (
            <select
              value={selectedBatch}
              onChange={handleBatchChange}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
            >
              {itemBatches.map((batch) => {
                const daysToExpiry = calculateDaysToExpiry(batch.expiryDate);
                const isNearExpiry = daysToExpiry <= 30 && daysToExpiry > 0;

                return (
                  <option key={batch.id} value={batch.id}>
                    {batch.batchNo} | Qty: {batch.currentQty} | Exp: {batch.expiryDate} | Rate:{" "}
                    {batch.saleRate}
                  </option>
                );
              })}
            </select>
          ) : (
            <div className="text-[12px] text-gray-500 py-1 italic">
              No active batches available for this item.
            </div>
          )}

          {itemBatches.length > 0 &&
            selectedBatch &&
            calculateDaysToExpiry(itemBatches.find((b) => b.id === selectedBatch)?.expiryDate) <=
              30 && (
              <div className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1 font-medium">
                <AlertTriangle size={12} /> This batch is near expiry
              </div>
            )}
        </div>
      )}

      {mode === "serial" && (
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-[11px] font-medium text-gray-700">Select Serial Numbers</label>
            <span
              className={`text-[10px] font-medium ${selectedSerials.length === quantity ? "text-green-600" : "text-gray-500"}`}
            >
              {selectedSerials.length} of {quantity} required
            </span>
          </div>

          {error && selectedSerials.length > 0 && (
            <div className="text-[10px] text-red-600 mb-2 flex items-center gap-1 bg-red-50 p-1.5 rounded-md border border-red-100">
              <AlertTriangle size={12} /> {error}
            </div>
          )}

          {selectedSerials.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3 p-2 bg-white border border-gray-200 rounded-md min-h-[34px]">
              {selectedSerials.map((serial) => (
                <div
                  key={serial}
                  className="bg-[var(--ds-action-primary)] text-white px-2 py-0.5 rounded-md text-[11px] flex items-center gap-1 font-medium shadow-sm"
                >
                  {serial}
                  <button
                    type="button"
                    onClick={() => handleSerialToggle(serial)}
                    className="text-blue-200 hover:text-white transition-colors focus:outline-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
            {availableSerials.length > 0 ? (
              availableSerials.map((serial) => {
                const isSelected = selectedSerials.includes(serial.serialNo);
                const isDisabled = !isSelected && selectedSerials.length >= quantity;

                return (
                  <button
                    key={serial.id}
                    type="button"
                    disabled={isDisabled}
                    className={`border px-2 py-1.5 text-[11px] rounded-md font-medium transition-all ${
                      isSelected
                        ? "bg-[var(--ds-action-primary)] border-[var(--ds-action-primary)] text-white shadow-sm"
                        : isDisabled
                          ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
                          : "bg-white border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-200"
                    }`}
                    onClick={() => handleSerialToggle(serial.serialNo)}
                  >
                    {serial.serialNo}
                  </button>
                );
              })
            ) : (
              <div className="col-span-full text-[12px] text-gray-500 py-2 text-center italic border border-dashed border-gray-300 rounded-md bg-white">
                No serial numbers available in stock.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchSerialSelector;
