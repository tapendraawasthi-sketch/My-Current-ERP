/**
 * Busy / Tally F-key right strip — retired (Wave A / Function 5).
 * Voucher actions live in the form footer and command palette.
 * Component kept as a no-op so any stale import does not crash.
 */
import React from "react";

export interface VoucherRightBarProps {
  currentVoucherType: string;
  onChangeVoucherType: (type: string) => void;
  isOptional: boolean;
  isPostDated: boolean;
  onToggleOptional: () => void;
  onTogglePostDated: () => void;
  onAutofill?: () => void;
  onMoreDetails?: () => void;
  onAccept: () => void;
  onConfigure?: () => void;
  onChangeMode?: () => void;
  disabled?: boolean;
}

const VoucherRightBar: React.FC<VoucherRightBarProps> = () => null;

export default VoucherRightBar;
