let commandBusDepth = 0;

export function runInCommandBusContext<T>(fn: () => T): T {
  commandBusDepth += 1;
  try {
    return fn();
  } finally {
    commandBusDepth -= 1;
  }
}

export async function runInCommandBusContextAsync<T>(fn: () => Promise<T>): Promise<T> {
  commandBusDepth += 1;
  try {
    return await fn();
  } finally {
    commandBusDepth -= 1;
  }
}

export function isInCommandBusContext(): boolean {
  return commandBusDepth > 0;
}
