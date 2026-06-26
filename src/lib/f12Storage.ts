// src/lib/f12Storage.ts
// F12 Configuration System — localStorage persistence layer

import { type F12ValueMap, type F12ScreenId, getDefaultValues } from './f12Types';

export const STORAGE_KEY_PREFIX = 'sutra_f12__';

function buildKey(companyId: string, screenId: string): string {
  // Safe key: replace any non-alphanumeric chars with underscore
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '_');
  return `${STORAGE_KEY_PREFIX}${safe(companyId)}__${safe(screenId)}`;
}

/**
 * Load F12 values for a given company + screen.
 * Returns stored values merged on top of defaults, so new fields always have a value.
 */
export function loadF12Values(companyId: string, screenId: F12ScreenId): F12ValueMap {
  const defaults = getDefaultValues(screenId);
  try {
    const raw = localStorage.getItem(buildKey(companyId, screenId));
    if (!raw) return defaults;
    const stored: F12ValueMap = JSON.parse(raw);
    // Merge: defaults first, then stored values override
    return { ...defaults, ...stored };
  } catch (e) {
    console.error(`[F12] Failed to load config for ${screenId}:`, e);
    return defaults;
  }
}

/**
 * Save F12 values for a given company + screen.
 * Automatically strips out default values to keep the storage payload small.
 */
export function saveF12Values(
  companyId: string,
  screenId: F12ScreenId,
  values: F12ValueMap,
): void {
  try {
    const defaults = getDefaultValues(screenId);
    const overridesToSave: F12ValueMap = {};

    // Only save values that differ from the defaults
    for (const key in values) {
      if (values[key] !== defaults[key]) {
        overridesToSave[key] = values[key];
      }
    }

    const storageKey = buildKey(companyId, screenId);
    
    // If there are no overrides, clear the key entirely to save space
    if (Object.keys(overridesToSave).length === 0) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, JSON.stringify(overridesToSave));
    }
  } catch (e) {
    console.error('[F12] Failed to save config:', e);
  }
}

/**
 * Reset a screen's F12 config back to global defaults.
 * This deletes the stored override, so next load returns defaults.
 */
export function resetF12Values(companyId: string, screenId: F12ScreenId): void {
  try {
    localStorage.removeItem(buildKey(companyId, screenId));
  } catch (e) {
    console.error('[F12] Failed to reset config:', e);
  }
}

/**
 * Get a single F12 value for a screen, falling back to the field's default.
 * Returns undefined if the key does not exist in the configuration.
 */
export function getF12Value<T extends boolean | string | number>(
  companyId: string,
  screenId: F12ScreenId,
  key: string,
): T | undefined {
  const values = loadF12Values(companyId, screenId);
  return values[key] as T | undefined;
}
