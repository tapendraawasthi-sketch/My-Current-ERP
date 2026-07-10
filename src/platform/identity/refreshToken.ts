import type { IRefreshTokenStore } from "@fios/kernel";

const REFRESH_TOKEN_KEY = "sutra_refresh_token";

export class LocalRefreshTokenStore implements IRefreshTokenStore {
  getRefreshToken(): string | null {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  setRefreshToken(token: string): void {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  }

  clearRefreshToken(): void {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

let storeInstance: IRefreshTokenStore | null = null;

export function getRefreshTokenStore(): IRefreshTokenStore {
  if (!storeInstance) {
    storeInstance = new LocalRefreshTokenStore();
  }
  return storeInstance;
}

export function resetRefreshTokenStore(): void {
  storeInstance = null;
}

export interface RefreshTokenRotationResult {
  rotated: boolean;
  refreshToken: string | null;
}

export function readRefreshToken(): string | null {
  return getRefreshTokenStore().getRefreshToken();
}

export function clearRefreshTokens(): void {
  getRefreshTokenStore().clearRefreshToken();
}
