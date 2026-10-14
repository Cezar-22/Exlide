// User settings chosen on the landing page (Settings dialog). They override
// the build-time env defaults and are remembered per browser. Storage can be
// missing or throw (private windows, blocked site data), so every access is
// guarded and the app works without it.

import type { AppConfig } from './config.ts';
import { isSupportedLanguageCode, langOf, languageOption } from './core/language.ts';

export interface UserSettings {
  /** Lesson language as a BCP-47 code (en-US or ro-RO): speech, slides and app text. */
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

/** Update-speed choices; labels live in i18n.ts. */
export const SPEEDS: ReadonlyArray<{ ms: number; key: 'speedFast' | 'speedNormal' | 'speedCalm' }> = [
  { ms: 4000, key: 'speedFast' },
  { ms: 6000, key: 'speedNormal' },
  { ms: 8000, key: 'speedCalm' },
];

/** Any language code becomes a supported one (e.g. en-GB from .env -> en-US). */
function supportedCode(code: string): string {
  return isSupportedLanguageCode(code) ? code : languageOption(langOf(code)).code;
}

export function defaultSettings(config: AppConfig): UserSettings {
  return { sttLang: supportedCode(config.sttLang), directorIntervalMs: config.directorIntervalMs, llmModel: config.llmModel };
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
    sttLang: typeof lang === 'string' && isSupportedLanguageCode(lang) ? lang : defaults.sttLang,
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
