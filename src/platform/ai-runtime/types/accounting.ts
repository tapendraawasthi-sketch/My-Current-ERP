import type { DeepReadonly } from "./immutable";
import type { KhataIntent } from "@/lib/ekhata/types";

export type PaymentMode = "cash" | "bank" | "credit" | "unknown";

export interface AccountingIntentExtract {
  readonly khataIntent: KhataIntent;
  readonly party: string | null;
  readonly amount: number;
  readonly paymentMode: PaymentMode;
  readonly rawInput: string;
  readonly confidence: number;
  readonly clarifyingQuestion?: string;
}

export interface JournalLineProposal {
  readonly accountCode: string;
  readonly accountName: string;
  readonly debit: number;
  readonly credit: number;
  readonly narration?: string;
}

export interface JournalProposal {
  readonly id: string;
  readonly khataIntent: KhataIntent;
  readonly party: string | null;
  readonly amount: number;
  readonly paymentMode: PaymentMode;
  readonly lines: readonly JournalLineProposal[];
  readonly balanced: boolean;
  readonly explanation: string;
  readonly card: Readonly<Record<string, unknown>>;
}

export type FrozenAccountingExtract = DeepReadonly<AccountingIntentExtract>;
export type FrozenJournalProposal = DeepReadonly<JournalProposal>;

export const ACCOUNTING_ENTITY_KEY = "accountingExtract";
export const JOURNAL_PROPOSAL_KEY = "journalProposal";
