type HookHandler = (payload: Record<string, unknown>) => void | Promise<void>;

const hooks = new Map<string, HookHandler[]>();

export function registerHook(extensionPoint: string, handler: HookHandler): void {
  const list = hooks.get(extensionPoint) ?? [];
  list.push(handler);
  hooks.set(extensionPoint, list);
}

export function unregisterHooks(extensionPoint: string): void {
  hooks.delete(extensionPoint);
}

export async function invokeHooks(
  extensionPoint: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const list = hooks.get(extensionPoint) ?? [];
  for (const handler of list) {
    await handler(payload);
  }
}

export function listRegisteredHooks(): string[] {
  return Array.from(hooks.keys());
}
