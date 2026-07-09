/**
 * Nepal Universal AI — end-to-end e-KHATA conversation scenarios
 * (onboarding, daily recording, Q&A, error correction, reports).
 */

import {
  CONVERSATION_SCENARIOS,
  CONVERSATION_SCENARIOS_BY_TYPE,
  CONVERSATION_SCENARIO_USER_TURNS,
  type ConversationScenario,
} from "./generated/runtimeMaps";

const BY_ID = new Map(CONVERSATION_SCENARIOS.map((s) => [s.id, s]));

function normalizeTurn(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function getConversationScenario(id: string): ConversationScenario | null {
  return BY_ID.get(id) ?? null;
}

export function listConversationScenariosByType(
  scenarioType: string,
): ConversationScenario[] {
  const ids = CONVERSATION_SCENARIOS_BY_TYPE[scenarioType] ?? [];
  return ids.map((id) => BY_ID.get(id)).filter(Boolean) as ConversationScenario[];
}

/** Match a user utterance to a golden scenario (exact normalized turn). */
export function matchConversationScenarioByUserTurn(
  text: string,
): ConversationScenario | null {
  if (!text?.trim()) return null;
  const key = normalizeTurn(text);
  const id =
    CONVERSATION_SCENARIO_USER_TURNS[key] ||
    CONVERSATION_SCENARIO_USER_TURNS[text.trim()];
  return id ? getConversationScenario(id) : null;
}

/** Sample AI reply from scenarios of a given type (round-robin by type). */
const ROTATION = new Map<string, number>();

export function sampleScenarioAiReply(
  scenarioType: string,
  opts?: { preferTurnIndex?: number },
): string | null {
  const scenes = listConversationScenariosByType(scenarioType);
  if (!scenes.length) return null;
  const idx = ROTATION.get(scenarioType) ?? 0;
  ROTATION.set(scenarioType, idx + 1);
  const scene = scenes[idx % scenes.length];
  const aiTurns = scene.conversation.filter((t) => t.role === "ai");
  if (!aiTurns.length) return null;
  const turnIdx =
    opts?.preferTurnIndex != null
      ? Math.min(opts.preferTurnIndex, aiTurns.length - 1)
      : 0;
  return aiTurns[turnIdx]?.text ?? null;
}

export function allConversationScenarioTypes(): string[] {
  return Object.keys(CONVERSATION_SCENARIOS_BY_TYPE).sort();
}

export type { ConversationScenario };
