export type WizardForm = {
  companyNameEn: string;
  companyNameNe: string;
  /** Legal entity form (Sole Prop, Pvt. Ltd., …). */
  businessType: string;
  /** Industry / business nature — drives module visibility. */
  businessNature: string;
  address: string;
  city: string;
  district: string;
  province: string;
  phone: string;
  email: string;
  website: string;
  panNumber: string;
  hasVAT: boolean;
  vatNumber: string;
  irdProvince: string;
  irdOfficeName: string;
  fiscalYear: string;
  dateFormat: string;
  enableStock: boolean;
  enableCostCenter: boolean;
  enableBillWise: boolean;
  fullName: string;
  username: string;
  password: string;
  confirmPassword: string;
};

export type WizardStepProps = {
  data: WizardForm;
  onChange: (data: WizardForm) => void;
  errors?: Record<string, string>;
};
