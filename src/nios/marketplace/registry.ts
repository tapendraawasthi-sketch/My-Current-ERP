/**
 * NIOS Capability Registry — Phase 0 bootstrap descriptors.
 * Route by capability tag, not plugin name.
 */

import type { CapabilityDescriptor } from "../contracts/types";

export const BOOTSTRAP_CAPABILITIES: CapabilityDescriptor[] = [
  {
    id: "cap.chat.route",
    version: "1.0.0",
    contract_version: "1.0",
    tier: "capability",
    inputs: [{ name: "message", required: true }],
    outputs: [{ name: "intent" }, { name: "route" }],
    provides: ["routing", "intent_classification"],
    requires: [],
    latency_p50_ms: 5,
    cost_tier: 0,
    confidence_floor: 0.7,
    description: "Intent routing and capability selection",
  },
  {
    id: "cap.erp.ledger.balance",
    version: "1.0.0",
    contract_version: "1.0",
    tier: "capability",
    inputs: [{ name: "party_name" }, { name: "account_id" }],
    outputs: [{ name: "balance" }],
    provides: ["ledger_query", "balance"],
    requires: ["cap.erp.session_snapshot"],
    latency_p50_ms: 10,
    cost_tier: 0,
    confidence_floor: 1.0,
    description: "Deterministic party/account balance from ERP snapshot",
  },
  {
    id: "cap.erp.session_snapshot",
    version: "1.0.0",
    contract_version: "1.0",
    tier: "capability",
    inputs: [{ name: "session_id", required: true }],
    outputs: [{ name: "snapshot" }],
    provides: ["erp_data", "session_snapshot"],
    requires: [],
    latency_p50_ms: 5,
    cost_tier: 0,
    confidence_floor: 1.0,
    description: "Live Dexie ERP session snapshot",
  },
  {
    id: "cap.tax.vat.calculate",
    version: "1.0.0",
    contract_version: "1.0",
    tier: "capability",
    inputs: [{ name: "invoice_lines", required: true }, { name: "effective_date" }],
    outputs: [{ name: "vat_amount" }, { name: "taxable_amount" }],
    provides: ["tax_calculation", "vat", "deterministic"],
    requires: [],
    latency_p50_ms: 8,
    cost_tier: 0,
    confidence_floor: 1.0,
    description: "VAT calculation via deterministic engine",
  },
  {
    id: "cap.tax.tds.calculate",
    version: "1.0.0",
    contract_version: "1.0",
    tier: "capability",
    inputs: [{ name: "taxable_amount", required: true }, { name: "nature_of_payment" }],
    outputs: [{ name: "tds_amount" }],
    provides: ["tax_calculation", "tds", "deterministic"],
    requires: [],
    latency_p50_ms: 8,
    cost_tier: 0,
    confidence_floor: 1.0,
    description: "TDS calculation via deterministic engine",
  },
  {
    id: "cap.khata.entry.parse",
    version: "1.0.0",
    contract_version: "1.0",
    tier: "capability",
    inputs: [{ name: "narration", required: true }],
    outputs: [{ name: "journal_lines" }, { name: "card" }],
    provides: ["khata_entry", "journal_parsing"],
    requires: [],
    latency_p50_ms: 500,
    cost_tier: 3,
    confidence_floor: 0.8,
    description: "Nepali khata entry parsing",
  },
  {
    id: "cap.knowledge.nepal.search",
    version: "1.0.0",
    contract_version: "1.0",
    tier: "capability",
    inputs: [{ name: "query", required: true }],
    outputs: [{ name: "chunks" }, { name: "citations" }],
    provides: ["knowledge_retrieval", "nepal_tax", "nepal_legal"],
    requires: [],
    latency_p50_ms: 50,
    cost_tier: 1,
    confidence_floor: 0.85,
    description: "Hybrid RAG over Nepal tax/accounting knowledge",
  },
  {
    id: "cap.nav.erp.find",
    version: "1.0.0",
    contract_version: "1.0",
    tier: "capability",
    inputs: [{ name: "query", required: true }],
    outputs: [{ name: "page_id" }, { name: "path" }],
    provides: ["navigation", "erp_howto"],
    requires: [],
    latency_p50_ms: 20,
    cost_tier: 1,
    confidence_floor: 0.9,
    description: "ERP page navigation lookup",
  },
  {
    id: "cap.language.detect",
    version: "1.0.0",
    contract_version: "1.0",
    tier: "capability",
    inputs: [{ name: "text", required: true }],
    outputs: [{ name: "language" }, { name: "script" }],
    provides: ["language_detection", "uil_input"],
    requires: [],
    latency_p50_ms: 3,
    cost_tier: 0,
    confidence_floor: 0.95,
    description: "Language and script detection for UIL",
  },
  {
    id: "cap.cache.semantic",
    version: "1.0.0",
    contract_version: "1.0",
    tier: "capability",
    inputs: [{ name: "query", required: true }],
    outputs: [{ name: "cached_answer" }],
    provides: ["semantic_cache"],
    requires: [],
    latency_p50_ms: 5,
    cost_tier: 0,
    confidence_floor: 0.95,
    description: "Semantic response cache lookup",
  },
];

const registry = new Map<string, CapabilityDescriptor>();

for (const cap of BOOTSTRAP_CAPABILITIES) {
  registry.set(cap.id, cap);
}

export function getCapability(id: string): CapabilityDescriptor | undefined {
  return registry.get(id);
}

export function listCapabilities(): CapabilityDescriptor[] {
  return Array.from(registry.values());
}

export function findByProvides(tag: string): CapabilityDescriptor[] {
  return listCapabilities().filter((c) => c.provides.includes(tag));
}

export function registerCapability(descriptor: CapabilityDescriptor): void {
  registry.set(descriptor.id, descriptor);
}
