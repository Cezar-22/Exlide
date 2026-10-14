// Runtime configuration for the browser / Tauri app, built from the
// whitelisted env vars in vite.config.ts. No secrets ever pass through here.

export type SttProviderName = 'webspeech' | 'mock';
export type LlmProviderName = 'ollama' | 'proxy' | 'mock';

export interface AppConfig {
  sttProvider: SttProviderName;
  llmProvider: LlmProviderName;
  llmModel: string;
  ollamaUrl: string;
  proxyUrl: string;
  directorIntervalMs: number;
  debug: boolean;
}

const STT_NAMES: readonly SttProviderName[] = ['webspeech', 'mock'];
const LLM_NAMES: readonly LlmProviderName[] = ['ollama', 'proxy', 'mock'];

function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.find((name) => name === value) ?? fallback;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function readConfig(env: Readonly<Record<string, string>>): AppConfig {
  return {
    sttProvider: pick(env['STT_PROVIDER'], STT_NAMES, 'webspeech'),
    llmProvider: pick(env['LLM_PROVIDER'], LLM_NAMES, 'ollama'),
    llmModel: env['LLM_MODEL'] ?? '',
    ollamaUrl: env['OLLAMA_URL'] ?? 'http://127.0.0.1:11434',
    proxyUrl: env['PROXY_URL'] ?? 'http://127.0.0.1:8787',
    directorIntervalMs: positiveInt(env['DIRECTOR_INTERVAL_MS'], 6000),
    debug: env['DEBUG'] !== 'false',
  };
}
