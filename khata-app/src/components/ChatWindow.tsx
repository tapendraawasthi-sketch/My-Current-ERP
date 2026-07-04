import { useEffect, useRef } from "react";
import type { ChatMessage, KhataConfirmationCard } from "../types";
import MessageBubble from "./MessageBubble";

const INTENT_LABELS: Record<string, string> = {
  khata_credit_sale: "Credit Sale",
  khata_cash_sale: "Cash Sale",
  khata_payment_in: "Payment Received",
  khata_purchase: "Purchase",
  khata_payment_out: "Payment Made",
  khata_expense: "Expense",
};

interface ChatWindowProps {
  messages: ChatMessage[];
  pendingCard: KhataConfirmationCard | null;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ChatWindow({
  messages,
  pendingCard,
  loading,
  onConfirm,
  onCancel,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingCard, loading]);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3">
      {messages.map((message) => (
        <MessageBubble key={message.id} role={message.role} text={message.text} />
      ))}

      {pendingCard && (
        <div className="mb-2 max-w-[90%] rounded-md border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Confirm transaction
          </p>
          <dl className="mt-2 space-y-1 text-[12px] text-gray-700">
            <div className="flex justify-between">
              <dt>Type</dt>
              <dd>{INTENT_LABELS[pendingCard.intent] ?? pendingCard.intent}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Party</dt>
              <dd>{pendingCard.party ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Amount</dt>
              <dd className="font-mono">NPR {pendingCard.amount}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Item</dt>
              <dd>{pendingCard.item ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Date</dt>
              <dd>{pendingCard.date}</dd>
            </div>
          </dl>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onConfirm}
              className="h-8 flex-1 rounded-md bg-[#1557b0] text-[12px] font-medium text-white hover:bg-[#0f4a96]"
            >
              Confirm ✓
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="h-8 flex-1 rounded-md border border-gray-300 bg-white text-[12px] font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel ✗
            </button>
          </div>
        </div>
      )}

      {loading && (
        <MessageBubble role="assistant" text="Falcon is reading your entry..." />
      )}
      <div ref={bottomRef} />
    </div>
  );
}
