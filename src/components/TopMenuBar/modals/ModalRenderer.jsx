import React, { Suspense, lazy } from 'react';
import { useMenu } from '@/context/MenuContext';

// Existing company modals
const SelectCompanyModal    = lazy(() => import('./company/SelectCompanyModal'));
const CreateCompanyModal    = lazy(() => import('./company/CreateCompanyModal'));

// Existing data modals
const BackupModal           = lazy(() => import('./data/BackupModal'));

// Existing shared modals
const ConfirmationModal     = lazy(() => import('./shared/ConfirmationModal'));
const UnsavedChangesModal   = lazy(() => import('./shared/UnsavedChangesModal'));

// Stub for missing modals to prevent build errors
const StubModal = ({ onClose }) => (
  <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:3000,display:'flex',alignItems:'center',justifyContent:'center' }}>
    <div style={{ background:'#1e2535',padding:20,borderRadius:8,color:'#fff',minWidth:300 }}>
      <h3>Not Implemented</h3>
      <p>This modal is not implemented yet.</p>
      <button onClick={onClose} style={{ marginTop:10,padding:'5px 10px',background:'#3182ce',color:'#fff',border:'none',borderRadius:4,cursor:'pointer' }}>Close</button>
    </div>
  </div>
);

const MODAL_MAP = {
  // Company
  selectCompany:    SelectCompanyModal,
  createCompany:    CreateCompanyModal,
  alterCompany:     StubModal,
  shutCompany:      StubModal,
  changeCompany:    SelectCompanyModal, // reuse SelectCompanyModal with changeMode prop
  securityControl:  StubModal,
  userRoles:        StubModal,
  changeUser:       StubModal, // reuse with changeUserMode prop
  dataEncryption:   StubModal,
  companyFeatures:  StubModal,
  licensing:        StubModal,
  // Data
  backup:           BackupModal,
  restore:          StubModal,
  migrate:          StubModal,
  splitCompany:     StubModal,
  repair:           StubModal,
  cloudBackup:      StubModal,
  // Export
  exportCurrentScreen:   StubModal,
  exportMasters:         StubModal,
  exportTransactions:    StubModal,
  exportReports:         StubModal,
  // Share
  emailShare:       StubModal,
  whatsappShare:    StubModal,
  shareLink:        StubModal,
  // Print
  printCurrentScreen: StubModal,
  configurePrint:     StubModal,
  printReports:       StubModal,
  printVouchers:      StubModal,
  // Help
  openHelp:         StubModal,
  troubleshoot:     StubModal,
  appSettings:      StubModal,
  addonManager:     StubModal,
  about:            StubModal,
  // Import
  importMasters:        StubModal,
  importTransactions:   StubModal,
  importBankStatements: StubModal,
  importEInvoice:       StubModal,
  importEWayBill:       StubModal,
  importLogs:           StubModal,
  // Shared
  unsavedChanges:     UnsavedChangesModal,
  permissionDenied:   StubModal,
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
