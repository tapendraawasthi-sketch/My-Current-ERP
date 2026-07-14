import React, { useMemo } from "react";
import { CheckCircle2, AlertCircle, Info, Sparkles } from "lucide-react";

interface OrbixMessageContentProps {
  text: string;
  isWelcome?: boolean;
}

const AMOUNT_RE = /(?:NPR|Rs\.?|रू\.?)\s*[\d,]+(?:\.\d{1,2})?|[\d,]+(?:\.\d{1,2})?\s*(?:NPR|Rs\.?)/gi;
const KV_RE = /^([A-Za-z\u0900-\u097F][\w\s/&-]{0,40}):\s*(.+)$/;

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;

  const combined = new RegExp(`(\\*\\*[^*]+\\*\\*)|(${AMOUNT_RE.source})`, "gi");

  let match: RegExpExecArray | null;
  while ((match = combined.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<span key={key++}>{text.slice(last, match.index)}</span>);
    }
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(
        <strong key={key++} className="font-semibold text-[var(--ds-text-default)]">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      parts.push(
        <span
          key={key++}
          className="font-mono font-medium tabular-nums text-[var(--ds-action-primary)]"
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
  success: "border-[color:rgba(5,150,105,0.3)] bg-[var(--ds-status-success-surface)]",
  error: "border-[color:rgba(220,38,38,0.3)] bg-[var(--ds-status-danger-surface)]",
  info: "border-[color:rgba(8,145,178,0.3)] bg-[var(--ds-status-info-surface)]",
  neutral: "border-[var(--ds-border-default)] bg-[var(--ds-surface-muted)]",
};

const OrbixMessageContent: React.FC<OrbixMessageContentProps> = ({ text, isWelcome }) => {
  const blocks = useMemo(() => {
    const paragraphs = text.split(/\n\n+/).filter(Boolean);
    return paragraphs.map((para) => {
      const lines = para.split("\n").filter((l) => l.trim());
      const isBulletList = lines.every(
        (l) => /^[•\-\*]\s/.test(l.trim()) || /^\d+\.\s/.test(l.trim()),
      );
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
          <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-status-info-surface)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--ds-action-primary)]" />
          </div>
          <div className="min-w-0 space-y-2">
            {blocks.map((block, bi) => (
              <div key={bi}>
                {block.isBulletList ? (
                  <ul className="space-y-1.5">
                    {block.lines.map((line, li) => {
                      const cleaned = line.replace(/^[•\-\*]\s|^\d+\.\s/, "");
                      return (
                        <li
                          key={li}
                          className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--ds-text-default)]"
                        >
                          <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-[var(--ds-action-primary)]" />
                          <span>{renderInline(cleaned)}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-[13px] leading-relaxed text-[var(--ds-text-default)]">
                    {renderInline(block.para.replace(/\n/g, " "))}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tone !== "neutral" && text.length < 200 && (
        <div className={`flex items-center gap-1.5 rounded-md border px-2 py-1 ${toneAccent[tone]}`}>
          <Icon
            className={`h-3 w-3 flex-shrink-0 ${
              tone === "success"
                ? "text-[var(--ds-status-success)]"
                : tone === "error"
                  ? "text-[var(--ds-status-danger)]"
                  : "text-[var(--ds-action-primary)]"
            }`}
          />
          <span className="text-[12px] leading-snug text-[var(--ds-text-default)]">
            {renderInline(text.split("\n")[0])}
          </span>
        </div>
      )}

      {blocks.map((block, bi) => {
        if (block.isKvBlock) {
          return (
            <div
              key={bi}
              className="overflow-hidden rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-muted)]"
            >
              {block.kvLines.map((line, li) => {
                const m = line.trim().match(KV_RE);
                if (!m) return null;
                const [, label, value] = m;
                const isAmount = AMOUNT_RE.test(value);
                return (
                  <div
                    key={li}
                    className={`flex items-center justify-between gap-3 px-2.5 py-1.5 text-[12px] ${
                      li > 0 ? "border-t border-[var(--ds-border-default)]" : ""
                    }`}
                  >
                    <span className="flex-shrink-0 text-[var(--ds-text-muted)]">{label}</span>
                    <span
                      className={`truncate text-right ${
                        isAmount
                          ? "font-mono font-medium tabular-nums text-[var(--ds-action-primary)]"
                          : "text-[var(--ds-text-default)]"
                      }`}
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
                  <li
                    key={li}
                    className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--ds-text-default)]"
                  >
                    <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-[var(--ds-action-primary)]" />
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
            <p
              key={bi}
              className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--ds-text-default)]"
            >
              {renderInline(rest)}
            </p>
          );
        }

        return (
          <p
            key={bi}
            className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--ds-text-default)]"
          >
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
