import type { AiRuntimeRequest } from "../types";

let turnCounter = 0;

export function nextTurnId(sessionId: string): string {
  turnCounter += 1;
  return `${sessionId}-turn-${turnCounter}`;
}

export function resetTurnCounter(): void {
  turnCounter = 0;
}

export interface TurnRecord {
  readonly turnId: string;
  readonly sessionId: string;
  readonly request: AiRuntimeRequest;
  readonly startedAt: string;
  completedAt?: string;
}

const activeTurns = new Map<string, TurnRecord>();

export function beginTurn(request: AiRuntimeRequest): TurnRecord {
  const turn: TurnRecord = {
    turnId: nextTurnId(request.sessionId),
    sessionId: request.sessionId,
    request,
    startedAt: new Date().toISOString(),
  };
  activeTurns.set(turn.turnId, turn);
  return turn;
}

export function completeTurn(turnId: string): TurnRecord | undefined {
  const turn = activeTurns.get(turnId);
  if (!turn) return undefined;
  const completed = { ...turn, completedAt: new Date().toISOString() };
  activeTurns.set(turnId, completed);
  return completed;
}

export function getActiveTurn(turnId: string): TurnRecord | undefined {
  return activeTurns.get(turnId);
}

export function resetTurnManager(): void {
  activeTurns.clear();
  resetTurnCounter();
}
