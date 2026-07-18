/** SUTRA AI — copy / open WhatsApp share for assistant messages */

import React, { useCallback, useState } from "react";
import { MessageCircle, Check } from "lucide-react";
import { copyWhatsAppText, openWhatsAppShare } from "../conversation/WhatsAppShareFormatter";

interface MessageShareButtonProps {
  text: string;
  shareText?: string;
  phone?: string;
}

const MessageShareButton: React.FC<MessageShareButtonProps> = ({ text, shareText, phone }) => {
  const [copied, setCopied] = useState(false);
  const payload = shareText ?? text;

  const handleCopy = useCallback(async () => {
    const ok = await copyWhatsAppText(payload);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [payload]);

  const handleWhatsApp = useCallback(() => {
    openWhatsAppShare(payload, phone);
  }, [payload, phone]);

  return (
    <div className="flex items-center gap-1 mt-1">
      <button
        type="button"
        title="Copy for WhatsApp"
        onClick={() => void handleCopy()}
        className="p-0.5 rounded text-gray-400 hover:text-[var(--ds-action-primary)]"
      >
        {copied ? <Check className="h-3 w-3 text-green-600" /> : <MessageCircle className="h-3 w-3" />}
      </button>
      <button
        type="button"
        title="Open WhatsApp"
        onClick={handleWhatsApp}
        className="text-[9px] text-[var(--ds-action-primary)] hover:underline"
      >
        WhatsApp
      </button>
    </div>
  );
};

export default MessageShareButton;
