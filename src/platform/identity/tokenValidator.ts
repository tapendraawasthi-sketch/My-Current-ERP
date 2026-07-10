import type { ITokenValidator, ITokenValidationResult, IJwtPayload } from "@fios/kernel";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { claimsFromJwtPayload } from "./claims";
import { isJwtExpired, parseJwt } from "./jwt";

export class ClientTokenValidator implements ITokenValidator {
  validateAccessToken(token: string): ITokenValidationResult {
    if (!token) {
      return { valid: false, error: "Token is empty" };
    }

    const decoded = parseJwt<IJwtPayload>(token);
    if (!decoded) {
      return { valid: false, error: "Malformed JWT" };
    }

    const claims = claimsFromJwtPayload(decoded.payload as Record<string, unknown>);
    if (!claims) {
      return { valid: false, error: "JWT missing required claims (sub, tenantId)" };
    }

    if (decoded.payload.type === "refresh") {
      return { valid: false, error: "Refresh token cannot be used as access token" };
    }

    if (isMigrationFlagEnabled("MIGRATION_JWT_VALIDATION") && isJwtExpired(decoded.payload)) {
      return { valid: false, error: "JWT expired" };
    }

    return { valid: true, payload: { ...decoded.payload, ...claims } };
  }

  validateRefreshToken(token: string): ITokenValidationResult {
    const result = this.validateAccessToken(token);
    if (!result.valid) return result;
    if (result.payload?.type !== "refresh") {
      return { valid: false, error: "Not a refresh token" };
    }
    return result;
  }
}

let validatorInstance: ITokenValidator | null = null;

export function getTokenValidator(): ITokenValidator {
  if (!validatorInstance) {
    validatorInstance = new ClientTokenValidator();
  }
  return validatorInstance;
}

export function resetTokenValidator(): void {
  validatorInstance = null;
}
