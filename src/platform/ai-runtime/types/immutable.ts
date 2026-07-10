/** Deep-freeze helper — all pipeline stage outputs must be immutable. */

export type DeepReadonly<T> = T extends (...args: unknown[]) => unknown
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

export function deepFreeze<T extends object>(obj: T): DeepReadonly<T> {
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value as object);
    }
  }
  return obj as DeepReadonly<T>;
}

export function createImmutable<T extends object>(obj: T): DeepReadonly<T> {
  return deepFreeze({ ...obj });
}
