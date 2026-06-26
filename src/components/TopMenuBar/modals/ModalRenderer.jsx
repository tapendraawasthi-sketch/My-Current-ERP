import React, { Suspense, lazy } from 'react';
import { useMenu } from '../context/MenuContext';

// Company modals
const SelectCompanyModal    = lazy(() => import('./company/SelectCompanyModal'));
const CreateCompanyModal    = lazy(() => import('./company/CreateCompanyModal'));
const AlterCompanyModal     = lazy(() => import('./company/AlterCompanyModal'));
const ShutCompanyModal      = lazy(() => import('./company/ShutCompanyModal'));
const SecurityControlModal  = lazy(() => import('./company/SecurityControlModal'));
const UserRolesModal        = lazy(() => import('./company/UserRolesModal'));
const CompanyFeaturesModal  = lazy(() => import('./company/CompanyFeaturesModal'));
const DataEncryptionModal   = lazy(() => import('./company/DataEncryptionModal'));
const LicensingModal        = lazy(() => import('./company/LicensingModal'));

// Data modals
const BackupModal           = lazy(() => import('./data/BackupModal'));
const RestoreModal          = lazy(() => import('./data/RestoreModal'));
const MigrateModal          = lazy(() => import('./data/MigrateModal'));
const SplitCompanyModal     = lazy(() => import('./data/SplitCompanyModal'));
const RepairModal           = lazy(() => import('./data/RepairModal'));
const CloudBackupModal      = lazy(() => import('./data/CloudBackupModal'));

// Shared modals
const ConfirmationModal     = lazy(() => import('./shared/ConfirmationModal'));
const UnsavedChangesModal   = lazy(() => import('./shared/UnsavedChangesModal'));
const PermissionDeniedModal = lazy(() => import('./shared/PermissionDeniedModal'));

// Export modals (inline definitions, not lazy — they are simple)
const ExportCurrentScreenModal = lazy(() => import('./export/ExportCurrentScreenModal'));
const ExportMastersModal       = lazy(() => import('./export/ExportMastersModal'));
const ExportTransactionsModal  = lazy(() => import('./export/ExportTransactionsModal'));
const ExportReportsModal       = lazy(() => import('./export/ExportReportsModal'));

// Share modals
const EmailShareModal      = lazy(() => import('./share/EmailShareModal'));
const WhatsAppShareModal   = lazy(() => import('./share/WhatsAppShareModal'));
const ShareLinkModal       = lazy(() => import('./share/ShareLinkModal'));

// Print modals
const PrintCurrentModal    = lazy(() => import('./print/PrintCurrentModal'));
const PrintConfigModal     = lazy(() => import('./print/PrintConfigModal'));

// Help modals
const HelpModal            = lazy(() => import('./help/HelpModal'));
const AboutModal           = lazy(() => import('./help/AboutModal'));
const TroubleshootModal    = lazy(() => import('./help/TroubleshootModal'));
const SettingsModal        = lazy(() => import('./help/SettingsModal'));
const AddonManagerModal    = lazy(() => import('./help/AddonManagerModal'));

// Import modals
const ImportMastersModal      = lazy(() => import('./import/ImportMastersModal'));
const ImportTransactionsModal = lazy(() => import('./import/ImportTransactionsModal'));
const ImportBankModal         = lazy(() => import('./import/ImportBankModal'));
const ImportEInvoiceModal     = lazy(() => import('./import/ImportEInvoiceModal'));
const ImportEWayBillModal     = lazy(() => import('./import/ImportEWayBillModal'));
const ImportLogsModal         = lazy(() => import('./import/ImportLogsModal'));

const MODAL_MAP = {
  // Company
  selectCompany:    SelectCompanyModal,
  createCompany:    CreateCompanyModal,
  alterCompany:     AlterCompanyModal,
  shutCompany:      ShutCompanyModal,
  changeCompany:    SelectCompanyModal, // reuse SelectCompanyModal with changeMode prop
  securityControl:  SecurityControlModal,
  userRoles:        UserRolesModal,
  changeUser:       SecurityControlModal, // reuse with changeUserMode prop
  dataEncryption:   DataEncryptionModal,
  companyFeatures:  CompanyFeaturesModal,
  licensing:        LicensingModal,
  // Data
  backup:           BackupModal,
  restore:          RestoreModal,
  migrate:          MigrateModal,
  splitCompany:     SplitCompanyModal,
  repair:           RepairModal,
  cloudBackup:      CloudBackupModal,
  // Export
  exportCurrentScreen:   ExportCurrentScreenModal,
  exportMasters:         ExportMastersModal,
  exportTransactions:    ExportTransactionsModal,
  exportReports:         ExportReportsModal,
  // Share
  emailShare:       EmailShareModal,
  whatsappShare:    WhatsAppShareModal,
  shareLink:        ShareLinkModal,
  // Print
  printCurrentScreen: PrintCurrentModal,
  configurePrint:     PrintConfigModal,
  printReports:       PrintCurrentModal,
  printVouchers:      PrintCurrentModal,
  // Help
  openHelp:         HelpModal,
  troubleshoot:     TroubleshootModal,
  appSettings:      SettingsModal,
  addonManager:     AddonManagerModal,
  about:            AboutModal,
  // Import
  importMasters:        ImportMastersModal,
  importTransactions:   ImportTransactionsModal,
  importBankStatements: ImportBankModal,
  importEInvoice:       ImportEInvoiceModal,
  importEWayBill:       ImportEWayBillModal,
  importLogs:           ImportLogsModal,
  // Shared
  unsavedChanges:     UnsavedChangesModal,
  permissionDenied:   PermissionDeniedModal,
  noCompanyError:     ConfirmationModal,
};

export default function ModalRenderer() {
  const { activeModal, modalProps, closeModal } = useMenu();
  if (!activeModal) return null;

  const ModalComponent = MODAL_MAP[activeModal];
  if (!ModalComponent) {
    console.warn(`[ModalRenderer] No modal registered for key: "${activeModal}"`);
    return null;
  }

  return (
    <Suspense fallback={<div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:3000 }}/>}>
      <ModalComponent onClose={closeModal} {...modalProps} />
    </Suspense>
  );
}
