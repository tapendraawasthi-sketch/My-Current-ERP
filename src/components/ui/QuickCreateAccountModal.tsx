/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import Modal from "./Modal";
import Input from "./Input";
import Select from "./Select";
import Button from "./Button";
import { useStore } from "../../store/useStore";
import { AccountType, AccountLevel } from "../../lib/types";
import toast from "react-hot-toast";

interface QuickCreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (accountId: string) => void;
  suggestedType?: AccountType;
}

const QuickCreateAccountModal: React.FC<QuickCreateAccountModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  suggestedType = AccountType.EXPENSE,
}) => {
  const addAccount = useStore((state) => state.addAccount);
  const [name, setName] = useState("");
  const [nameNp, setNameNp] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<AccountType>(suggestedType);
  const [pending, setPending] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      toast.error("Account Name and Account Code are required fields.");
      return;
    }

    setPending(true);
    try {
      const created = await addAccount({
        code: code.trim(),
        name: name.trim(),
        nameNepali: nameNp.trim() || undefined,
        type,
        level: AccountLevel.LEDGER,
        openingBalance: 0,
        openingBalanceDr: 0,
        openingBalanceCr: 0,
        isActive: true,
        isGroup: false,
      });
      onCreated(created.id);
      setName("");
      setNameNp("");
      setCode("");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Error occurred.");
    } finally {
      setPending(false);
    }
  };

  const accountTypeOptions = Object.values(AccountType).map((t) => ({
    value: t as string,
    label: (t as string).charAt(0) + (t as string).slice(1).toLowerCase().replace("_", " "),
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Create Account Ledger"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={pending}>
            Save ledger
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Accounting Ledger Code"
            placeholder="e.g. 4015"
            value={code}
            onChange={setCode}
            required
            autoFocus
          />
          <Select
            label="Account Classification Group"
            options={accountTypeOptions}
            value={type}
            onChange={(val) => setType(val as AccountType)}
            required
          />
        </div>

        <Input
          label="Ledger Particulars Name (EN)"
          placeholder="e.g. Fuel Travelling Expense"
          value={name}
          onChange={setName}
          required
        />

        <Input
          label="Ledger Particulars Name (NP/Devanagari)"
          placeholder="वैकल्पिक नेपाली नाम"
          value={nameNp}
          onChange={setNameNp}
        />
      </form>
    </Modal>
  );
};

export default QuickCreateAccountModal;
