import React, { useMemo } from "react";
import { CheckCircle2, AlertCircle, Info, Sparkles } from "lucide-react";

interface OrbixMessageContentProps {
  text: string;
  isWelcome?: boolean;
}

const AMOUNT_RE = /(?:NPR|Rs\.?|रू\.?)\s*[\d,]+(?:\.\d{1,2})?|[\d,]+(?:\.\d{1,2})?\s*(?:NPR|Rs\.?)/gi;
const BOLD_RE = /\*\*([^*]+)\*\*/g;
const KV_RE = /^([A-Za-z\u0900-\u097F][\w\s/&-]{0,40}):\s*(.+)$/;

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;

  const combined = new RegExp(
    `(\\*\\*[^*]+\\*\\*)|(${AMOUNT_RE.source})`,
    "gi",
  );

  let match: RegExpExecArray | null;
  while ((match = combined.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<span key={key++}>{text.slice(last, match.index)}</span>);
    }
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(
        <strong key={key++} className="font-semibold text-cyan-100">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      parts.push(
        <span
          key={key++}
          className="font-mono text-[#fb923c] font-medium tabular-nums"
        >
          {token}
        </span>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) {
    parts.push(<span key={key++}>{text.slice(last)}</span>);
  }
  return parts.length ? parts : [text];
}

function detectTone(text: string): "success" | "error" | "info" | "neutral" {
  const lower = text.toLowerCase();
  if (/safalta|saved|✓|success|confirm|posted|recorded/i.test(lower)) return "success";
  if (/error|failed|sakina|unbalanced|✗|invalid/i.test(lower)) return "error";
  if (/clarify|\?|kati|kun|which|please/i.test(lower)) return "info";
  return "neutral";
}

const toneIcon = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  neutral: Sparkles,
};

const toneAccent = {
  success: "border-emerald-500/30 bg-emerald-500/10",
  error: "border-red-500/30 bg-red-500/10",
  info: "border-cyan-500/30 bg-cyan-500/10",
  neutral: "border-white/10 bg-white/[0.04]",
};

const OrbixMessageContent: React.FC<OrbixMessageContentProps> = ({ text, isWelcome }) => {
  const blocks = useMemo(() => {
    const paragraphs = text.split(/\n\n+/).filter(Boolean);
    return paragraphs.map((para) => {
      const lines = para.split("\n").filter((l) => l.trim());
      const isBulletList = lines.every((l) => /^[•\-\*]\s/.test(l.trim()) || /^\d+\.\s/.test(l.trim()));
      const kvLines = lines.filter((l) => KV_RE.test(l.trim()));
      const isKvBlock = kvLines.length >= 2 && kvLines.length === lines.length;

      return { para, lines, isBulletList, isKvBlock, kvLines };
    });
  }, [text]);

  const tone = detectTone(text);
  const Icon = toneIcon[tone];

  if (isWelcome) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/20">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
          </div>
          <div className="space-y-2 min-w-0">
            {blocks.map((block, bi) => (
              <div key={bi}>
                {block.isBulletList ? (
                  <ul className="space-y-1.5">
                    {block.lines.map((line, li) => {
                      const cleaned = line.replace(/^[•\-\*]\s|^\d+\.\s/, "");
                      return (
                        <li key={li} className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-300">
                          <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-orange-400" />
                          <span>{renderInline(cleaned)}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-[12px] leading-relaxed text-slate-300">
                    {renderInline(block.para.replace(/\n/g, " "))}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {["CA Entries", "Ledger Queries", "IFRS/NAS", "Nepali · English"].map((tag) => (
            <span
              key={tag}
              className="rounded px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide border border-white/10 bg-white/5 text-slate-400"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tone !== "neutral" && text.length < 200 && (
        <div className={`flex items-center gap-1.5 rounded-md border px-2 py-1 ${toneAccent[tone]}`}>
          <Icon className={`h-3 w-3 flex-shrink-0 ${tone === "success" ? "text-emerald-400" : tone === "error" ? "text-red-400" : "text-cyan-400"}`} />
          <span className="text-[11px] leading-snug text-slate-200">{renderInline(text.split("\n")[0])}</span>
        </div>
      )}

      {blocks.map((block, bi) => {
        if (block.isKvBlock) {
          return (
            <div
              key={bi}
              className="rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden"
            >
              {block.kvLines.map((line, li) => {
                const m = line.trim().match(KV_RE);
                if (!m) return null;
                const [, label, value] = m;
                const isAmount = AMOUNT_RE.test(value);
                return (
                  <div
                    key={li}
                    className={`flex items-center justify-between gap-3 px-2.5 py-1.5 text-[11px] ${li > 0 ? "border-t border-white/5" : ""}`}
                  >
                    <span className="text-slate-500 flex-shrink-0">{label}</span>
                    <span
                      className={`text-right truncate ${isAmount ? "font-mono font-medium text-[#fb923c]" : "text-slate-200"}`}
                    >
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        }

        if (block.isBulletList) {
          return (
            <ul key={bi} className="space-y-1">
              {block.lines.map((line, li) => {
                const cleaned = line.replace(/^[•\-\*]\s|^\d+\.\s/, "");
                return (
                  <li key={li} className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-300">
                    <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-cyan-400/80" />
                    <span>{renderInline(cleaned)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        if (tone !== "neutral" && text.length < 200 && bi === 0) {
          const rest = block.para.split("\n").slice(1).join("\n");
          if (!rest.trim()) return null;
          return (
            <p key={bi} className="text-[12px] leading-relaxed text-slate-300 whitespace-pre-wrap">
              {renderInline(rest)}
            </p>
          );
        }

        return (
          <p key={bi} className="text-[12px] leading-relaxed text-slate-300 whitespace-pre-wrap">
            {block.lines.map((line, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(line)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
};

export default OrbixMessageContent;
