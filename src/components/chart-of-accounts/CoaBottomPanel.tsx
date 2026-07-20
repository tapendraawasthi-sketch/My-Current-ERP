import React from "react";
import type { AccountGroup, FeatureConfig, Ledger, MasterConfig } from "./types";
import { fmt } from "./constants";

export interface CoaBottomPanelProps {
  showBottomPanel: boolean;
  selectedItem: AccountGroup | Ledger | null;
  selectedIsLedger: boolean;
  masterConfig: MasterConfig;
  allGroups: AccountGroup[];
  allLedgers: Ledger[];
  features: FeatureConfig;
}

function getBottomPanelValue(field: string, ledger: Ledger, allGroups: AccountGroup[]): string {
  switch (field) {
    case "Name":
      return ledger.name;
    case "Alias":
      return ledger.alias || "";
    case "Group":
      return allGroups.find((g) => g.id === ledger.groupId)?.name || "";
    case "Address":
      return ledger.address || "";
    case "City":
      return ledger.state || "";
    case "State":
      return ledger.state || "";
    case "PIN Code":
      return ledger.pinCode || "";
    case "Phone":
      return ledger.phone || "";
    case "Mobile":
      return ledger.mobile || "";
    case "Email":
      return ledger.email || "";
    case "GSTIN":
      return ledger.gstin || "";
    case "PAN":
      return ledger.pan || "";
    case "Registration Type":
      return ledger.registrationType || "";
    case "Opening Balance":
      return ledger.openingBalance
        ? `${fmt(ledger.openingBalance)} ${ledger.openingBalanceType}`
        : "—";
    case "Account Type":
      return ledger.accountType;
    case "Credit Limit":
      return ledger.creditLimit ? `Rs. ${ledger.creditLimit.toLocaleString()}` : "No limit";
    case "TDS Applicable":
      return ledger.tdsApplicable ? "Yes" : "No";
    default:
      return "";
  }
}

export const CoaBottomPanel: React.FC<CoaBottomPanelProps> = ({
  showBottomPanel,
  selectedItem,
  selectedIsLedger,
  masterConfig,
  allGroups,
  allLedgers,
  features,
}) => (
  <>
    {showBottomPanel && selectedItem && selectedIsLedger && (
      <div className="border-t-2 border-gray-200 bg-white px-4 py-2 min-h-[80px]">
        <div className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-2">
          Account Details
        </div>
        <div className="grid grid-cols-4 gap-x-6 gap-y-1">
          {masterConfig.bottomPanelFields.map((field) => {
            const val = getBottomPanelValue(field, selectedItem as Ledger, allGroups);
            if (!val) return null;
            return (
              <div key={field}>
                <span className="text-[12px] text-gray-400">{field}: </span>
                <span className="text-[12px] text-gray-700 font-medium">{val}</span>
              </div>
            );
          })}
        </div>
      </div>
    )}

    <div className="px-5 py-1.5 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-400 flex items-center gap-4">
      <span>
        Total Groups: <strong>{allGroups.length}</strong>
      </span>
      <span>
        Primary: <strong>{allGroups.filter((g) => g.isPrimary).length}</strong>
      </span>
      <span>
        Sub-Groups: <strong>{allGroups.filter((g) => !g.isPrimary).length}</strong>
      </span>
      <span>
        Ledgers: <strong>{allLedgers.length}</strong>
      </span>
      {features.subLedgers && (
        <span>
          Sub-Ledgers:{" "}
          <strong>{allLedgers.filter((l) => l.ledgerType === "Sub Ledger").length}</strong>
        </span>
      )}
      <span className="ml-auto">F3=Add Ledger · Double-click=Edit · Esc=Cancel</span>
    </div>
  </>
);
