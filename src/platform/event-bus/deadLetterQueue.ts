import type { IDomainEvent } from "@fios/kernel";
import { serializeEvent } from "./eventSerializer";

export interface DeadLetterEntry {
  id: string;
  event: IDomainEvent;
  handlerType: string;
  error: string;
  attempts: number;
  enqueuedAt: string;
  serializedEvent: string;
}

const MAX_DLQ = 1000;
const queue: DeadLetterEntry[] = [];

export function enqueueDeadLetter(
  event: IDomainEvent,
  handlerType: string,
  error: string,
  attempts: number,
): DeadLetterEntry {
  const entry: DeadLetterEntry = {
    id: crypto.randomUUID(),
    event,
    handlerType,
    error,
    attempts,
    enqueuedAt: new Date().toISOString(),
    serializedEvent: serializeEvent(event),
  };
  queue.push(entry);
  if (queue.length > MAX_DLQ) {
    queue.splice(0, queue.length - MAX_DLQ);
  }
  return entry;
}

export function listDeadLetters(): DeadLetterEntry[] {
  return [...queue];
}

export function clearDeadLetters(): void {
  queue.length = 0;
}

export function deadLetterCount(): number {
  return queue.length;
}
