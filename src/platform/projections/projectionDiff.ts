export interface ProjectionDiffEntry {
  path: string;
  legacy: unknown;
  projection: unknown;
}

export function diffValues(
  legacy: unknown,
  projection: unknown,
  path = "root",
  tolerance = 0.01,
): ProjectionDiffEntry[] {
  const diffs: ProjectionDiffEntry[] = [];

  if (typeof legacy === "number" && typeof projection === "number") {
    if (Math.abs(legacy - projection) > tolerance) {
      diffs.push({ path, legacy, projection });
    }
    return diffs;
  }

  if (Array.isArray(legacy) && Array.isArray(projection)) {
    const maxLen = Math.max(legacy.length, projection.length);
    for (let i = 0; i < maxLen; i++) {
      diffs.push(...diffValues(legacy[i], projection[i], `${path}[${i}]`, tolerance));
    }
    return diffs;
  }

  if (
    legacy !== null &&
    projection !== null &&
    typeof legacy === "object" &&
    typeof projection === "object"
  ) {
    const keys = new Set([
      ...Object.keys(legacy as object),
      ...Object.keys(projection as object),
    ]);
    for (const key of keys) {
      diffs.push(
        ...diffValues(
          (legacy as Record<string, unknown>)[key],
          (projection as Record<string, unknown>)[key],
          `${path}.${key}`,
          tolerance,
        ),
      );
    }
    return diffs;
  }

  if (legacy !== projection) {
    diffs.push({ path, legacy, projection });
  }
  return diffs;
}

export function summarizeDiff(diffs: ProjectionDiffEntry[]): string {
  if (diffs.length === 0) return "no differences";
  return diffs
    .slice(0, 5)
    .map((d) => `${d.path}: legacy=${String(d.legacy)} projection=${String(d.projection)}`)
    .join("; ");
}
