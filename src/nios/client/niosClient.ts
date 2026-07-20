/**
 * NIOS HTTP client — gateway at /nios/v1
 */

import { resolveErpBotUrl } from "../../lib/erpBotClient";
import type { NiosChatRequest, NiosChatResponse } from "../contracts/types";
import { getNiosSessionScope, isNiosPlatformEnabled } from "../session";

export function resolveNiosUrl(): string {
  const base = resolveErpBotUrl().replace(/\/$/, "");
  return `${base}/nios/v1`;
}

export async function niosChat(req: Partial<NiosChatRequest> & { message: string }): Promise<NiosChatResponse> {
  const scope = getNiosSessionScope();
  const body: NiosChatRequest = {
    message: req.message,
    session_id: req.session_id || scope.sessionId,
    tenant_id: req.tenant_id || scope.tenantId,
    company_id: req.company_id || scope.companyId,
    user_id: req.user_id,
    balance: req.balance,
    language: req.language,
    context: req.context,
  };

  const res = await fetch(`${resolveNiosUrl()}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`NIOS chat failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<NiosChatResponse>;
}

export async function niosStatus(): Promise<Record<string, unknown>> {
  const res = await fetch(`${resolveNiosUrl()}/status`);
  if (!res.ok) throw new Error(`NIOS status failed: ${res.status}`);
  return res.json();
}

export async function niosListCapabilities(): Promise<Record<string, unknown>> {
  const res = await fetch(`${resolveNiosUrl()}/capabilities`);
  if (!res.ok) throw new Error(`NIOS capabilities failed: ${res.status}`);
  return res.json();
}

export interface NiosSimulateRequest {
  basic_salary: number;
  increase_percent: number;
  gross_salary?: number;
  marital_status?: string;
  cash_balance?: number;
  session_id?: string;
}

export async function niosSimulate(req: NiosSimulateRequest): Promise<Record<string, unknown>> {
  const res = await fetch(`${resolveNiosUrl()}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`NIOS simulate failed: ${res.status}`);
  return res.json();
}

export async function niosScenario(req: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${resolveNiosUrl()}/scenario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`NIOS scenario failed: ${res.status}`);
  return res.json();
}

export async function niosListSkills(): Promise<Record<string, unknown>> {
  const res = await fetch(`${resolveNiosUrl()}/skills`);
  if (!res.ok) throw new Error(`NIOS skills failed: ${res.status}`);
  return res.json();
}

export async function niosWorldStateQuery(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${resolveNiosUrl()}/world-state/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`NIOS world-state failed: ${res.status}`);
  return res.json();
}

export async function niosDigitalTwin(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${resolveNiosUrl()}/digital-twin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`NIOS digital-twin failed: ${res.status}`);
  return res.json();
}

export async function niosPredict(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${resolveNiosUrl()}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`NIOS predict failed: ${res.status}`);
  return res.json();
}

export async function niosOcrInvoice(text: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${resolveNiosUrl()}/ocr/invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`NIOS OCR failed: ${res.status}`);
  return res.json();
}

/** Upload a document/bill photo for OCR → draft fields (never posts ledger). */
export async function niosOcrInvoiceImage(file: File): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.append("file", file, file.name || "document.jpg");
  const res = await fetch(`${resolveNiosUrl()}/ocr/invoice/image`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`NIOS OCR image failed: ${res.status}`);
  return res.json();
}

export async function niosRunBenchmarks(): Promise<Record<string, unknown>> {
  const res = await fetch(`${resolveNiosUrl()}/benchmarks/nightly/run`, { method: "POST" });
  if (!res.ok) throw new Error(`NIOS benchmarks failed: ${res.status}`);
  return res.json();
}

export async function niosPublicApi(): Promise<Record<string, unknown>> {
  const res = await fetch(`${resolveNiosUrl()}/public/v1`);
  if (!res.ok) throw new Error(`NIOS public API failed: ${res.status}`);
  return res.json();
}

export async function niosLegalSearch(query: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${resolveNiosUrl()}/legal/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`NIOS legal search failed: ${res.status}`);
  return res.json();
}

export async function niosConsultantCompose(goal: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${resolveNiosUrl()}/consultant/compose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal }),
  });
  if (!res.ok) throw new Error(`NIOS consultant failed: ${res.status}`);
  return res.json();
}

export async function niosMarketplaceCatalog(): Promise<Record<string, unknown>> {
  const res = await fetch(`${resolveNiosUrl()}/marketplace/catalog`);
  if (!res.ok) throw new Error(`NIOS catalog failed: ${res.status}`);
  return res.json();
}

export { isNiosPlatformEnabled };
