/** NIOS v3 — shared contract types */

export type MarketplaceTier = "capability" | "skill" | "workflow";

export type EvidenceType =
  | "erp"
  | "law"
  | "ontology"
  | "user"
  | "ocr"
  | "bank"
  | "graph"
  | "research"
  | "tool"
  | "simulation"
  | "inference"
  | "conversation";

export interface EvidenceObject {
  id: string;
  type: EvidenceType;
  statement: string;
  source: string;
  authority: number;
  confidence: number;
  jurisdiction?: string;
  lineage_ids?: string[];
  metadata?: Record<string, unknown>;
  timestamp: string;
  verification_status?: TruthRecord["verification_status"];
}

export type MemoryLevel =
  | "sensory"
  | "working"
  | "semantic"
  | "procedural"
  | "episodic"
  | "business"
  | "long_term";

export interface SchemaRef {
  name: string;
  required?: boolean;
}

export interface TenantContext {
  tenantId?: string;
  companyId?: string;
  userId?: string;
  sessionId: string;
}

export interface ObserveContext extends TenantContext {
  channel: "chat" | "voice" | "ocr" | "api" | "event";
  rawInput: unknown;
  metadata?: Record<string, unknown>;
}

export interface Observation {
  id: string;
  observedAt: string;
  channel: ObserveContext["channel"];
  rawText?: string;
  rawPayload?: Record<string, unknown>;
  tenantId?: string;
  companyId?: string;
  sessionId: string;
}

export interface UILDocument {
  id: string;
  version: "1.0";
  source_text?: string;
  language?: {
    detected?: string;
    script?: "devanagari" | "roman" | "english" | "mixed" | "unknown";
    canonical_text?: string;
  };
  action: string;
  actor?: { party?: string; role?: string };
  object?: Record<string, unknown>;
  financial_effect?: Record<string, unknown>;
  legal_effect?: Record<string, unknown>;
  inventory_effect?: Record<string, unknown>;
  tax_effect?: Record<string, unknown>;
  evidence_needed?: string[];
  confidence: number;
  goals: string[];
  dependencies?: string[];
  metadata?: Record<string, unknown>;
}

export interface GoalTreeNode {
  goal: string;
  objectives?: string[];
  constraints?: string[];
  risks?: string[];
  success_criteria?: string[];
}

export interface PlanStep {
  id: string;
  capabilityId: string;
  action: string;
  deps: string[];
  inputs?: Record<string, unknown>;
}

export interface ExecutionPlan {
  id: string;
  goal: GoalTreeNode;
  steps: PlanStep[];
  required_capabilities: string[];
  confidence: number;
}

export interface ExecutionResult {
  planId: string;
  capabilityId: string;
  ok: boolean;
  outputs: Record<string, unknown>;
  evidenceIds: string[];
  error?: string;
}

export interface VerificationReport {
  ok: boolean;
  capabilityId: string;
  checks: Array<{ name: string; passed: boolean; detail?: string }>;
  truthRecords: TruthRecord[];
}

export interface TruthRecord {
  statement: string;
  evidence: string[];
  source: string;
  confidence: number;
  timestamp: string;
  jurisdiction?: string;
  knowledge_version?: string;
  verification_status: "verified_deterministic" | "verified_evidence" | "inferred" | "unverified";
}

export interface ExplanationEnvelope {
  summary: string;
  reasoning_chain?: string[];
  law_references?: string[];
  formula_used?: string[];
  evidence: TruthRecord[];
  confidence: number;
  alternatives?: string[];
  impact?: Record<string, unknown>;
  risks?: string[];
  next_steps?: string[];
}

export interface LearningObservation {
  capabilityId: string;
  observationType: "success" | "failure" | "correction" | "feedback";
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface CapabilityDescriptor {
  id: string;
  version: string;
  contract_version: "1.0";
  tier: MarketplaceTier;
  inputs: SchemaRef[];
  outputs: SchemaRef[];
  provides: string[];
  requires: string[];
  latency_p50_ms: number;
  cost_tier: 0 | 1 | 2 | 3 | 4 | 5;
  confidence_floor: number;
  description?: string;
}

export interface NiosChatRequest {
  message: string;
  session_id: string;
  tenant_id?: string;
  company_id?: string;
  user_id?: string;
  balance?: Record<string, unknown>;
  language?: string;
  context?: Record<string, unknown>;
}

export interface NiosChatResponse {
  answer: string;
  session_id: string;
  intent?: string;
  confidence?: number;
  engine?: string;
  explanation?: ExplanationEnvelope;
  capabilities_used?: string[];
  trace?: Record<string, unknown>;
}
