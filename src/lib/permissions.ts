import { CompanySettings, User, UserRole, VoucherStatus, VoucherType } from "./types";

export function isDateFrozen(date: string, settings: CompanySettings): boolean {
  if (!settings.freezeUpToDate) return false;
  return date <= settings.freezeUpToDate;
}

export function canEditVoucher(
  voucherDate: string,
  voucherStatus: VoucherStatus,
  currentUser: User,
  settings: CompanySettings
): { allowed: boolean; reason: string } {
  if (voucherStatus === VoucherStatus.CANCELLED)
    return { allowed: false, reason: 'Cancelled vouchers cannot be edited.' };
  
  if (isDateFrozen(voucherDate, settings) && currentUser.role !== UserRole.ADMIN)
    return { allowed: false, reason: 'This date is in a locked period. Contact administrator.' };
  
  if (!settings.allowVoucherEditAfterPosting && voucherStatus === VoucherStatus.POSTED && currentUser.role !== UserRole.ADMIN)
    return { allowed: false, reason: 'Editing posted vouchers is disabled. Contact administrator.' };
    
  return { allowed: true, reason: '' };
}

export function requiresApproval(
  voucherType: VoucherType,
  amount: number,
  currentUser: User,
  settings: CompanySettings
): boolean {
  if (!settings.enableApprovalWorkflow) return false;
  
  const rules = settings.approvalRules || [];
  for (const rule of rules) {
    const typeMatch = rule.voucherType === 'all' || rule.voucherType === voucherType;
    const amountMatch = amount >= rule.minAmountThreshold;
    const autoApprove = rule.autoApproveForRoles?.includes(currentUser.role);
    
    if (typeMatch && amountMatch && rule.requiresApproval && !autoApprove) return true;
  }
  
  return false;
}
