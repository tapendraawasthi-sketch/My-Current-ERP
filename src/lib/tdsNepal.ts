// src/lib/tdsNepal.ts

export type TdsPersonType = "individual" | "entity";
export type TdsResidency = "resident" | "non-resident";

export interface NepalTdsRate {
  id: string;
  sectionCode: string;
  description: string;
  descriptionNepali: string;
  rate: number | null; // null for salary slab calculation
  thresholdAmount: number;
  isEntityRate: boolean;
  isIndividualRate: boolean;
  isNonResident: boolean;
  remarks?: string;
}

export interface SalarySlab {
  id: string;
  label: string;
  labelNepali: string;
  from: number;
  to: number | null;
  rate: number;
}

export interface NepalTdsCalculationInput {
  sectionId: string;
  grossAmount: number;
  personType?: TdsPersonType;
  residency?: TdsResidency;
  annualSalaryTaxableIncome?: number;
}

export interface NepalTdsCalculationResult {
  applicable: boolean;
  sectionId: string;
  sectionCode: string;
  description: string;
  descriptionNepali: string;
  grossAmount: number;
  thresholdAmount: number;
  rate: number;
  tdsAmount: number;
  netPayable: number;
  reason?: string;
}

export const NEPAL_TDS_RATES_2081_82: NepalTdsRate[] = [
  {
    id: "sec87_salary_slab",
    sectionCode: "87(1)(a)",
    description: "Salary income — tax deducted as per applicable individual slab",
    descriptionNepali: "तलब आय — लागू हुने व्यक्तिगत कर स्ल्याब अनुसार स्रोतमा कर कट्टी",
    rate: null,
    thresholdAmount: 0,
    isEntityRate: false,
    isIndividualRate: true,
    isNonResident: false,
    remarks: "Use annual salary slab calculation.",
  },
  {
    id: "sec87_contract_resident_1_5",
    sectionCode: "87(1)(b)",
    description: "Contract payments to resident person above Rs. 50,000",
    descriptionNepali: "रु. ५०,००० भन्दा बढी निवासी व्यक्तिलाई करार भुक्तानी",
    rate: 1.5,
    thresholdAmount: 50000,
    isEntityRate: true,
    isIndividualRate: true,
    isNonResident: false,
  },
  {
    id: "sec87_service_resident_individual_1_5",
    sectionCode: "87(1)(c)",
    description: "Service fees to resident individual",
    descriptionNepali: "निवासी प्राकृतिक व्यक्तिलाई सेवा शुल्क",
    rate: 1.5,
    thresholdAmount: 0,
    isEntityRate: false,
    isIndividualRate: true,
    isNonResident: false,
  },
  {
    id: "sec87_service_resident_entity_5",
    sectionCode: "87(1)(c)",
    description: "Service fees to resident entity",
    descriptionNepali: "निवासी निकायलाई सेवा शुल्क",
    rate: 5,
    thresholdAmount: 0,
    isEntityRate: true,
    isIndividualRate: false,
    isNonResident: false,
  },
  {
    id: "sec87_commission_discount_fee_individual_1_5",
    sectionCode: "87(1)(d)",
    description: "Commission, discount, fees to resident individual",
    descriptionNepali: "निवासी प्राकृतिक व्यक्तिलाई कमिशन, छुट वा शुल्क",
    rate: 1.5,
    thresholdAmount: 0,
    isEntityRate: false,
    isIndividualRate: true,
    isNonResident: false,
  },
  {
    id: "sec87_commission_discount_fee_entity_5",
    sectionCode: "87(1)(d)",
    description: "Commission, discount, fees to resident entity",
    descriptionNepali: "निवासी निकायलाई कमिशन, छुट वा शुल्क",
    rate: 5,
    thresholdAmount: 0,
    isEntityRate: true,
    isIndividualRate: false,
    isNonResident: false,
  },
  {
    id: "sec87_house_rent_10",
    sectionCode: "87(1)(e)",
    description: "House rent payment",
    descriptionNepali: "घर भाडा भुक्तानी",
    rate: 10,
    thresholdAmount: 0,
    isEntityRate: true,
    isIndividualRate: true,
    isNonResident: false,
  },
  {
    id: "sec87_bank_interest_5",
    sectionCode: "87(1)(f)",
    description: "Interest from bank",
    descriptionNepali: "बैंकबाट प्राप्त ब्याज",
    rate: 5,
    thresholdAmount: 0,
    isEntityRate: true,
    isIndividualRate: true,
    isNonResident: false,
  },
  {
    id: "sec87_dividend_resident_company_5",
    sectionCode: "87(1)(g)",
    description: "Dividend from resident company",
    descriptionNepali: "निवासी कम्पनीबाट प्राप्त लाभांश",
    rate: 5,
    thresholdAmount: 0,
    isEntityRate: true,
    isIndividualRate: true,
    isNonResident: false,
  },
  {
    id: "sec87_royalty_15",
    sectionCode: "87(1)(h)",
    description: "Royalty payment",
    descriptionNepali: "रोयल्टी भुक्तानी",
    rate: 15,
    thresholdAmount: 0,
    isEntityRate: true,
    isIndividualRate: true,
    isNonResident: false,
  },
  {
    id: "sec87_meeting_allowance_15",
    sectionCode: "87(1)(i)",
    description: "Meeting allowance",
    descriptionNepali: "बैठक भत्ता",
    rate: 15,
    thresholdAmount: 0,
    isEntityRate: true,
    isIndividualRate: true,
    isNonResident: false,
  },
  {
    id: "sec87_natural_resource_extraction_1_5",
    sectionCode: "87(2)",
    description: "Natural resource extraction payment",
    descriptionNepali: "प्राकृतिक स्रोत उत्खनन सम्बन्धी भुक्तानी",
    rate: 1.5,
    thresholdAmount: 0,
    isEntityRate: true,
    isIndividualRate: true,
    isNonResident: false,
  },

  // Section 88 — non-resident withholding categories
  {
    id: "sec88_nonresident_service_fee_15",
    sectionCode: "88",
    description: "Service fee paid to non-resident",
    descriptionNepali: "गैर-निवासीलाई सेवा शुल्क भुक्तानी",
    rate: 15,
    thresholdAmount: 0,
    isEntityRate: true,
    isIndividualRate: true,
    isNonResident: true,
  },
  {
    id: "sec88_nonresident_royalty_15",
    sectionCode: "88",
    description: "Royalty paid to non-resident",
    descriptionNepali: "गैर-निवासीलाई रोयल्टी भुक्तानी",
    rate: 15,
    thresholdAmount: 0,
    isEntityRate: true,
    isIndividualRate: true,
    isNonResident: true,
  },
  {
    id: "sec88_nonresident_interest_15",
    sectionCode: "88",
    description: "Interest paid to non-resident",
    descriptionNepali: "गैर-निवासीलाई ब्याज भुक्तानी",
    rate: 15,
    thresholdAmount: 0,
    isEntityRate: true,
    isIndividualRate: true,
    isNonResident: true,
  },
  {
    id: "sec88_nonresident_dividend_5",
    sectionCode: "88",
    description: "Dividend paid to non-resident",
    descriptionNepali: "गैर-निवासीलाई लाभांश भुक्तानी",
    rate: 5,
    thresholdAmount: 0,
    isEntityRate: true,
    isIndividualRate: true,
    isNonResident: true,
  },
  {
    id: "sec88_nonresident_rent_15",
    sectionCode: "88",
    description: "Rent paid to non-resident",
    descriptionNepali: "गैर-निवासीलाई भाडा भुक्तानी",
    rate: 15,
    thresholdAmount: 0,
    isEntityRate: true,
    isIndividualRate: true,
    isNonResident: true,
  },
  {
    id: "sec88_nonresident_commission_15",
    sectionCode: "88",
    description: "Commission paid to non-resident",
    descriptionNepali: "गैर-निवासीलाई कमिशन भुक्तानी",
    rate: 15,
    thresholdAmount: 0,
    isEntityRate: true,
    isIndividualRate: true,
    isNonResident: true,
  },
  {
    id: "sec88_nonresident_contract_15",
    sectionCode: "88",
    description: "Contract payment to non-resident",
    descriptionNepali: "गैर-निवासीलाई करार भुक्तानी",
    rate: 15,
    thresholdAmount: 0,
    isEntityRate: true,
    isIndividualRate: true,
    isNonResident: true,
  },
];

export const NEPAL_SALARY_TDS_SLABS_2081_82: SalarySlab[] = [
  {
    id: "salary_slab_1",
    label: "First slab",
    labelNepali: "पहिलो स्ल्याब",
    from: 0,
    to: 500000,
    rate: 1,
  },
  {
    id: "salary_slab_2",
    label: "Second slab",
    labelNepali: "दोस्रो स्ल्याब",
    from: 500000,
    to: 700000,
    rate: 10,
  },
  {
    id: "salary_slab_3",
    label: "Third slab",
    labelNepali: "तेस्रो स्ल्याब",
    from: 700000,
    to: 1000000,
    rate: 20,
  },
  {
    id: "salary_slab_4",
    label: "Fourth slab",
    labelNepali: "चौथो स्ल्याब",
    from: 1000000,
    to: 2000000,
    rate: 30,
  },
  {
    id: "salary_slab_5",
    label: "Additional slab",
    labelNepali: "अतिरिक्त स्ल्याब",
    from: 2000000,
    to: 5000000,
    rate: 36,
  },
  {
    id: "salary_slab_6",
    label: "Highest slab",
    labelNepali: "उच्चतम स्ल्याब",
    from: 5000000,
    to: null,
    rate: 39,
  },
];

export function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function getNepalTdsRate(sectionId: string): NepalTdsRate | undefined {
  return NEPAL_TDS_RATES_2081_82.find((rate) => rate.id === sectionId);
}

export function getApplicableNepalTdsRates(args?: {
  personType?: TdsPersonType;
  residency?: TdsResidency;
}): NepalTdsRate[] {
  return NEPAL_TDS_RATES_2081_82.filter((rate) => {
    if (args?.residency === "non-resident" && !rate.isNonResident) return false;
    if (args?.residency === "resident" && rate.isNonResident) return false;

    if (args?.personType === "individual" && !rate.isIndividualRate) return false;
    if (args?.personType === "entity" && !rate.isEntityRate) return false;

    return true;
  });
}

export function computeSalaryTdsAnnual(taxableAnnualSalary: number): number {
  let tax = 0;

  for (const slab of NEPAL_SALARY_TDS_SLABS_2081_82) {
    const upper = slab.to ?? Number.POSITIVE_INFINITY;

    if (taxableAnnualSalary <= slab.from) continue;

    const taxableInSlab = Math.min(taxableAnnualSalary, upper) - slab.from;
    tax += taxableInSlab * (slab.rate / 100);
  }

  return round2(tax);
}

export function calculateNepalTds(input: NepalTdsCalculationInput): NepalTdsCalculationResult {
  const rateDef = getNepalTdsRate(input.sectionId);

  if (!rateDef) {
    throw new Error(`Invalid Nepal TDS section: ${input.sectionId}`);
  }

  const grossAmount = round2(input.grossAmount);

  if (grossAmount <= 0) {
    return {
      applicable: false,
      sectionId: rateDef.id,
      sectionCode: rateDef.sectionCode,
      description: rateDef.description,
      descriptionNepali: rateDef.descriptionNepali,
      grossAmount,
      thresholdAmount: rateDef.thresholdAmount,
      rate: 0,
      tdsAmount: 0,
      netPayable: grossAmount,
      reason: "Gross amount is zero or negative.",
    };
  }

  if (grossAmount <= rateDef.thresholdAmount) {
    return {
      applicable: false,
      sectionId: rateDef.id,
      sectionCode: rateDef.sectionCode,
      description: rateDef.description,
      descriptionNepali: rateDef.descriptionNepali,
      grossAmount,
      thresholdAmount: rateDef.thresholdAmount,
      rate: rateDef.rate ?? 0,
      tdsAmount: 0,
      netPayable: grossAmount,
      reason: `TDS not applicable because payment does not exceed Rs. ${rateDef.thresholdAmount}.`,
    };
  }

  if (rateDef.rate === null) {
    const annualSalary = input.annualSalaryTaxableIncome ?? grossAmount;
    const annualTds = computeSalaryTdsAnnual(annualSalary);

    return {
      applicable: annualTds > 0,
      sectionId: rateDef.id,
      sectionCode: rateDef.sectionCode,
      description: rateDef.description,
      descriptionNepali: rateDef.descriptionNepali,
      grossAmount,
      thresholdAmount: rateDef.thresholdAmount,
      rate: 0,
      tdsAmount: annualTds,
      netPayable: round2(grossAmount - annualTds),
      reason: "Salary TDS calculated using annual slab.",
    };
  }

  const tdsAmount = round2(grossAmount * (rateDef.rate / 100));

  return {
    applicable: true,
    sectionId: rateDef.id,
    sectionCode: rateDef.sectionCode,
    description: rateDef.description,
    descriptionNepali: rateDef.descriptionNepali,
    grossAmount,
    thresholdAmount: rateDef.thresholdAmount,
    rate: rateDef.rate,
    tdsAmount,
    netPayable: round2(grossAmount - tdsAmount),
  };
}

// BS quarterly TDS return due dates
export type NepalQuarterKey = "Q1" | "Q2" | "Q3" | "Q4";

export interface NepalTdsQuarter {
  key: NepalQuarterKey;
  label: string;
  labelNepali: string;
  startBS: string;
  endBS: string;
  dueBS: string;
}

export function buildNepalTdsQuarters(fiscalYearStartBS: number): NepalTdsQuarter[] {
  const y = fiscalYearStartBS;
  const nextY = fiscalYearStartBS + 1;

  return [
    {
      key: "Q1",
      label: "Q1 — Shrawan to Ashwin",
      labelNepali: "पहिलो त्रैमासिक — श्रावणदेखि आश्विन",
      startBS: `${y}-04-01`,
      endBS: `${y}-06-32`,
      dueBS: `${y}-06-25`, // Ashwin 25
    },
    {
      key: "Q2",
      label: "Q2 — Kartik to Poush",
      labelNepali: "दोस्रो त्रैमासिक — कार्तिकदेखि पौष",
      startBS: `${y}-07-01`,
      endBS: `${y}-09-30`,
      dueBS: `${y}-09-25`, // Poush 25
    },
    {
      key: "Q3",
      label: "Q3 — Magh to Chaitra",
      labelNepali: "तेस्रो त्रैमासिक — माघदेखि चैत्र",
      startBS: `${y}-10-01`,
      endBS: `${y}-12-30`,
      dueBS: `${y}-12-25`, // Chaitra 25
    },
    {
      key: "Q4",
      label: "Q4 — Baisakh to Ashadh",
      labelNepali: "चौथो त्रैमासिक — वैशाखदेखि आषाढ",
      startBS: `${nextY}-01-01`,
      endBS: `${nextY}-03-32`,
      dueBS: `${nextY}-03-25`, // Ashadh 25
    },
  ];
}

export function bsDateToNumber(bsDate: string): number {
  const [y, m, d] = bsDate.split("-").map(Number);
  return y * 10000 + m * 100 + d;
}

export function isWithinBSRange(bsDate: string, fromBS: string, toBS: string): boolean {
  const n = bsDateToNumber(bsDate);
  return n >= bsDateToNumber(fromBS) && n <= bsDateToNumber(toBS);
}

export function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function downloadCsv(filename: string, rows: unknown[][]): void {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff", csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
