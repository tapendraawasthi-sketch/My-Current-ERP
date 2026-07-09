/**
 * Nepal Universal AI — bilingual response templates for confirmations,
 * clarifies, greetings, thanks, QA wraps, and parse errors.
 */

import {
  RESPONSE_TEMPLATES,
  RESPONSE_TEMPLATES_BY_INTENT,
  type ResponseTemplate,
} from "./generated/runtimeMaps";

const BY_ID = new Map(RESPONSE_TEMPLATES.map((t) => [t.id, t]));

/** Per-intent rotation counters (session-local). */
const ROTATION = new Map<string, number>();

export type ResponseLang = "nepali" | "english" | "mixed";

export type TemplateVars = Record<string, string | number | null | undefined>;

export function getResponseTemplatesForIntent(intent: string): ResponseTemplate[] {
  const ids = RESPONSE_TEMPLATES_BY_INTENT[intent] ?? [];
  return ids.map((id) => BY_ID.get(id)).filter(Boolean) as ResponseTemplate[];
}

export function pickResponseTemplate(
  intent: string,
  opts?: { preferEntities?: string[]; rotate?: boolean; providedKeys?: string[] },
): ResponseTemplate | null {
  const all = getResponseTemplatesForIntent(intent);
  if (!all.length) return null;

  const provided = new Set(
    (opts?.providedKeys ?? opts?.preferEntities ?? []).map((k) => k.toLowerCase()),
  );

  let pool = all;
  if (provided.size) {
    const fullySatisfied = all.filter((t) =>
      t.requiredEntities.every((e) => provided.has(e.toLowerCase())),
    );
    const candidates = fullySatisfied.length ? fullySatisfied : all;
    const scored = candidates
      .map((t) => {
        const reqMissing = t.requiredEntities.filter(
          (e) => !provided.has(e.toLowerCase()),
        ).length;
        const slots = [...t.requiredEntities, ...t.optionalEntities];
        const covered = slots.filter((e) => provided.has(e.toLowerCase())).length;
        const unusedSlots = slots.filter((e) => !provided.has(e.toLowerCase())).length;
        return { t, reqMissing, covered, unusedSlots };
      })
      .sort(
        (a, b) =>
          a.reqMissing - b.reqMissing ||
          a.unusedSlots - b.unusedSlots ||
          b.covered - a.covered,
      );
    const best = scored[0];
    pool = scored
      .filter(
        (s) =>
          s.reqMissing === best?.reqMissing &&
          s.unusedSlots === best?.unusedSlots,
      )
      .map((s) => s.t);
  }

  if (opts?.rotate === false) return pool[0] ?? null;
  const idx = ROTATION.get(intent) ?? 0;
  ROTATION.set(intent, idx + 1);
  return pool[idx % pool.length] ?? null;
}

export function fillTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    const v = vars[key];
    if (v == null || v === "") return `{${key}}`;
    return String(v);
  });
}

export function renderResponseTemplate(
  intent: string,
  lang: ResponseLang,
  vars: TemplateVars = {},
  opts?: { preferEntities?: string[]; rotate?: boolean },
): string | null {
  const providedKeys = Object.keys(vars).filter((k) => {
    const v = vars[k];
    return v != null && String(v).trim() !== "";
  });
  const all = getResponseTemplatesForIntent(intent);
  if (!all.length) return null;

  // Rank pool, then among a rotated window prefer fewest unresolved {placeholders}
  const primary = pickResponseTemplate(intent, {
    ...opts,
    preferEntities: opts?.preferEntities ?? providedKeys,
    providedKeys,
  });
  if (!primary) return null;

  const pool = getResponseTemplatesForIntent(intent);
  const scored = pool
    .map((tpl) => {
      const raw = lang === "english" ? tpl.templateEn : tpl.templateNe;
      const filled = fillTemplate(raw, vars);
      const unresolved = (filled.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).length;
      const reqOk = tpl.requiredEntities.every((e) =>
        providedKeys.map((k) => k.toLowerCase()).includes(e.toLowerCase()),
      );
      return { tpl, filled, unresolved, reqOk };
    })
    .filter((s) => s.reqOk || providedKeys.length === 0)
    .sort((a, b) => a.unresolved - b.unresolved);

  const bestUnresolved = scored[0]?.unresolved ?? 99;
  const tied = scored.filter((s) => s.unresolved === bestUnresolved);
  if (!tied.length) {
    const raw = lang === "english" ? primary.templateEn : primary.templateNe;
    return fillTemplate(raw, vars);
  }
  if (opts?.rotate === false) return tied[0]!.filled;
  // keep rotation but within best-unresolved set
  const idx = (ROTATION.get(`${intent}:render`) ?? 0) % tied.length;
  ROTATION.set(`${intent}:render`, idx + 1);
  return tied[idx]!.filled;
}

/** Map Khata intents to confirmation template buckets. */
export function confirmationTemplateIntent(intent: string): string | null {
  if (intent === "khata_credit_sale") return "khata_credit_sale";
  if (
    intent === "khata_cash_purchase" ||
    intent === "khata_purchase" ||
    intent === "khata_stock_purchase"
  ) {
    return "khata_cash_purchase";
  }
  return null;
}
