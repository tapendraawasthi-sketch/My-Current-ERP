/** Browser stub — vocabulary loader uses import.meta.glob in Vite; fs is never called. */
export function readFileSync(): never {
  throw new Error("node:fs is not available in the browser");
}

export function readdirSync(): never {
  throw new Error("node:fs is not available in the browser");
}
