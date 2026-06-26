/**
 * TallyVoucherPage — page wrapper that hosts the Tally-style voucher entry
 * and lets F4/F5/F6/F7 switch the active voucher type via the global router
 * (useStore.currentPage), so the rest of the app (sidebar, registers) stays
 * perfectly in sync.
 */
import React, { useEffect } from "react";
import { useStore } from "../store/useStore";
import TallyVoucherEntry from "../components/tally/TallyVoucherEntry";
import "../styles/tally-green.css";

// F12 CONFIG SYSTEM
import { useF12Config } from '../hooks/useF12Config';
import { type F12ScreenId } from '../lib/f12Types';

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

  const { setActiveScreenId } = useF12Config();

  const resolved: TallyType = type || PAGE_TO_TYPE[currentPage] || "journal";

  useEffect(() => {
    // Register the current tally voucher type with the F12 system
    // The F12 system uses keys like "journal-voucher", "payment-voucher", etc.
    const f12Id = `${resolved}-voucher` as F12ScreenId;
    setActiveScreenId(f12Id);
  }, [resolved, setActiveScreenId]);

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
