/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sticky save/post action bar for invoice entry (STEP 5.2).
 */

import React from "react";
import { Button } from "../ui";
import { StickyActionBar } from "@/design-system";
import { Save, CheckCircle2, Printer } from "lucide-react";

interface InvoiceActionsProps {
  dirty: boolean;
  saving: boolean;
  readOnly: boolean;
  showPrint: boolean;
  onCancel: () => void;
  onSaveDraft: () => void;
  onPost: () => void;
  onPrint?: () => void;
}

const InvoiceActions: React.FC<InvoiceActionsProps> = ({
  dirty,
  saving,
  readOnly,
  showPrint,
  onCancel,
  onSaveDraft,
  onPost,
  onPrint,
}) => {
  return (
    <StickyActionBar
      unsaved={dirty}
      secondary={
        <>
          <span className="mr-auto text-[12px] text-gray-500 self-center">
            Esc Cancel · Ctrl+S Save draft · F2 Save · F9 Remove last line
          </span>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          {showPrint && onPrint && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrint}
              icon={<Printer className="h-4 w-4" />}
            >
              Print Preview
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onSaveDraft}
            loading={saving}
            disabled={readOnly}
            icon={<Save className="h-4 w-4" />}
          >
            Save as Draft
          </Button>
        </>
      }
      primary={
        <Button
          variant="primary"
          size="sm"
          onClick={onPost}
          loading={saving}
          disabled={readOnly}
          icon={<CheckCircle2 className="h-4 w-4" />}
        >
          Post Invoice
        </Button>
      }
    />
  );
};

export default InvoiceActions;
