/**
 * NIOS unified session — single session ID across Sutra AI, e-Khata, Falcon.
 */

const NIOS_SESSION_KEY = "nios_session_id";
const NIOS_TENANT_KEY = "nios_tenant_id";
const NIOS_COMPANY_KEY = "nios_company_id";
const LEGACY_ERP_BOT_KEY = "erp_bot_session_id";

export interface NiosSessionScope {
  sessionId: string;
  tenantId?: string;
  companyId?: string;
}

export function isNiosPlatformEnabled(): boolean {
  const flag = import.meta.env.VITE_NIOS_PLATFORM_V3 as string | undefined;
  return flag === "true" || flag === "1";
}

export function getNiosSessionId(): string {
  if (typeof localStorage === "undefined") return crypto.randomUUID();

  let id = localStorage.getItem(NIOS_SESSION_KEY);
  if (!id) {
    const legacy = localStorage.getItem(LEGACY_ERP_BOT_KEY);
    id = legacy || crypto.randomUUID();
    localStorage.setItem(NIOS_SESSION_KEY, id);
    if (!legacy) localStorage.setItem(LEGACY_ERP_BOT_KEY, id);
  }
  return id;
}

export function setNiosSessionId(sessionId: string): void {
  localStorage.setItem(NIOS_SESSION_KEY, sessionId);
  localStorage.setItem(LEGACY_ERP_BOT_KEY, sessionId);
}

export function getNiosTenantId(): string | undefined {
  return localStorage.getItem(NIOS_TENANT_KEY) || undefined;
}

export function setNiosTenantId(tenantId: string): void {
  localStorage.setItem(NIOS_TENANT_KEY, tenantId);
}

export function getNiosCompanyId(): string | undefined {
  return localStorage.getItem(NIOS_COMPANY_KEY) || undefined;
}

export function setNiosCompanyId(companyId: string): void {
  localStorage.setItem(NIOS_COMPANY_KEY, companyId);
}

export function getNiosSessionScope(): NiosSessionScope {
  return {
    sessionId: getNiosSessionId(),
    tenantId: getNiosTenantId(),
    companyId: getNiosCompanyId(),
  };
}

export function clearNiosSession(): void {
  localStorage.removeItem(NIOS_SESSION_KEY);
  localStorage.removeItem(LEGACY_ERP_BOT_KEY);
}
