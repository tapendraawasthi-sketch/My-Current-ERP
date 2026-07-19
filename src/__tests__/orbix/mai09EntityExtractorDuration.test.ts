import { describe, expect, it } from "vitest";
import { EntityExtractor } from "../../ai/context/EntityExtractor";

const extractor = new EntityExtractor();

describe("MAI-09 EntityExtractor duration before money", () => {
  it("does not treat '5 maina ko' as amount", () => {
    const entities = extractor.extract("maile ghar bhada tirnu xa 5 maina ko");
    expect(entities.amount).toBeUndefined();
  });

  it("still parses plain '500 ko' as amount", () => {
    const entities = extractor.extract("ram lai 500 ko tiryo");
    expect(entities.amount).toBe(500);
  });

  it("expands '5 hajar' and '2 lakh' to amounts", () => {
    expect(extractor.extract("ram lai 5 hajar tiryo").amount).toBe(5000);
    expect(extractor.extract("sale 2 lakh cash").amount).toBe(200000);
  });

  it("keeps duration and word-numeral amount together", () => {
    const entities = extractor.extract("5 maina ko rent 2 lakh due");
    expect(entities.amount).toBe(200000);
  });
});
