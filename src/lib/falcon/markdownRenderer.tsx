// src/lib/falcon/markdownRenderer.tsx
// Falcon AI — Pure-React Markdown Renderer (no external markdown libraries)
// Handles all common LLM output formatting patterns with Tailwind CSS.

import React, { memo, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface MarkdownProps {
  content: string;
  className?: string;
  compact?: boolean;
  animate?: boolean;
}

export type ParsedBlock =
  | { type: "paragraph"; content: string }
  | { type: "heading"; level: 1 | 2 | 3; content: string }
  | { type: "bullet-list"; items: string[] }
  | { type: "numbered-list"; items: string[] }
  | { type: "code-block"; language: string; code: string }
  | { type: "horizontal-rule" }
  | { type: "blank-line" };

// ─────────────────────────────────────────────────────────────────────────────
// INLINE PARSER — Handles bold, italic, inline-code, and URLs within text
// ─────────────────────────────────────────────────────────────────────────────

type InlineToken =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string }
  | { kind: "code"; value: string }
  | { kind: "url"; href: string; label: string };

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  // Pattern order matters: code > bold > italic > url > text
  const pattern =
    /(`[^`]+`)|(\*\*[\s\S]+?\*\*|__[\s\S]+?__)|(\*[^*\n]+?\*|_[^_\n]+?_)|(https?:\/\/[^\s)>]+)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Plain text before this match
    if (match.index > lastIndex) {
      tokens.push({ kind: "text", value: text.slice(lastIndex, match.index) });
    }

    const [full, code, bold, italic, url] = match;

    if (code) {
      tokens.push({ kind: "code", value: code.slice(1, -1) });
    } else if (bold) {
      // Strip ** or __
      const inner = full.startsWith("**") ? full.slice(2, -2) : full.slice(2, -2);
      tokens.push({ kind: "bold", value: inner });
    } else if (italic) {
      const inner = full.startsWith("*") ? full.slice(1, -1) : full.slice(1, -1);
      tokens.push({ kind: "italic", value: inner });
    } else if (url) {
      // Trim trailing punctuation that may not be part of the URL
      const cleaned = url.replace(/[.,;:!?)]+$/, "");
      tokens.push({ kind: "url", href: cleaned, label: cleaned });
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ kind: "text", value: text.slice(lastIndex) });
  }

  return tokens;
}

// ─────────────────────────────────────────────────────────────────────────────
// INLINE RENDERER — Converts InlineTokens to React nodes
// ─────────────────────────────────────────────────────────────────────────────

function renderInline(text: string, compact: boolean): React.ReactNode[] {
  const tokens = parseInline(text);
  return tokens.map((token, i) => {
    switch (token.kind) {
      case "bold":
        return (
          <strong key={i} className="font-semibold text-gray-900">
            {token.value}
          </strong>
        );
      case "italic":
        return (
          <em key={i} className="italic text-gray-700">
            {token.value}
          </em>
        );
      case "code":
        return (
          <code
            key={i}
            className="bg-gray-100 text-red-600 rounded px-1 text-[11px] font-mono"
          >
            {token.value}
          </code>
        );
      case "url":
        return (
          <a
            key={i}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline cursor-pointer hover:text-blue-800"
          >
            {token.label}
          </a>
        );
      default:
        return <React.Fragment key={i}>{token.value}</React.Fragment>;
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// parseMarkdown — Line-by-line block parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a markdown string into an array of ParsedBlock discriminated unions.
 * Handles headings, lists, code fences, horizontal rules, and paragraphs.
 * Never throws on malformed input.
 */
export function parseMarkdown(text: string): ParsedBlock[] {
  if (!text || typeof text !== "string") return [];

  const blocks: ParsedBlock[] = [];
  const lines = text.split("n");
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // ── Blank line ──────────────────────────────────────────────────────
    if (line.trim() === "") {
      // Only add blank-line if it's not already a blank at the end
      if (blocks.length > 0 && blocks[blocks.length - 1].type !== "blank-line") {
        blocks.push({ type: "blank-line" });
      }
      i++;
      continue;
    }

    // ── Horizontal rule ─────────────────────────────────────────────────
    if (/^(-{3,}|_{3,}|*{3,})$/.test(line.trim())) {
      blocks.push({ type: "horizontal-rule" });
      i++;
      continue;
    }

    // ── Fenced code block ───────────────────────────────────────────────
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim().toLowerCase() || "text";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing ```
      blocks.push({ type: "code-block", language: lang, code: codeLines.join("n") });
      continue;
    }

    // ── Headings ────────────────────────────────────────────────────────
    const h3 = line.match(/^###s+(.*)/);
    if (h3) {
      blocks.push({ type: "heading", level: 3, content: h3[1].trim() });
      i++;
      continue;
    }
    const h2 = line.match(/^##s+(.*)/);
    if (h2) {
      blocks.push({ type: "heading", level: 2, content: h2[1].trim() });
      i++;
      continue;
    }
    const h1 = line.match(/^#s+(.*)/);
    if (h1) {
      blocks.push({ type: "heading", level: 1, content: h1[1].trim() });
      i++;
      continue;
    }

    // ── Bullet list ─────────────────────────────────────────────────────
    if (/^(s*[-•*]s+)/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^(s*[-•*]s+)/.test(lines[i].trimEnd())) {
        items.push(lines[i].replace(/^s*[-•*]s+/, "").trim());
        i++;
      }
      blocks.push({ type: "bullet-list", items });
      continue;
    }

    // ── Numbered list ────────────────────────────────────────────────────
    if (/^s*d+[.)]s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^s*d+[.)]s+/.test(lines[i].trimEnd())) {
        items.push(lines[i].replace(/^s*d+[.)]s+/, "").trim());
        i++;
      }
      blocks.push({ type: "numbered-list", items });
      continue;
    }

    // ── Paragraph — collect consecutive non-blank, non-special lines ────
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("```") &&
      !/^#{1,3}s+/.test(lines[i]) &&
      !/^(-{3,}|_{3,}|*{3,})$/.test(lines[i].trim()) &&
      !/^(s*[-•*]s+)/.test(lines[i]) &&
      !/^s*d+[.)]s+/.test(lines[i])
    ) {
      paraLines.push(lines[i].trimEnd());
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", content: paraLines.join(" ") });
    }
  }

  // Remove trailing blank-line blocks
  while (blocks.length > 0 && blocks[blocks.length - 1].type === "blank-line") {
    blocks.pop();
  }

  return blocks;
}

// ─────────────────────────────────────────────────────────────────────────────
// MarkdownRenderer — Main React component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders an AI-response markdown string into styled JSX.
 * Uses React.memo for performance since content rarely changes after mounting.
 */
export const MarkdownRenderer: React.FC<MarkdownProps> = memo(
  ({ content, className = "", compact = false, animate = false }) => {
    const blocks = useMemo(() => parseMarkdown(content || ""), [content]);

    if (!content) return null;

    const animateClass = animate ? "animate-fadeIn" : "";

    const renderBlock = (block: ParsedBlock, index: number): React.ReactNode => {
      switch (block.type) {
        // ── Headings ──────────────────────────────────────────────────────
        case "heading": {
          const headingClasses: Record<1 | 2 | 3, string> = {
            1: compact
              ? "font-bold text-[13px] text-gray-900 mt-1.5 mb-0.5"
              : "font-bold text-[14px] text-gray-900 mt-2 mb-1",
            2: compact
              ? "font-bold text-[13px] text-gray-900 mt-1.5 mb-0.5"
              : "font-bold text-[14px] text-gray-900 mt-2 mb-1",
            3: compact
              ? "font-semibold text-[12px] text-gray-800 mt-1 mb-0.5"
              : "font-semibold text-[13px] text-gray-800 mt-2 mb-1",
          };
          const Tag = (["h1", "h2", "h3"] as const)[block.level - 1];
          return (
            <Tag key={index} className={headingClasses[block.level]}>
              {renderInline(block.content, compact)}
            </Tag>
          );
        }

        // ── Bullet list ───────────────────────────────────────────────────
        case "bullet-list":
          return (
            <ul
              key={index}
              className={compact ? "space-y-0 my-1" : "space-y-0.5 my-1.5"}
            >
              {block.items.map((item, j) => (
                <li
                  key={j}
                  className={`flex gap-1.5 items-start ${compact ? "text-[11px]" : "text-[12px]"} text-gray-700 leading-relaxed`}
                >
                  <span className="text-gray-400 mt-px select-none flex-shrink-0">•</span>
                  <span>{renderInline(item, compact)}</span>
                </li>
              ))}
            </ul>
          );

        // ── Numbered list ──────────────────────────────────────────────────
        case "numbered-list":
          return (
            <ol
              key={index}
              className={compact ? "space-y-0 my-1" : "space-y-0.5 my-1.5"}
            >
              {block.items.map((item, j) => (
                <li
                  key={j}
                  className={`flex gap-1.5 items-start ${compact ? "text-[11px]" : "text-[12px]"} text-gray-700 leading-relaxed`}
                >
                  <span className="text-gray-400 font-mono text-[11px] mt-px flex-shrink-0 min-w-[16px]">
                    {j + 1}.
                  </span>
                  <span>{renderInline(item, compact)}</span>
                </li>
              ))}
            </ol>
          );

        // ── Code block ────────────────────────────────────────────────────
        case "code-block":
          return (
            <div
              key={index}
              className={compact ? "relative my-1" : "relative my-2"}
            >
              {block.language && block.language !== "text" && (
                <div className="absolute top-1.5 right-2 text-[10px] text-gray-400 font-mono select-none uppercase">
                  {block.language}
                </div>
              )}
              <pre className="bg-gray-900 text-green-400 rounded-md p-2.5 text-[11px] font-mono overflow-x-auto leading-relaxed whitespace-pre">
                <code>{block.code}</code>
              </pre>
            </div>
          );

        // ── Horizontal rule ───────────────────────────────────────────────
        case "horizontal-rule":
          return (
            <hr
              key={index}
              className={compact ? "border-t border-gray-200 my-1" : "border-t border-gray-200 my-2"}
            />
          );

        // ── Blank line ────────────────────────────────────────────────────
        case "blank-line":
          return <div key={index} className={compact ? "h-1" : "h-2"} aria-hidden="true" />;

        // ── Paragraph ─────────────────────────────────────────────────────
        case "paragraph":
          return (
            <p
              key={index}
              className={`${compact ? "text-[11px]" : "text-[12px]"} text-gray-700 leading-relaxed`}
            >
              {renderInline(block.content, compact)}
            </p>
          );

        default:
          return null;
      }
    };

    return (
      <div
        className={[
          "falcon-markdown",
          compact ? "space-y-0.5" : "space-y-1",
          animateClass,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {blocks.map((block, index) => renderBlock(block, index))}
      </div>
    );
  },
);

MarkdownRenderer.displayName = "MarkdownRenderer";

export default MarkdownRenderer;
