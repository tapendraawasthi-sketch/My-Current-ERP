// src/lib/constants.ts
import { TdsType } from "./types";

export const TDS_RATES: Record<string, number> = {
  [TdsType.NONE]: 0,
  [TdsType.SERVICE_CONTRACT]: 1.5,
  [TdsType.HOUSE_RENT]: 10,
  [TdsType.CONSULTANCY]: 15,
  [TdsType.RENT]: 10,
  [TdsType.SALARY]: 15,
  [TdsType.DIVIDEND]: 5,
  [TdsType.COMMISSION]: 10,
  [TdsType.CONTRACTOR]: 1.5,
  [TdsType.OTHER]: 5,
};

export const NEPAL_PROVINCES = [
  "Koshi", "Madhesh", "Bagmati", "Gandaki",
  "Lumbini", "Karnali", "Sudurpashchim",
];

export const NEPAL_DISTRICTS: Record<string, string[]> = {
  Bagmati: ["Kathmandu", "Lalitpur", "Bhaktapur", "Kavrepalanchok", "Sindhupalchok", "Dolakha", "Ramechhap", "Sindhuli", "Makwanpur", "Chitwan", "Nuwakot", "Rasuwa", "Dhading"],
  Koshi: ["Jhapa", "Ilam", "Taplejung", "Panchthar", "Terhathum", "Dhankuta", "Sankhuwasabha", "Bhojpur", "Solukhumbu", "Okhaldhunga", "Khotang", "Udayapur", "Sunsari", "Morang"],
  Gandaki: ["Kaski", "Syangja", "Parbat", "Baglung", "Mustang", "Manang", "Lamjung", "Gorkha", "Tanahu", "Nawalpur", "Nawalparasi"],
  Lumbini: ["Rupandehi", "Kapilvastu", "Arghakhanchi", "Gulmi", "Palpa", "Nawalparasi", "Pyuthan", "Rolpa", "Rukum East", "Dang", "Banke", "Bardiya"],
  Karnali: ["Surkhet", "Dailekh", "Jajarkot", "Kalikot", "Jumla", "Mugu", "Humla", "Dolpa", "Rukum West"],
  Sudurpashchim: ["Kailali", "Kanchanpur", "Dadeldhura", "Doti", "Baitadi", "Darchula", "Bajhang", "Bajura", "Achham"],
  Madhesh: ["Dhanusha", "Mahottari", "Sarlahi", "Rautahat", "Bara", "Parsa", "Siraha", "Saptari"],
};

export const VAT_RATE = 13;
export const TDS_THRESHOLD = 10000; // TDS applies above this amount

export const VOUCHER_SERIES_PREFIXES: Record<string, string> = {
  journal: "JV",
  payment: "PV",
  receipt: "RV",
  contra: "CV",
  "sales-invoice": "SI",
  "purchase-invoice": "PI",
  "sales-return": "SR",
  "purchase-return": "PR",
  "debit-note": "DN",
  "credit-note": "CN",
  "delivery-challan": "DC",
  "goods-receipt-note": "GRN",
  "sales-order": "SO",
  "purchase-order": "PO",
};

export const APP_VERSION = "2.0.0";
export const APP_NAME = "Sutra ERP";

export const NEPALI_MONTHS_EN = [
  "Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];
