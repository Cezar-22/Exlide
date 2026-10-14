// User settings chosen on the landing page (Settings dialog). They override
// the build-time env defaults and are remembered per browser. Storage can be
// missing or throw (private windows, blocked site data), so every access is
// guarded and the app works without it.

import type { AppConfig } from './config.ts';

export interface UserSettings {
  /** Speech language, BCP-47. */
  sttLang: string;
  /** How often the director looks at new speech. */
  directorIntervalMs: number;
  /** Ollama model name; empty = the configured default. */
  llmModel: string;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SETTINGS_KEY = 'exlide.settings.v1';

export const LANGUAGES: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'ro-RO', label: 'Română' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'es-ES', label: 'Español' },
  { code: 'it-IT', label: 'Italiano' },
];

export const SPEEDS: ReadonlyArray<{ ms: number; label: string }> = [
  { ms: 4000, label: 'Fast (4 s)' },
  { ms: 6000, label: 'Normal (6 s)' },
  { ms: 8000, label: 'Calm (8 s)' },
];

export function defaultSettings(config: AppConfig): UserSettings {
  return { sttLang: config.sttLang, directorIntervalMs: config.directorIntervalMs, llmModel: config.llmModel };
}

/** Reads saved settings, ignoring anything missing, malformed or out of range. */
export function loadSettings(store: KeyValueStore | null, defaults: UserSettings): UserSettings {
  let raw: unknown;
  try {
    const text = store?.getItem(SETTINGS_KEY);
    raw = text ? JSON.parse(text) : null;
  } catch {
    return defaults;
  }
  if (typeof raw !== 'object' || raw === null) return defaults;
  const lang: unknown = Reflect.get(raw, 'sttLang');
  const interval: unknown = Reflect.get(raw, 'directorIntervalMs');
  const model: unknown = Reflect.get(raw, 'llmModel');
  return {
    sttLang: typeof lang === 'string' && /^[a-z]{2,3}(-[A-Z]{2})?$/.test(lang) ? lang : defaults.sttLang,
    directorIntervalMs:
      typeof interval === 'number' && interval >= 2000 && interval <= 30_000 ? interval : defaults.directorIntervalMs,
    llmModel: typeof model === 'string' && /^[\w.:/-]{0,80}$/.test(model) ? model : defaults.llmModel,
  };
}

/** Returns false when the browser would not let us save. */
export function saveSettings(store: KeyValueStore | null, settings: UserSettings): boolean {
  try {
    store?.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return store !== null;
  } catch {
    return false;
  }
}

export function applySettings(config: AppConfig, settings: UserSettings): AppConfig {
  return {
    ...config,
    sttLang: settings.sttLang,
    directorIntervalMs: settings.directorIntervalMs,
    llmModel: settings.llmModel,
  };
}

/** localStorage, or null when the browser blocks it. */
export function browserStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
