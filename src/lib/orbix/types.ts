/** Shared Orbix v2 client types — mirror of erp_bot/src/orbix/schemas.py. */

export type OrbixMode = "auto" | "erp_qa" | "khata" | "code" | "report";

export type OrbixSourceType =
  | "code"
  | "ledger"
  | "memory"
  | "web"
  | "generated"
  | "navigation";

export interface OrbixEvidenceRef {
  id: string;
  source_type: OrbixSourceType;
  uri: string;
  title?: string;
  line_start?: number;
  line_end?: number;
  content_hash?: string;
  snippet?: string;
}

export interface OrbixToolTrace {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
  evidence_ids: string[];
  summary?: string;
  error?: string;
}

export interface OrbixChatRequest {
  message: string;
  session_id: string;
  user_id?: string;
  company_id?: string;
  current_route?: string;
  screen_title?: string;
  mode?: OrbixMode;
  confirm_token?: string;
  confirmation_payload?: Record<string, unknown>;
}

export interface OrbixChatResponse {
  answer: string;
  intent: string;
  confidence: number;
  evidence: OrbixEvidenceRef[];
  tool_trace: OrbixToolTrace[];
  needs_confirmation: boolean;
  confirmation_payload?: Record<string, unknown>;
  warnings: string[];
  session_id: string;
  engine: string;
}

/** orbix = full reasoning agent; builtin = Ollama down / model missing; offline = no backend. */
export type OrbixRuntimeMode = "orbix" | "builtin" | "offline";

export interface OrbixStatus {
  online: boolean;
  mode: OrbixRuntimeMode;
  ollama?: "reachable" | "unreachable";
  agentModel?: string;
  agentModelInstalled?: boolean;
  availableModels?: string[];
  error?: string;
}

export type OrbixStreamEvent =
  | { type: "tool"; tool: OrbixToolTrace }
  | { type: "answer"; response: OrbixChatResponse }
  | { type: "done" }
  | { type: "error"; message: string };
