/**
 * nepalValidation.ts
 * Nepal-specific field validation: PAN, VAT, Mobile, Structured Address
 * All functions are pure and fully typed.
 *
 * TEST CASES (run in Jest or Vitest):
 *
 * validateNepalPAN("123456789")  → { valid: true,  formatted: "123-456-789" }
 * validateNepalPAN("023456789")  → { valid: false, formatted: "", error: "PAN cannot have a leading zero" }
 * validateNepalPAN("12345678")   → { valid: false, formatted: "", error: "PAN must be exactly 9 digits" }
 * validateNepalPAN("ABC123456")  → { valid: true,  formatted: "ABC-123-456", isGovtEntity: true }
 *
 * validateNepalVAT("123456789VA") → { valid: true }
 * validateNepalVAT("123456789")   → { valid: true }
 * validateNepalVAT("12345678VA")  → { valid: false, error: "..." }
 *
 * validateNepalMobile("9841234567") → { valid: true,  carrier: "NTC" }
 * validateNepalMobile("9801234567") → { valid: true,  carrier: "NTC CDMA" }
 * validateNepalMobile("9801234")    → { valid: false, error: "Mobile number must be 10 digits" }
 * validateNepalMobile("9601234567") → { valid: true,  carrier: "Smart Telecom" }
 */

// ─────────────────────────────────────────────────────────────────────────────
// PAN VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

export interface PANValidationResult {
  valid: boolean;
  formatted: string;
  isGovtEntity?: boolean;
  error?: string;
}

/**
 * Validates a Nepal PAN number.
 * Standard:   9 numeric digits, no leading zeros.
 * Govt entity: 3 uppercase alpha prefix + 6 digits (e.g., "ABC123456")
 * Display format: "XXX-XXX-XXX"
 */
export function validateNepalPAN(pan: string): PANValidationResult {
  const cleaned = pan.trim().toUpperCase().replace(/[-\s]/g, "");

  if (!cleaned) {
    return { valid: false, formatted: "", error: "PAN is required" };
  }

  // Government entity alpha-prefix PAN: 3 alpha + 6 digits
  const govtPattern = /^([A-Z]{3})(\d{6})$/;
  const govtMatch = cleaned.match(govtPattern);
  if (govtMatch) {
    const formatted = `${govtMatch[1]}-${govtMatch[2].slice(0, 3)}-${govtMatch[2].slice(3)}`;
    return { valid: true, formatted, isGovtEntity: true };
  }

  // Standard 9-digit numeric PAN
  if (!/^\d+$/.test(cleaned)) {
    return {
      valid: false,
      formatted: "",
      error: "PAN must be 9 digits or a government entity PAN (3 letters + 6 digits)",
    };
  }

  if (cleaned.length !== 9) {
    return {
      valid: false,
      formatted: "",
      error: `PAN must be exactly 9 digits (got ${cleaned.length})`,
    };
  }

  if (cleaned[0] === "0") {
    return {
      valid: false,
      formatted: "",
      error: "PAN cannot have a leading zero",
    };
  }

  const formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  return { valid: true, formatted };
}

/** Strip formatting hyphens — store this value, not the formatted one */
export function normalizePAN(pan: string): string {
  return pan.trim().toUpperCase().replace(/[-\s]/g, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// VAT NUMBER VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

export interface VATValidationResult {
  valid: boolean;
  panPart?: string;
  suffix?: "VA" | null;
  error?: string;
}

/**
 * Validates a Nepal VAT registration number.
 * Format A (new):  9-digit PAN + "VA"  → e.g. "123456789VA"
 * Format B (old):  9-digit PAN only    → e.g. "123456789"
 */
export function validateNepalVAT(vatNo: string): VATValidationResult {
  const cleaned = vatNo.trim().toUpperCase().replace(/\s/g, "");

  if (!cleaned) {
    return { valid: false, error: "VAT number is required" };
  }

  // Format A: 9 digits + "VA"
  if (/^\d{9}VA$/.test(cleaned)) {
    const pan = cleaned.slice(0, 9);
    const panResult = validateNepalPAN(pan);
    if (!panResult.valid) {
      return { valid: false, error: `Invalid PAN portion: ${panResult.error}` };
    }
    return { valid: true, panPart: pan, suffix: "VA" };
  }

  // Format B: 9 digits only
  if (/^\d{9}$/.test(cleaned)) {
    const panResult = validateNepalPAN(cleaned);
    if (!panResult.valid) {
      return { valid: false, error: `Invalid VAT number: ${panResult.error}` };
    }
    return { valid: true, panPart: cleaned, suffix: null };
  }

  return {
    valid: false,
    error:
      'VAT number must be a 9-digit PAN (e.g. "123456789") or PAN + "VA" suffix (e.g. "123456789VA")',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE NUMBER VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

export type MobileCarrier = "NTC" | "NTC CDMA" | "Ncell" | "Smart Telecom" | "UTL" | "Unknown";

export interface MobileValidationResult {
  valid: boolean;
  carrier?: MobileCarrier;
  error?: string;
}

// Carrier prefix rules (longest-prefix wins)
const CARRIER_PREFIXES: Array<{ prefix: string; carrier: MobileCarrier }> = [
  { prefix: "9800", carrier: "NTC CDMA" },
  { prefix: "9801", carrier: "NTC CDMA" },
  { prefix: "9802", carrier: "NTC CDMA" },
  { prefix: "985", carrier: "NTC CDMA" },
  { prefix: "984", carrier: "NTC" },
  { prefix: "986", carrier: "NTC" },
  { prefix: "974", carrier: "Ncell" },
  { prefix: "975", carrier: "Ncell" },
  { prefix: "980", carrier: "Ncell" },
  { prefix: "981", carrier: "Ncell" },
  { prefix: "982", carrier: "Ncell" },
  { prefix: "961", carrier: "Smart Telecom" },
  { prefix: "962", carrier: "Smart Telecom" },
  { prefix: "963", carrier: "Smart Telecom" },
  { prefix: "960", carrier: "UTL" },
  { prefix: "972", carrier: "UTL" },
  { prefix: "98", carrier: "NTC" },
  { prefix: "97", carrier: "Ncell" },
  { prefix: "96", carrier: "Smart Telecom" },
];

/**
 * Validates a Nepal mobile number and detects the carrier.
 * Strips country code (+977 / 00977) if present before validating.
 */
export function validateNepalMobile(mobile: string): MobileValidationResult {
  let cleaned = mobile.trim().replace(/[\s\-().]/g, "");

  // Strip country code
  if (cleaned.startsWith("+977")) cleaned = cleaned.slice(4);
  else if (cleaned.startsWith("00977")) cleaned = cleaned.slice(5);
  else if (cleaned.startsWith("977") && cleaned.length === 13) cleaned = cleaned.slice(3);

  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, error: "Mobile number must contain only digits" };
  }

  if (cleaned.length !== 10) {
    return {
      valid: false,
      error: `Mobile number must be 10 digits (got ${cleaned.length})`,
    };
  }

  if (!cleaned.startsWith("9")) {
    return {
      valid: false,
      error: "Nepal mobile numbers must start with 9",
    };
  }

  // Match carrier by longest prefix first
  const match = CARRIER_PREFIXES.find((c) => cleaned.startsWith(c.prefix));
  const carrier: MobileCarrier = match ? match.carrier : "Unknown";

  return { valid: true, carrier };
}

// ─────────────────────────────────────────────────────────────────────────────
// NEPAL ADDRESS STRUCTURE
// ─────────────────────────────────────────────────────────────────────────────

export interface NepalProvince {
  id: number;
  name: string;
  nepali: string;
  headquarter: string;
}

export const NEPAL_PROVINCES: NepalProvince[] = [
  { id: 1, name: "Koshi Province", nepali: "कोशी प्रदेश", headquarter: "Biratnagar" },
  { id: 2, name: "Madhesh Province", nepali: "मधेश प्रदेश", headquarter: "Janakpur" },
  { id: 3, name: "Bagmati Province", nepali: "बागमती प्रदेश", headquarter: "Hetauda" },
  { id: 4, name: "Gandaki Province", nepali: "गण्डकी प्रदेश", headquarter: "Pokhara" },
  { id: 5, name: "Lumbini Province", nepali: "लुम्बिनी प्रदेश", headquarter: "Deukhuri" },
  { id: 6, name: "Karnali Province", nepali: "कर्णाली प्रदेश", headquarter: "Birendranagar" },
  { id: 7, name: "Sudurpashchim Province", nepali: "सुदूरपश्चिम प्रदेश", headquarter: "Dhangadhi" },
];

export interface NepalDistrict {
  id: number;
  provinceId: number;
  name: string;
  nepali: string;
}

export const NEPAL_DISTRICTS: NepalDistrict[] = [
  // Province 1 – Koshi
  { id: 1, provinceId: 1, name: "Bhojpur", nepali: "भोजपुर" },
  { id: 2, provinceId: 1, name: "Dhankuta", nepali: "धनकुटा" },
  { id: 3, provinceId: 1, name: "Ilam", nepali: "इलाम" },
  { id: 4, provinceId: 1, name: "Jhapa", nepali: "झापा" },
  { id: 5, provinceId: 1, name: "Khotang", nepali: "खोटाङ" },
  { id: 6, provinceId: 1, name: "Morang", nepali: "मोरङ" },
  { id: 7, provinceId: 1, name: "Okhaldhunga", nepali: "ओखलढुङ्गा" },
  { id: 8, provinceId: 1, name: "Panchthar", nepali: "पाँचथर" },
  { id: 9, provinceId: 1, name: "Sankhuwasabha", nepali: "सङ्खुवासभा" },
  { id: 10, provinceId: 1, name: "Solukhumbu", nepali: "सोलुखुम्बु" },
  { id: 11, provinceId: 1, name: "Sunsari", nepali: "सुनसरी" },
  { id: 12, provinceId: 1, name: "Taplejung", nepali: "ताप्लेजुङ" },
  { id: 13, provinceId: 1, name: "Terhathum", nepali: "तेह्रथुम" },
  { id: 14, provinceId: 1, name: "Udayapur", nepali: "उदयपुर" },

  // Province 2 – Madhesh
  { id: 15, provinceId: 2, name: "Bara", nepali: "बारा" },
  { id: 16, provinceId: 2, name: "Dhanusha", nepali: "धनुषा" },
  { id: 17, provinceId: 2, name: "Mahottari", nepali: "महोत्तरी" },
  { id: 18, provinceId: 2, name: "Parsa", nepali: "पर्सा" },
  { id: 19, provinceId: 2, name: "Rautahat", nepali: "रौतहट" },
  { id: 20, provinceId: 2, name: "Saptari", nepali: "सप्तरी" },
  { id: 21, provinceId: 2, name: "Sarlahi", nepali: "सर्लाही" },
  { id: 22, provinceId: 2, name: "Siraha", nepali: "सिराहा" },

  // Province 3 – Bagmati
  { id: 23, provinceId: 3, name: "Bhaktapur", nepali: "भक्तपुर" },
  { id: 24, provinceId: 3, name: "Chitwan", nepali: "चितवन" },
  { id: 25, provinceId: 3, name: "Dhading", nepali: "धादिङ" },
  { id: 26, provinceId: 3, name: "Dolakha", nepali: "दोलखा" },
  { id: 27, provinceId: 3, name: "Kathmandu", nepali: "काठमाडौँ" },
  { id: 28, provinceId: 3, name: "Kavrepalanchok", nepali: "काभ्रेपलाञ्चोक" },
  { id: 29, provinceId: 3, name: "Lalitpur", nepali: "ललितपुर" },
  { id: 30, provinceId: 3, name: "Makwanpur", nepali: "मकवानपुर" },
  { id: 31, provinceId: 3, name: "Nuwakot", nepali: "नुवाकोट" },
  { id: 32, provinceId: 3, name: "Ramechhap", nepali: "रामेछाप" },
  { id: 33, provinceId: 3, name: "Rasuwa", nepali: "रसुवा" },
  { id: 34, provinceId: 3, name: "Sindhuli", nepali: "सिन्धुली" },
  { id: 35, provinceId: 3, name: "Sindhupalchok", nepali: "सिन्धुपाल्चोक" },

  // Province 4 – Gandaki
  { id: 36, provinceId: 4, name: "Baglung", nepali: "बागलुङ" },
  { id: 37, provinceId: 4, name: "Gorkha", nepali: "गोरखा" },
  { id: 38, provinceId: 4, name: "Kaski", nepali: "कास्की" },
  { id: 39, provinceId: 4, name: "Lamjung", nepali: "लमजुङ" },
  { id: 40, provinceId: 4, name: "Manang", nepali: "मनाङ" },
  { id: 41, provinceId: 4, name: "Mustang", nepali: "मुस्ताङ" },
  { id: 42, provinceId: 4, name: "Myagdi", nepali: "म्याग्दी" },
  { id: 43, provinceId: 4, name: "Nawalpur", nepali: "नवलपुर" },
  { id: 44, provinceId: 4, name: "Parbat", nepali: "पर्वत" },
  { id: 45, provinceId: 4, name: "Syangja", nepali: "स्याङ्जा" },
  { id: 46, provinceId: 4, name: "Tanahun", nepali: "तनहुँ" },

  // Province 5 – Lumbini
  { id: 47, provinceId: 5, name: "Arghakhanchi", nepali: "अर्घाखाँची" },
  { id: 48, provinceId: 5, name: "Banke", nepali: "बाँके" },
  { id: 49, provinceId: 5, name: "Bardiya", nepali: "बर्दिया" },
  { id: 50, provinceId: 5, name: "Dang", nepali: "दाङ" },
  { id: 51, provinceId: 5, name: "Eastern Rukum", nepali: "रुकुम पूर्वी" },
  { id: 52, provinceId: 5, name: "Gulmi", nepali: "गुल्मी" },
  { id: 53, provinceId: 5, name: "Kapilvastu", nepali: "कपिलवस्तु" },
  { id: 54, provinceId: 5, name: "Nawalparasi East", nepali: "नवलपरासी पूर्व" },
  { id: 55, provinceId: 5, name: "Palpa", nepali: "पाल्पा" },
  { id: 56, provinceId: 5, name: "Pyuthan", nepali: "प्युठान" },
  { id: 57, provinceId: 5, name: "Rolpa", nepali: "रोल्पा" },
  { id: 58, provinceId: 5, name: "Rupandehi", nepali: "रुपन्देही" },

  // Province 6 – Karnali
  { id: 59, provinceId: 6, name: "Dailekh", nepali: "दैलेख" },
  { id: 60, provinceId: 6, name: "Dolpa", nepali: "डोल्पा" },
  { id: 61, provinceId: 6, name: "Humla", nepali: "हुम्ला" },
  { id: 62, provinceId: 6, name: "Jajarkot", nepali: "जाजरकोट" },
  { id: 63, provinceId: 6, name: "Jumla", nepali: "जुम्ला" },
  { id: 64, provinceId: 6, name: "Kalikot", nepali: "कालिकोट" },
  { id: 65, provinceId: 6, name: "Mugu", nepali: "मुगु" },
  { id: 66, provinceId: 6, name: "Rukum West", nepali: "रुकुम पश्चिम" },
  { id: 67, provinceId: 6, name: "Salyan", nepali: "सल्यान" },
  { id: 68, provinceId: 6, name: "Surkhet", nepali: "सुर्खेत" },

  // Province 7 – Sudurpashchim
  { id: 69, provinceId: 7, name: "Achham", nepali: "अछाम" },
  { id: 70, provinceId: 7, name: "Baitadi", nepali: "बैतडी" },
  { id: 71, provinceId: 7, name: "Bajhang", nepali: "बझाङ" },
  { id: 72, provinceId: 7, name: "Bajura", nepali: "बाजुरा" },
  { id: 73, provinceId: 7, name: "Dadeldhura", nepali: "डडेल्धुरा" },
  { id: 74, provinceId: 7, name: "Darchula", nepali: "दार्चुला" },
  { id: 75, provinceId: 7, name: "Doti", nepali: "डोटी" },
  { id: 76, provinceId: 7, name: "Kailali", nepali: "कैलाली" },
  { id: 77, provinceId: 7, name: "Kanchanpur", nepali: "कञ्चनपुर" },
];

/** Filter districts by province */
export function getDistrictsByProvince(provinceId: number): NepalDistrict[] {
  return NEPAL_DISTRICTS.filter((d) => d.provinceId === provinceId);
}

export interface NepalAddress {
  provinceId: number;
  districtId: number;
  municipality: string; // Municipality / VDC name
  wardNo: string; // Ward number (1–32)
  tole: string; // Street / Tole
}

export interface AddressValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof NepalAddress, string>>;
}

/** Validate a structured Nepal address */
export function validateNepalAddress(address: Partial<NepalAddress>): AddressValidationResult {
  const errors: Partial<Record<keyof NepalAddress, string>> = {};

  if (!address.provinceId || !NEPAL_PROVINCES.find((p) => p.id === address.provinceId)) {
    errors.provinceId = "Please select a valid province (1–7)";
  }
  if (!address.districtId || !NEPAL_DISTRICTS.find((d) => d.id === address.districtId)) {
    errors.districtId = "Please select a valid district";
  }
  if (address.districtId && address.provinceId) {
    const district = NEPAL_DISTRICTS.find((d) => d.id === address.districtId);
    if (district && district.provinceId !== address.provinceId) {
      errors.districtId = "District does not belong to the selected province";
    }
  }
  if (!address.municipality?.trim()) {
    errors.municipality = "Municipality / VDC is required";
  }
  const wardNum = parseInt(address.wardNo ?? "", 10);
  if (!address.wardNo || isNaN(wardNum) || wardNum < 1 || wardNum > 35) {
    errors.wardNo = "Ward number must be between 1 and 35";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Format a Nepal address as a single display string */
export function formatNepalAddress(address: NepalAddress): string {
  const province = NEPAL_PROVINCES.find((p) => p.id === address.provinceId);
  const district = NEPAL_DISTRICTS.find((d) => d.id === address.districtId);
  const parts = [
    address.tole,
    `Ward No. ${address.wardNo}`,
    address.municipality,
    district?.name,
    province?.name,
    "Nepal",
  ].filter(Boolean);
  return parts.join(", ");
}

// ─────────────────────────────────────────────────────────────────────────────
// IRD e-Filing Helpers (hints / payload builders)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build an IRD VAT return payload skeleton.
 * Actual submission must go through the IRD taxpayer portal or licensed GSP.
 */
export interface IRDVATReturnPayload {
  panNo: string;
  taxPeriod: string; // e.g. "2081/04" = Shrawan 2081
  taxableSupplies: number;
  vatCollected: number;
  taxableExpenditure: number;
  vatPaid: number;
  netVatPayable: number;
}

export function buildIRDVATReturnPayload(params: {
  panNo: string;
  taxPeriod: string;
  salesTotal: number;
  purchaseTotal: number;
  vatRate?: number;
}): IRDVATReturnPayload {
  const rate = (params.vatRate ?? 13) / 100;
  const taxableSupplies = parseFloat((params.salesTotal / (1 + rate)).toFixed(2));
  const vatCollected = parseFloat((params.salesTotal - taxableSupplies).toFixed(2));
  const taxableExpenditure = parseFloat((params.purchaseTotal / (1 + rate)).toFixed(2));
  const vatPaid = parseFloat((params.purchaseTotal - taxableExpenditure).toFixed(2));
  const netVatPayable = parseFloat((vatCollected - vatPaid).toFixed(2));

  return {
    panNo: normalizePAN(params.panNo),
    taxPeriod: params.taxPeriod,
    taxableSupplies,
    vatCollected,
    taxableExpenditure,
    vatPaid,
    netVatPayable,
  };
}
