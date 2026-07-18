import type { BalanceSummaryData, KhataConfirmationCard } from "../types";
import { COMPANY_ID, TENANT_ID, USER_ID } from "../types";
import { createIdempotencyKey, enqueueTransaction, replayQueue } from "../lib/offlineQueue";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = import.meta.env.VITE_KHATA_ACCESS_TOKEN as string | undefined;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new Error(body.error ?? "Request failed");
  }
  return body.data as T;
}

function isOfflineError(error: unknown): boolean {
  return !navigator.onLine || (error instanceof TypeError && error.message.includes("fetch"));
}

async function postConfirmPayload(payload: Record<string, unknown>) {
  return request<{ voucher_id: string }>("/api/khata/confirm", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function parseTransaction(raw_text: string) {
  return request<{ card?: KhataConfirmationCard; clarifying_question?: string }>(
    "/api/khata/transaction",
    {
      method: "POST",
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        company_id: COMPANY_ID,
        user_id: USER_ID,
        raw_text,
      }),
    },
  );
}

export async function confirmTransaction(
  card: KhataConfirmationCard,
  idempotencyKey?: string,
): Promise<{ offline: boolean; voucher_id?: string }> {
  const key = idempotencyKey ?? createIdempotencyKey();
  const payload = {
    tenant_id: TENANT_ID,
    company_id: COMPANY_ID,
    user_id: USER_ID,
    ...card,
    client_idempotency_key: key,
  };

  if (!navigator.onLine) {
    await enqueueTransaction(key, payload);
    return { offline: true };
  }

  try {
    const result = await postConfirmPayload(payload);
    return { offline: false, voucher_id: result.voucher_id };
  } catch (error) {
    if (isOfflineError(error)) {
      await enqueueTransaction(key, payload);
      return { offline: true };
    }
    throw error;
  }
}

export async function syncOfflineQueue(): Promise<number> {
  if (!navigator.onLine) return 0;
  return replayQueue(async (payload) => {
    await postConfirmPayload(payload);
  });
}

export async function fetchBalance(): Promise<BalanceSummaryData> {
  const params = new URLSearchParams({
    tenant_id: TENANT_ID,
    company_id: COMPANY_ID,
  });
  return request<BalanceSummaryData>(`/api/khata/balance?${params.toString()}`);
}

export async function fetchInsights() {
  const params = new URLSearchParams({
    tenant_id: TENANT_ID,
    company_id: COMPANY_ID,
  });
  return request<{ insights: Array<{ id: string; type: string; message: string; party_name?: string }> }>(
    `/api/khata/insights?${params.toString()}`,
  );
}
