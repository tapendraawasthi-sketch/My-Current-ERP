/** SUTRA AI — product catalog with aliases (kakro, kaakro, etc.) */

import productAliases from "@/data/erp/product-aliases.json";
import unitMappings from "@/data/erp/unit-mappings.json";
import { matchRetailItem } from "@/lib/nepal-ai/retailItems";

type ProductEntry = {
  romanVariants: string[];
  english: string;
  category: string;
  unit: string[];
  commonMisspellings: string[];
  frequency: number;
};

export class ProductCatalog {
  private products: Record<string, ProductEntry>;

  constructor() {
    this.products = productAliases.vegetables as Record<string, ProductEntry>;
  }

  findProduct(query: string, sectorCue?: string): {
    nepali: string;
    entry: ProductEntry;
    confidence: number;
  } | null {
    const lower = query.toLowerCase();

    for (const [nepali, entry] of Object.entries(this.products)) {
      const allForms = [
        ...entry.romanVariants,
        ...entry.commonMisspellings,
        entry.english.toLowerCase(),
      ];
      if (allForms.some((f) => f === lower)) {
        return { nepali, entry, confidence: 0.95 };
      }
    }

    const retailMatch = matchRetailItem(query);
    if (retailMatch) {
      return {
        nepali: retailMatch.entry?.item ?? retailMatch.canonical,
        entry: {
          romanVariants: [retailMatch.matched],
          english: retailMatch.canonical,
          category: retailMatch.sector,
          unit: retailMatch.typicalUnit ? [retailMatch.typicalUnit] : ["piece"],
          commonMisspellings: [],
          frequency: 0.7,
        },
        confidence: 0.8,
      };
    }

    return null;
  }

  validateUnit(productCategory: string, unit: string): boolean {
    const compat = unitMappings.productUnitCompatibility as Record<string, string[]>;
    const allowed = compat[productCategory] ?? compat.countable ?? [];
    const normalized = unit.toLowerCase();
    return allowed.some((u) => u === normalized || normalized.includes(u));
  }

  getProductsByCategory(category: string): Array<{ nepali: string; entry: ProductEntry }> {
    return Object.entries(this.products)
      .filter(([, e]) => e.category === category)
      .map(([nepali, entry]) => ({ nepali, entry }));
  }
}

export const productCatalog = new ProductCatalog();
