import type { IMemoryStore } from "../contracts/memoryContract";
import { WorkingMemory } from "./workingMemory";
import { ConversationMemory } from "./conversationMemory";
import { BusinessMemory } from "./businessMemory";
import { LongTermMemoryInterface } from "./longTermMemoryInterface";

let memoryStore: IMemoryStore | null = null;

export function getMemoryStore(): IMemoryStore {
  if (!memoryStore) {
    memoryStore = {
      working: new WorkingMemory(),
      conversation: new ConversationMemory(),
      business: new BusinessMemory(),
      longTerm: new LongTermMemoryInterface(),
    };
  }
  return memoryStore;
}

export function resetMemoryStore(): void {
  memoryStore = null;
}

export { WorkingMemory } from "./workingMemory";
export { ConversationMemory } from "./conversationMemory";
export { BusinessMemory } from "./businessMemory";
export { LongTermMemoryInterface } from "./longTermMemoryInterface";
