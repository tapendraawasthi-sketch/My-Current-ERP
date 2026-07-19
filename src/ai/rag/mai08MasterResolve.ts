/** MAI-08 — shared high-risk master resolve / abstention helpers (ADR_0025). */

import type { ErpItemRef, ErpPartyRef, RagMatch } from "../types";
import { erpRagRetriever } from "./ErpRagRetriever";
import {
  MAI08_ITEM_SCORE_FLOOR,
  MAI08_MIN_SCORE_GAP,
  MAI08_PARTY_SCORE_FLOOR,
} from "./EntityEnricher";

export type MasterResolveResult<T> =
  | { status: "bound"; hit: RagMatch<T> }
  | { status: "abstain"; reason: "below_floor" | "ambiguous" | "no_hits"; candidates: RagMatch<T>[] };

function decideUnique<T>(
  hits: RagMatch<T>[],
  floor: number,
): MasterResolveResult<T> {
  const top = hits[0];
  if (!top || top.score < floor) {
    return { status: "abstain", reason: top ? "below_floor" : "no_hits", candidates: hits };
  }
  const closeSecond =
    hits.length > 1 &&
    hits[1].score >= floor &&
    top.score - hits[1].score < MAI08_MIN_SCORE_GAP;
  if (closeSecond) {
    return { status: "abstain", reason: "ambiguous", candidates: hits.slice(0, 3) };
  }
  return { status: "bound", hit: top };
}

/** Unique party bind under MAI-08 floors; otherwise abstain. */
export function resolveUniqueParty(
  query: string,
  parties: ErpPartyRef[] = [],
): MasterResolveResult<ErpPartyRef> {
  const hits = erpRagRetriever.findParties(query, parties, 4);
  return decideUnique(hits, MAI08_PARTY_SCORE_FLOOR);
}

/** Unique item bind under MAI-08 floors; otherwise abstain. */
export function resolveUniqueItem(
  query: string,
  items: ErpItemRef[] = [],
): MasterResolveResult<ErpItemRef> {
  const hits = erpRagRetriever.findItems(query, items, 3);
  return decideUnique(hits, MAI08_ITEM_SCORE_FLOOR);
}
