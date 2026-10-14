import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/config.ts';

describe('readConfig', () => {
  it('uses free defaults when nothing is set', () => {
    const c = readConfig({});
    expect(c.sttProvider).toBe('webspeech');
    expect(c.llmProvider).toBe('ollama');
    expect(c.directorIntervalMs).toBe(6000);
  });

  it('rejects unknown provider names and bad numbers', () => {
    const c = readConfig({ LLM_PROVIDER: 'gpt-9', DIRECTOR_INTERVAL_MS: '-5' });
    expect(c.llmProvider).toBe('ollama');
    expect(c.directorIntervalMs).toBe(6000);
  });

  it('accepts known values', () => {
    const c = readConfig({ LLM_PROVIDER: 'proxy', STT_PROVIDER: 'mock', DIRECTOR_INTERVAL_MS: '4000' });
    expect(c).toMatchObject({ llmProvider: 'proxy', sttProvider: 'mock', directorIntervalMs: 4000 });
  });
});
