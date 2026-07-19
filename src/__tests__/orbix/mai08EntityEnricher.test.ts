import { describe, expect, it } from "vitest";
import {
  EntityEnricher,
  MAI08_ITEM_SCORE_FLOOR,
  MAI08_MIN_SCORE_GAP,
  MAI08_PARTY_SCORE_FLOOR,
} from "../../ai/rag/EntityEnricher";
import type { ErpItemRef, ErpPartyRef, ErpRagContext } from "../../ai/types";

const enricher = new EntityEnricher();

function ctx(parties: ErpPartyRef[], items: ErpItemRef[] = []): ErpRagContext {
  return { parties, items };
}

describe("MAI-08 EntityEnricher abstention (ADR_0025)", () => {
  it("exports tightened floors", () => {
    expect(MAI08_PARTY_SCORE_FLOOR).toBe(0.75);
    expect(MAI08_ITEM_SCORE_FLOOR).toBe(0.78);
    expect(MAI08_MIN_SCORE_GAP).toBe(0.12);
  });

  it("does not silent-bind close party names (Ram Traders vs Ram Trade)", () => {
    const parties: ErpPartyRef[] = [
      { id: "p1", name: "Ram Traders" },
      { id: "p2", name: "Ram Trade" },
    ];
    const out = enricher.enrich({ party: "Ram Traders" }, "Ram Traders", ctx(parties));
    expect(out.partyId).toBeUndefined();
    expect(out.partyAmbiguous?.length).toBeGreaterThanOrEqual(2);
  });

  it("does not silent-bind short ambiguous party query 'ram'", () => {
    const parties: ErpPartyRef[] = [
      { id: "p1", name: "Ram Traders" },
      { id: "p2", name: "Ram Trade" },
    ];
    const out = enricher.enrich({ party: "ram" }, "ram bata 100", ctx(parties));
    expect(out.partyId).toBeUndefined();
    expect(out.partyAmbiguous?.length).toBeGreaterThanOrEqual(2);
  });

  it("binds unique high-confidence party", () => {
    const parties: ErpPartyRef[] = [
      { id: "p5", name: "Unique Party Only" },
      { id: "p6", name: "Completely Different Co" },
    ];
    const out = enricher.enrich(
      { party: "Unique Party Only" },
      "Unique Party Only",
      ctx(parties),
    );
    expect(out.partyId).toBe("p5");
    expect(out.partyAmbiguous).toBeUndefined();
  });

  it("does not silent-bind close item names", () => {
    const items: ErpItemRef[] = [
      { id: "i1", name: "Sunflower Oil", saleRate: 200 },
      { id: "i2", name: "Sunflower Oil 1L", saleRate: 210 },
    ];
    const out = enricher.enrich(
      { product: "Sunflower Oil" },
      "Sunflower Oil",
      ctx([], items),
    );
    expect(out.itemId).toBeUndefined();
    expect(out.itemAmbiguous?.length).toBeGreaterThanOrEqual(2);
  });

  it("binds unique high-confidence item", () => {
    const items: ErpItemRef[] = [
      { id: "i5", name: "Unique Widget X", saleRate: 10 },
      { id: "i6", name: "Other Product Y", saleRate: 11 },
    ];
    const out = enricher.enrich(
      { product: "Unique Widget X" },
      "Unique Widget X",
      ctx([], items),
    );
    expect(out.itemId).toBe("i5");
    expect(out.itemAmbiguous).toBeUndefined();
  });

  it("abstains on OOD / unknown party (no silent bind)", () => {
    const parties: ErpPartyRef[] = [
      { id: "p1", name: "Ram Traders" },
      { id: "p2", name: "Sita Store" },
    ];
    const out = enricher.enrich(
      { party: "Zorblax Industries" },
      "Zorblax Industries",
      ctx(parties),
    );
    expect(out.partyId).toBeUndefined();
  });
});
