/** SUTRA AI — ASCII sparkline for cache hit history */

import type { LanguageCode } from "../types";
import { llmResponseCache } from "./LlmResponseCache";

export function formatCacheHitSparkline(samples: number[]): string {
  if (!samples.length) return "—";
  const blocks = ["▁", "▂", "▃", "▄", "▅", "▆", "▇"];
  return samples
    .map((v) => blocks[Math.min(blocks.length - 1, Math.max(0, Math.round(v * 6)))])
    .join("");
}

export function formatCacheStatsLine(
  count: number,
  hitRatePct: number,
  hits: number,
  misses: number,
  sparkline: string,
  ageSuffix = "",
  lang: LanguageCode = "english",
): string {
  const hitLine =
    hits + misses > 0
      ? lang === "nepali"
        ? ` · hit ${hitRatePct}% (${hits}/${hits + misses})`
        : lang === "roman"
          ? ` · hit ${hitRatePct}% (${hits}/${hits + misses})`
          : ` · hit ${hitRatePct}% (${hits}/${hits + misses})`
      : "";
  if (lang === "nepali") {
    return `LLM cache: ${count} वटा${ageSuffix}${hitLine} · ${sparkline}`;
  }
  if (lang === "roman") {
    return `LLM cache: ${count} entries${ageSuffix}${hitLine} · ${sparkline}`;
  }
  return `LLM cache: ${count} entries${ageSuffix}${hitLine} · ${sparkline}`;
}

function formatCacheAgeSuffix(hoursAgo: number, lang: LanguageCode): string {
  if (lang === "nepali") return ` · नयाँ ${hoursAgo}घ पहिले`;
  if (lang === "roman") return ` · newest ${hoursAgo}h aghi`;
  return ` · newest ${hoursAgo}h ago`;
}

export function formatCacheSparklineTooltip(
  samples: number[],
  hitRatePct?: number,
  lang: LanguageCode = "english",
): string {
  const spark = formatCacheHitSparkline(samples);
  if (spark === "—") {
    if (lang === "nepali") return "अहिलेसम्म cache lookup छैन";
    if (lang === "roman") return "Ahile samma cache lookup chaina";
    return "No cache lookups yet";
  }
  const rate =
    hitRatePct != null && samples.length > 0
      ? lang === "nepali"
        ? ` · ${hitRatePct}% hit`
        : lang === "roman"
          ? ` · ${hitRatePct}% hit`
          : ` · ${hitRatePct}% hit rate`
      : "";
  if (lang === "nepali") {
    return `हालका cache lookups (${samples.length})${rate} · ${spark} · Click: copy · 2×: stats · 3×: मेट्नुहोस् (confirm)`;
  }
  if (lang === "roman") {
    return `Halka cache lookups (${samples.length})${rate} · ${spark} · Click: copy · 2×: stats · 3×: clear (confirm)`;
  }
  return `Recent cache lookups (${samples.length})${rate} · ${spark} · Click: copy · 2×: stats · 3×: clear (confirm)`;
}

export async function buildCacheStatsSummary(lang: LanguageCode = "english"): Promise<string> {
  const stats = await llmResponseCache.getStats();
  const hitRate = llmResponseCache.getHitRate();
  const ratePct = Math.round(hitRate.rate * 100);
  const sparkline = formatCacheHitSparkline(llmResponseCache.getHitHistory());
  const age =
    stats.newestAt != null
      ? formatCacheAgeSuffix(
          Math.round((Date.now() - stats.newestAt) / 3_600_000),
          lang,
        )
      : "";
  return formatCacheStatsLine(
    stats.count,
    ratePct,
    hitRate.hits,
    hitRate.misses,
    sparkline,
    age,
    lang,
  );
}
