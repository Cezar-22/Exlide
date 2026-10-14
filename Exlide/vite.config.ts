/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';

// Only these env vars reach client code. Anything else in .env (API keys in
// particular) stays on the server side. Never add a *_KEY name here.
const PUBLIC_ENV = [
  'STT_PROVIDER',
  'LLM_PROVIDER',
  'LLM_MODEL',
  'OLLAMA_URL',
  'PROXY_URL',
  'DIRECTOR_INTERVAL_MS',
  'DEBUG',
] as const;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const publicEnv: Record<string, string> = {};
  for (const name of PUBLIC_ENV) {
    const value = env[name];
    if (value !== undefined && value !== '') publicEnv[name] = value;
  }
  return {
    base: './',
    clearScreen: false,
    define: {
      __EXLIDE_ENV__: JSON.stringify(publicEnv),
    },
    server: {
      port: 5173,
      strictPort: true,
    },
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
    },
  };
});
