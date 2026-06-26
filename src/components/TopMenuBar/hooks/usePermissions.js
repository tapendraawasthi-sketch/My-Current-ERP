import { useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';

// Permission matrix by role
const ROLE_PERMISSIONS = {
  owner: {
    canSelectCompany: true, canCreateCompany: true, canAlterCompany: true,
    canShutCompany: true, canChangeCompany: true, canSecurityControl: true,
    canManageUserRoles: true, canChangeUser: true, canDataEncryption: true,
    canCompanyFeatures: true, canLicensing: true,
    canBackup: true, canRestore: true, canMigrate: true, canSplitData: true,
    canRepair: true, canCloudBackup: true,
    canSync: true, canImportData: true, canExportData: true, canConnectivity: true,
    canImportMasters: true, canImportTransactions: true, canImportBankStatements: true,
    canImportEInvoice: true, canImportEWayBill: true, canViewImportLogs: true,
    canExportCurrentScreen: true, canExportMasters: true, canExportTransactions: true,
    canExportReports: true, canViewExportLogs: true,
    canEmailShare: true, canWhatsAppShare: true, canGenerateShareLink: true,
    canShareWithUser: true, canViewShareHistory: true,
    canPrint: true, canConfigurePrint: true, canViewPrintLogs: true,
    canOpenHelp: true, canUpgrade: true, canTroubleshoot: true,
    canSettings: true, canAddOnManagement: true, canContactSupport: true,
    canGoTo: true, canSwitchTo: true,
  },
  admin: {
    canSelectCompany: true, canCreateCompany: true, canAlterCompany: true,
    canShutCompany: true, canChangeCompany: true, canSecurityControl: true,
    canManageUserRoles: true, canChangeUser: true, canDataEncryption: false,
    canCompanyFeatures: true, canLicensing: true,
    canBackup: true, canRestore: true, canMigrate: false, canSplitData: false,
    canRepair: true, canCloudBackup: true,
    canSync: true, canImportData: true, canExportData: true, canConnectivity: true,
    canImportMasters: true, canImportTransactions: true, canImportBankStatements: true,
    canImportEInvoice: true, canImportEWayBill: true, canViewImportLogs: true,
    canExportCurrentScreen: true, canExportMasters: true, canExportTransactions: true,
    canExportReports: true, canViewExportLogs: true,
    canEmailShare: true, canWhatsAppShare: true, canGenerateShareLink: true,
    canShareWithUser: true, canViewShareHistory: true,
    canPrint: true, canConfigurePrint: true, canViewPrintLogs: true,
    canOpenHelp: true, canUpgrade: true, canTroubleshoot: true,
    canSettings: true, canAddOnManagement: true, canContactSupport: true,
    canGoTo: true, canSwitchTo: true,
  },
  accountant: {
    canSelectCompany: true, canCreateCompany: false, canAlterCompany: false,
    canShutCompany: false, canChangeCompany: true, canSecurityControl: false,
    canManageUserRoles: false, canChangeUser: false, canDataEncryption: false,
    canCompanyFeatures: false, canLicensing: false,
    canBackup: true, canRestore: false, canMigrate: false, canSplitData: false,
    canRepair: false, canCloudBackup: true,
    canSync: false, canImportData: true, canExportData: true, canConnectivity: false,
    canImportMasters: true, canImportTransactions: true, canImportBankStatements: true,
    canImportEInvoice: true, canImportEWayBill: true, canViewImportLogs: true,
    canExportCurrentScreen: true, canExportMasters: true, canExportTransactions: true,
    canExportReports: true, canViewExportLogs: true,
    canEmailShare: true, canWhatsAppShare: true, canGenerateShareLink: false,
    canShareWithUser: true, canViewShareHistory: true,
    canPrint: true, canConfigurePrint: false, canViewPrintLogs: true,
    canOpenHelp: true, canUpgrade: false, canTroubleshoot: true,
    canSettings: false, canAddOnManagement: false, canContactSupport: true,
    canGoTo: true, canSwitchTo: true,
  },
  dataEntry: {
    canSelectCompany: true, canCreateCompany: false, canAlterCompany: false,
    canShutCompany: false, canChangeCompany: true, canSecurityControl: false,
    canManageUserRoles: false, canChangeUser: false, canDataEncryption: false,
    canCompanyFeatures: false, canLicensing: false,
    canBackup: false, canRestore: false, canMigrate: false, canSplitData: false,
    canRepair: false, canCloudBackup: false,
    canSync: false, canImportData: false, canExportData: false, canConnectivity: false,
    canImportMasters: false, canImportTransactions: false, canImportBankStatements: false,
    canImportEInvoice: false, canImportEWayBill: false, canViewImportLogs: false,
    canExportCurrentScreen: false, canExportMasters: false, canExportTransactions: false,
    canExportReports: false, canViewExportLogs: false,
    canEmailShare: false, canWhatsAppShare: false, canGenerateShareLink: false,
    canShareWithUser: false, canViewShareHistory: false,
    canPrint: true, canConfigurePrint: false, canViewPrintLogs: false,
    canOpenHelp: true, canUpgrade: false, canTroubleshoot: false,
    canSettings: false, canAddOnManagement: false, canContactSupport: true,
    canGoTo: true, canSwitchTo: true,
  },
  auditor: {
    canSelectCompany: true, canCreateCompany: false, canAlterCompany: false,
    canShutCompany: false, canChangeCompany: true, canSecurityControl: false,
    canManageUserRoles: false, canChangeUser: false, canDataEncryption: false,
    canCompanyFeatures: false, canLicensing: false,
    canBackup: false, canRestore: false, canMigrate: false, canSplitData: false,
    canRepair: false, canCloudBackup: false,
    canSync: false, canImportData: false, canExportData: true, canConnectivity: false,
    canImportMasters: false, canImportTransactions: false, canImportBankStatements: false,
    canImportEInvoice: false, canImportEWayBill: false, canViewImportLogs: true,
    canExportCurrentScreen: true, canExportMasters: true, canExportTransactions: true,
    canExportReports: true, canViewExportLogs: true,
    canEmailShare: false, canWhatsAppShare: false, canGenerateShareLink: false,
    canShareWithUser: false, canViewShareHistory: false,
    canPrint: true, canConfigurePrint: false, canViewPrintLogs: false,
    canOpenHelp: true, canUpgrade: false, canTroubleshoot: false,
    canSettings: false, canAddOnManagement: false, canContactSupport: true,
    canGoTo: true, canSwitchTo: true,
  },
};

// Default — deny everything if no role matched
const DEFAULT_PERMISSIONS = Object.fromEntries(
  Object.keys(ROLE_PERMISSIONS.owner).map(k => [k, false])
);

export function usePermissions() {
  const { currentUser } = useApp();

  const permissions = useMemo(() => {
    if (!currentUser) return DEFAULT_PERMISSIONS;
    const role = currentUser.role?.toLowerCase().replace(/\s+/g, '');
    return ROLE_PERMISSIONS[role] || DEFAULT_PERMISSIONS;
  }, [currentUser]);

  // Helper: check single permission
  const can = useCallback((permissionKey) => {
    return permissions[permissionKey] === true;
  }, [permissions]);

  return { permissions, can };
}
