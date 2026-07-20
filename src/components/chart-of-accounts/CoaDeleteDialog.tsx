import React from "react";
import { ConfirmDialogFoundation } from "@/design-system";
import type { DeleteTarget } from "./types";

export interface CoaDeleteDialogProps {
  deleteTarget: DeleteTarget | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const CoaDeleteDialog: React.FC<CoaDeleteDialogProps> = ({
  deleteTarget,
  onCancel,
  onConfirm,
}) => (
  <ConfirmDialogFoundation
    open={Boolean(deleteTarget)}
    onOpenChange={(open) => {
      if (!open) onCancel();
    }}
    title="Confirm delete"
    consequence={
      <>
        Are you sure you want to delete <strong>&quot;{deleteTarget?.name}&quot;</strong>? This
        action cannot be undone.
      </>
    }
    documentLabel={deleteTarget ? `${deleteTarget.type}: ${deleteTarget.name}` : undefined}
    warning="Linked vouchers or child accounts may block deletion."
    confirmLabel="Yes, delete"
    cancelLabel="Cancel"
    destructive
    onConfirm={onConfirm}
  />
);
