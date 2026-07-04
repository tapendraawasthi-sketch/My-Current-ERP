/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_KHATA_TENANT_ID?: string;
  readonly VITE_KHATA_COMPANY_ID?: string;
  readonly VITE_KHATA_USER_ID?: string;
  readonly VITE_ESEWA_MERCHANT_ID?: string;
  readonly VITE_KHALTI_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
