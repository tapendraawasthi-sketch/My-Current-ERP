export interface JwtHeader {
  alg?: string;
  typ?: string;
}

export interface DecodedJwt<TPayload = Record<string, unknown>> {
  header: JwtHeader;
  payload: TPayload;
  signature: string;
  raw: string;
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  try {
    return atob(padded + pad);
  } catch {
    return "";
  }
}

export function parseJwt<TPayload = Record<string, unknown>>(token: string): DecodedJwt<TPayload> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const header = JSON.parse(base64UrlDecode(parts[0])) as JwtHeader;
    const payload = JSON.parse(base64UrlDecode(parts[1])) as TPayload;
    return {
      header,
      payload,
      signature: parts[2] ?? "",
      raw: token,
    };
  } catch {
    return null;
  }
}

export function isJwtExpired(payload: { exp?: number }, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (!payload.exp) return false;
  return payload.exp <= nowSeconds;
}

export function getJwtSubject(payload: { sub?: unknown }): string | null {
  return typeof payload.sub === "string" ? payload.sub : null;
}

export function getJwtTenantId(payload: { tenantId?: unknown }): string | null {
  return typeof payload.tenantId === "string" ? payload.tenantId : null;
}
