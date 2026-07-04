/**
 * e-Khata training feedback — stores confirmed/cancelled entries for LoRA fine-tuning.
 * Persists to localStorage; syncs to erp_bot POST /khata/feedback when online.
 */

import { EKHATA_BOT_URL } from "./ekhataLlmClient";
import type { KhataConfirmationCard } from "./types";

const STORAGE_KEY = "ekhata-training-feedback-v1";
const MAX_ENTRIES = 2000;

export type FeedbackLabel = "confirmed" | "cancelled" | "corrected";

export interface TrainingFeedbackRecord {
  id: string;
  label: FeedbackLabel;
  narration: string;
  intent: string;
  amount: number;
  party?: string | null;
  journalLines?: Array<{ account: string; debit: number; credit: number }>;
  timestamp: string;
  correctedNarration?: string;
}

function loadRecords(): TrainingFeedbackRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TrainingFeedbackRecord[];
  } catch {
    return [];
  }
}

function saveRecords(records: TrainingFeedbackRecord[]): void {
  const trimmed = records.slice(-MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

function syncFeedbackToServer(record: TrainingFeedbackRecord): void {
  fetch(`${EKHATA_BOT_URL}/khata/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: record.id,
      label: record.label,
      narration: record.narration,
      intent: record.intent,
      amount: record.amount,
      party: record.party,
      journalLines: record.journalLines,
      correctedNarration: record.correctedNarration,
      timestamp: record.timestamp,
    }),
  }).catch(() => undefined);
}

export function recordTrainingFeedback(
  card: KhataConfirmationCard,
  label: FeedbackLabel,
  correctedNarration?: string,
): void {
  const record: TrainingFeedbackRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    narration: card.raw_text,
    intent: card.intent,
    amount: card.amount,
    party: card.party,
    journalLines: card.journalLines?.map((l) => ({
      account: l.accountCode,
      debit: l.debit,
      credit: l.credit,
    })),
    timestamp: new Date().toISOString(),
    correctedNarration,
  };

  const records = loadRecords();
  records.push(record);
  saveRecords(records);
  syncFeedbackToServer(record);
}

export function getTrainingFeedbackCount(): { confirmed: number; cancelled: number; total: number } {
  const records = loadRecords();
  return {
    confirmed: records.filter((r) => r.label === "confirmed").length,
    cancelled: records.filter((r) => r.label === "cancelled").length,
    total: records.length,
  };
}

/** Export as LoRA instruction JSONL lines (for manual upload to training pipeline) */
export function exportTrainingFeedbackAsJsonl(): string {
  const records = loadRecords().filter((r) => r.label === "confirmed");
  return records
    .map((r) =>
      JSON.stringify({
        instruction:
          "You are e-Khata CA parser. Parse the Nepal accounting transaction to structured JSON.",
        input: r.correctedNarration ?? r.narration,
        output: JSON.stringify({
          intent: r.intent,
          amount: r.amount,
          party: r.party,
          journalLines: r.journalLines,
          source: "user_confirmed",
        }),
      }),
    )
    .join("\n");
}

export function downloadTrainingFeedbackExport(): void {
  const jsonl = exportTrainingFeedbackAsJsonl();
  const blob = new Blob([jsonl], { type: "application/jsonl" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ekhata-user-feedback-${new Date().toISOString().slice(0, 10)}.jsonl`;
  a.click();
  URL.revokeObjectURL(url);
}

export function clearTrainingFeedback(): void {
  localStorage.removeItem(STORAGE_KEY);
}
