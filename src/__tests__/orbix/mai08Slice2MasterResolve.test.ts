import { describe, expect, it } from "vitest";
import { resolveUniqueParty, resolveUniqueItem } from "../../ai/rag/mai08MasterResolve";
import { resolvePartyPhone } from "../../ai/context/PartyPhoneResolver";
import type { ErpItemRef, ErpPartyRef } from "../../ai/types";

describe("MAI-08 slice 2 master resolve / phone / posting abstention", () => {
  it("abstains on close party names for phone resolve", () => {
    const parties: ErpPartyRef[] = [
      { id: "p1", name: "Ram Traders", phone: "9801111111" },
      { id: "p2", name: "Ram Trade", phone: "9802222222" },
    ];
    expect(resolvePartyPhone("Ram Traders", { parties })).toBeUndefined();
    expect(resolveUniqueParty("ram", parties).status).toBe("abstain");
  });

  it("binds unique party for phone resolve", () => {
    const parties: ErpPartyRef[] = [
      { id: "p5", name: "Unique Party Only", phone: "9803333333" },
      { id: "p6", name: "Completely Different Co", phone: "9804444444" },
    ];
    const phone = resolvePartyPhone("Unique Party Only", { parties });
    expect(phone).toBe("9779803333333");
    expect(resolveUniqueParty("Unique Party Only", parties).status).toBe("bound");
  });

  it("abstains on OOD party", () => {
    const parties: ErpPartyRef[] = [
      { id: "p1", name: "Ram Traders", phone: "9801111111" },
    ];
    expect(resolvePartyPhone("Zorblax Industries", { parties })).toBeUndefined();
    expect(resolveUniqueParty("Zorblax Industries", parties).status).toBe("abstain");
  });

  it("abstains on close item names", () => {
    const items: ErpItemRef[] = [
      { id: "i1", name: "Sunflower Oil", saleRate: 200 },
      { id: "i2", name: "Sunflower Oil 1L", saleRate: 210 },
    ];
    const r = resolveUniqueItem("Sunflower Oil", items);
    expect(r.status).toBe("abstain");
  });

  it("binds unique item", () => {
    const items: ErpItemRef[] = [
      { id: "i5", name: "Unique Widget X", saleRate: 10 },
      { id: "i6", name: "Other Product Y", saleRate: 11 },
    ];
    const r = resolveUniqueItem("Unique Widget X", items);
    expect(r.status).toBe("bound");
    if (r.status === "bound") expect(r.hit.ref.id).toBe("i5");
  });
});
