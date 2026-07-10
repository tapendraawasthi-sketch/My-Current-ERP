export const ConflictClassification = {
  NONE: "none",
  VERSION_MISMATCH: "version_mismatch",
  CONCURRENT_WRITE: "concurrent_write",
  AGGREGATE_DIVERGENCE: "aggregate_divergence",
  HASH_MISMATCH: "hash_mismatch",
  TENANT_MISMATCH: "tenant_mismatch",
  MANUAL_REQUIRED: "manual_required",
} as const;

export type ConflictClassification =
  (typeof ConflictClassification)[keyof typeof ConflictClassification];

export interface ConflictContext {
  eventId: string;
  aggregateId: string;
  aggregateType: string;
  localVersion: number;
  remoteVersion: number;
  localHash?: string;
  remoteHash?: string;
  localTenantId?: string;
  remoteTenantId?: string;
}

export interface DetectedConflict {
  classification: ConflictClassification;
  context: ConflictContext;
  lastCommonAncestorVersion?: number;
}

export function detectLastCommonAncestor(
  localVersion: number,
  remoteVersion: number,
): number {
  return Math.min(localVersion, remoteVersion);
}

export function detectConflict(ctx: ConflictContext): DetectedConflict {
  if (ctx.localTenantId && ctx.remoteTenantId && ctx.localTenantId !== ctx.remoteTenantId) {
    return {
      classification: ConflictClassification.TENANT_MISMATCH,
      context: ctx,
    };
  }

  if (ctx.localHash && ctx.remoteHash && ctx.localHash !== ctx.remoteHash) {
    if (ctx.localVersion === ctx.remoteVersion) {
      return {
        classification: ConflictClassification.HASH_MISMATCH,
        context: ctx,
        lastCommonAncestorVersion: detectLastCommonAncestor(ctx.localVersion, ctx.remoteVersion),
      };
    }
  }

  if (ctx.localVersion === ctx.remoteVersion) {
    return {
      classification: ConflictClassification.NONE,
      context: ctx,
      lastCommonAncestorVersion: ctx.localVersion,
    };
  }

  if (Math.abs(ctx.localVersion - ctx.remoteVersion) === 1) {
    return {
      classification: ConflictClassification.VERSION_MISMATCH,
      context: ctx,
      lastCommonAncestorVersion: detectLastCommonAncestor(ctx.localVersion, ctx.remoteVersion),
    };
  }

  return {
    classification: ConflictClassification.CONCURRENT_WRITE,
    context: ctx,
    lastCommonAncestorVersion: detectLastCommonAncestor(ctx.localVersion, ctx.remoteVersion),
  };
}
