import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/config.ts';
import {
  applySettings,
  defaultSettings,
  loadSettings,
  saveSettings,
  SETTINGS_KEY,
  type KeyValueStore,
} from '../src/settings.ts';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

const config = readConfig({ STT_LANG: 'en-US', DIRECTOR_INTERVAL_MS: '5000', LLM_MODEL: 'llama3.1:8b' });
const defaults = defaultSettings(config);

describe('settings', () => {
  it('defaults come from the env config', () => {
    expect(defaults).toEqual({ sttLang: 'en-US', directorIntervalMs: 5000, llmModel: 'llama3.1:8b' });
  });

  it('round-trips through storage and overrides the config', () => {
    const store = memoryStore();
    const chosen = { sttLang: 'ro-RO', directorIntervalMs: 8000, llmModel: 'llama3.2:3b' };
    expect(saveSettings(store, chosen)).toBe(true);
    const loaded = loadSettings(store, defaults);
    expect(loaded).toEqual(chosen);
    expect(applySettings(config, loaded)).toMatchObject({ sttLang: 'ro-RO', directorIntervalMs: 8000, llmModel: 'llama3.2:3b', llmProvider: 'ollama' });
  });

  it('ignores corrupt or out-of-range values field by field', () => {
    const store = memoryStore({
      [SETTINGS_KEY]: JSON.stringify({ sttLang: 'not a lang', directorIntervalMs: 50, llmModel: 'llama3.2:3b' }),
    });
    expect(loadSettings(store, defaults)).toEqual({ ...defaults, llmModel: 'llama3.2:3b' });
    expect(loadSettings(memoryStore({ [SETTINGS_KEY]: '{oops' }), defaults)).toEqual(defaults);
  });

  it('only keeps English or Romanian, and maps other codes from .env', () => {
    const store = memoryStore({ [SETTINGS_KEY]: JSON.stringify({ sttLang: 'de-DE' }) });
    expect(loadSettings(store, defaults).sttLang).toBe('en-US');
    expect(defaultSettings(readConfig({ STT_LANG: 'en-GB' })).sttLang).toBe('en-US');
    expect(defaultSettings(readConfig({ STT_LANG: 'ro' })).sttLang).toBe('ro-RO');
  });

  it('works when storage is missing or throws', () => {
    const throwing: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSettings(null, defaults)).toEqual(defaults);
    expect(loadSettings(throwing, defaults)).toEqual(defaults);
    expect(saveSettings(throwing, defaults)).toBe(false);
    expect(saveSettings(null, defaults)).toBe(false);
  });
});
