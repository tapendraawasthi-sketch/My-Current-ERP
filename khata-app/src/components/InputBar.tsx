import { useRef, useState, type ChangeEvent } from "react";
import { extractAmountFromImage } from "../lib/ocrInput";
import { isVoiceInputSupported, listenOnce } from "../lib/voiceInput";

interface InputBarProps {
  disabled?: boolean;
  onSend: (text: string) => void;
}

export default function InputBar({ disabled, onSend }: InputBarProps) {
  const [value, setValue] = useState("");
  const [voiceTip, setVoiceTip] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleVoice = async () => {
    if (!isVoiceInputSupported()) {
      setVoiceTip("Voice input is not supported on this browser. Please type your entry.");
      return;
    }
    setVoiceTip(null);
    try {
      const transcript = await listenOnce();
      if (transcript) setValue(transcript);
    } catch {
      setVoiceTip("Voice input is not supported on this browser. Please type your entry.");
    }
  };

  const handlePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const { text, confidence } = await extractAmountFromImage(file);
    setValue(confidence >= 70 ? text : text);
    event.target.value = "";
  };

  return (
    <div className="border-t border-gray-200 bg-white p-2">
      {voiceTip && <p className="mb-1 text-[11px] text-amber-700">{voiceTip}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleVoice}
          disabled={disabled}
          className="h-8 w-8 rounded-md border border-gray-300 text-[12px] text-gray-700"
          aria-label="Voice input"
        >
          🎤
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="h-8 w-8 rounded-md border border-gray-300 text-[12px] text-gray-700"
          aria-label="Photo input"
        >
          📷
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhoto}
        />
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSend();
          }}
          placeholder="Type your khata entry..."
          className="h-8 flex-1 rounded-md border border-gray-300 bg-white px-2.5 text-[12px] focus:border-[#1557b0] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="h-8 rounded-md bg-[#1557b0] px-3 text-[12px] font-medium text-white hover:bg-[#0f4a96] disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
