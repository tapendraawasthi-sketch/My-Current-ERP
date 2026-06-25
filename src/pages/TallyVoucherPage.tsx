// @ts-nocheck
/**
 * TallyVoucherPage — page wrapper that hosts the Tally-style voucher entry
 * and lets F4/F5/F6/F7 switch the active voucher type via the global router
 * (useStore.currentPage), so the rest of the app (sidebar, registers) stays
 * perfectly in sync.
 */
import React from "react";
import { useStore } from "../store/useStore";
import TallyVoucherEntry from "../components/tally/TallyVoucherEntry";
import "../styles/tally-green.css";
 
type TallyType = "journal" | "payment" | "receipt" | "contra";
 
const PAGE_TO_TYPE: Record<string, TallyType> = {
  journal: "journal",
  payment: "payment",
  receipt: "receipt",
  contra: "contra",
};
 
const TallyVoucherPage: React.FC<{ type?: TallyType }> = ({ type }) => {
  const currentPage = useStore((s) => s.currentPage);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const resolved: TallyType = type || PAGE_TO_TYPE[currentPage] || "journal";
 
  return (
    <div className="h-[calc(100vh-44px)]">
      <TallyVoucherEntry
        key={resolved}
        type={resolved}
        onSwitchType={(t) => setCurrentPage(t)}
      />
    </div>
  );
};
 
export default TallyVoucherPage;
