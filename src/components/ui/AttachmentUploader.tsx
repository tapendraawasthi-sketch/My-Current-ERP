/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Paperclip, X, FileText, Image } from "lucide-react";
import toast from "@/lib/appToast";

interface Props {
  attachments: string[];
  onAdd: (base64: string) => void;
  onRemove: (index: number) => void;
  maxFiles?: number;
}

const AttachmentUploader: React.FC<Props> = ({ attachments, onAdd, onRemove, maxFiles = 5 }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (attachments.length >= (maxFiles || 5)) {
      toast.error(`Max ${maxFiles} attachments`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) onAdd(ev.target.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {attachments.map((att, idx) => (
          <div
            key={idx}
            className="flex items-center gap-1 bg-[#EBF5E2] rounded-lg px-2 py-1 text-xs"
          >
            {att.startsWith("data:image") ? (
              <Image className="h-3 w-3 text-[#000000]" />
            ) : (
              <FileText className="h-3 w-3 text-red-500" />
            )}
            <a
              href={att}
              target="_blank"
              rel="noreferrer"
              className="text-[#000000] hover:underline"
            >
              {att.startsWith("data:image") ? `Image ${idx + 1}` : `PDF ${idx + 1}`}
            </a>
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="text-[#000000] hover:text-red-500 ml-1"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      {attachments.length < (maxFiles || 5) && (
        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[#000000] hover:text-[#000000] w-fit">
          <Paperclip className="h-3.5 w-3.5" />
          <span>Attach file (PDF/JPG/PNG, max 5MB)</span>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
};

export default AttachmentUploader;
