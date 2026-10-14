/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';

// Only these env vars reach client code. Anything else in .env (API keys in
// particular) stays on the server side. Never add a *_KEY name here.
const PUBLIC_ENV = [
  'STT_PROVIDER',
  'STT_LANG',
  'LLM_PROVIDER',
  'LLM_MODEL',
  'OLLAMA_URL',
  'PROXY_URL',
  'DIRECTOR_INTERVAL_MS',
  'DEBUG',
] as const;

/**
 * `npm run build:single`: inlines the JS and CSS bundles into index.html so
 * the browser app is one file that opens from disk (file://) with no server.
 */
function inlineIntoHtml(): Plugin {
  return {
    name: 'exlide-inline-into-html',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = Object.values(bundle).find((f) => f.type === 'asset' && f.fileName.endsWith('.html'));
      if (!html || html.type !== 'asset') return;
      let source = String(html.source);
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type === 'chunk' && file.isEntry) {
          const code = file.code.replace(/<\/script/gi, '<\\/script');
          source = source.replace(
            new RegExp(`<script[^>]*src="[^"]*${escapeRegExp(file.fileName)}"[^>]*></script>`),
            () => `<script type="module">${code}</script>`,
          );
          delete bundle[name];
        } else if (file.type === 'asset' && file.fileName.endsWith('.css')) {
          const css = String(file.source).replace(/<\/style/gi, '<\\/style');
          source = source.replace(
            new RegExp(`<link[^>]*href="[^"]*${escapeRegExp(file.fileName)}"[^>]*>`),
            () => `<style>${css}</style>`,
          );
          delete bundle[name];
        }
      }
      html.source = source;
    },
  };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const publicEnv: Record<string, string> = {};
  for (const name of PUBLIC_ENV) {
    const value = env[name];
    if (value !== undefined && value !== '') publicEnv[name] = value;
  }
  const single = mode === 'single';
  return {
    base: './',
    clearScreen: false,
    define: {
      __EXLIDE_ENV__: JSON.stringify(publicEnv),
    },
    plugins: single ? [inlineIntoHtml()] : [],
    build: single
      ? { outDir: 'dist-single', cssCodeSplit: false, assetsInlineLimit: Number.MAX_SAFE_INTEGER, modulePreload: false }
      : {},
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
