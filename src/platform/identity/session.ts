const SESSION_USER_KEY = "sutra_user_id";
const SESSION_COMPANY_KEY = "sutra_company_id";
const ACCESS_TOKEN_KEY = "sutra_access_token";

export interface LegacySessionSnapshot {
  userId: string | null;
  companyId: string | null;
  accessToken: string | null;
}

export function readLegacySession(): LegacySessionSnapshot {
  try {
    return {
      userId: sessionStorage.getItem(SESSION_USER_KEY),
      companyId: sessionStorage.getItem(SESSION_COMPANY_KEY),
      accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    };
  } catch {
    return { userId: null, companyId: null, accessToken: null };
  }
}

export function writeLegacySession(userId: string, companyId: string): void {
  sessionStorage.setItem(SESSION_USER_KEY, userId);
  sessionStorage.setItem(SESSION_COMPANY_KEY, companyId);
}

export function clearLegacySession(): void {
  sessionStorage.removeItem(SESSION_USER_KEY);
  sessionStorage.removeItem(SESSION_COMPANY_KEY);
}

export function readAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function createSessionId(): string {
  return crypto.randomUUID();
}
