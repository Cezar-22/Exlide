// npm run replay -- [--fixture fixtures/solar-home.txt] [--provider ollama|groq|mock]
//                   [--model NAME] [--interval 6000] [--no-latency] [--verbose] [--json]
//
// Feeds recorded transcripts through the director with no microphone and
// prints a quality report, so providers and stability settings can be
// compared on the same input. Reads .env (see the npm script) for
// LLM_PROVIDER, LLM_MODEL, OLLAMA_URL, DIRECTOR_INTERVAL_MS, HOSTED_LLM_API_KEY.

import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { MockLlmProvider } from '../src/adapters/llm/mock.ts';
import { OllamaProvider } from '../src/adapters/llm/ollama.ts';
import { createDebugLogger, silentLogger } from '../src/core/debug.ts';
import { parseFixture } from '../src/core/fixture.ts';
import type { LlmProvider } from '../src/core/providers.ts';
import { runReplay, type ReplayReport } from '../src/core/replay.ts';
import { GROQ_DEFAULTS, OpenAiCompatibleProvider } from '../server/llm/openai-compatible.ts';

const FIXTURE_DIR = resolve(import.meta.dirname, '../fixtures');

const { values } = parseArgs({
  options: {
    fixture: { type: 'string', multiple: true },
    provider: { type: 'string' },
    model: { type: 'string' },
    interval: { type: 'string' },
    'no-latency': { type: 'boolean', default: false },
    verbose: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
  },
});

function makeProvider(name: string, model: string | undefined): LlmProvider {
  switch (name) {
    case 'mock':
      return new MockLlmProvider();
    case 'ollama':
      return new OllamaProvider({
        ...(process.env['OLLAMA_URL'] ? { baseUrl: process.env['OLLAMA_URL'] } : {}),
        ...(model ? { model } : {}),
      });
    case 'groq': {
      const apiKey = process.env['HOSTED_LLM_API_KEY'];
      if (!apiKey) throw new Error('groq needs HOSTED_LLM_API_KEY in Exlide/.env');
      return new OpenAiCompatibleProvider({ ...GROQ_DEFAULTS, apiKey, model: model || GROQ_DEFAULTS.model });
    }
    default:
      throw new Error(`unknown provider "${name}" (use ollama, groq or mock)`);
  }
}

function seconds(ms: number | null): string {
  return ms === null ? '-' : `${(ms / 1000).toFixed(1)}s`;
}

function printReport(fixture: string, r: ReplayReport): void {
  const s = r.stats;
  const pct = r.validRate === null ? '-' : `${Math.round(r.validRate * 100)}%`;
  console.log(`\n=== ${fixture} | ${r.provider} | ${seconds(r.durationMs)} simulated ===`);
  console.log(`calls ${s.calls} (retries ${s.retries}, fallbacks ${s.fallbacks}, errors ${s.errors})`);
  console.log(`ops: valid ${s.validOps}, dropped ${s.droppedOps} (valid rate ${pct}), held by stability ${s.heldOps}, applied ${s.appliedOps}`);
  console.log(`replies that were no_change: ${s.noChangeReplies}`);
  console.log(`ticks ${s.ticks}: skipped idle ${s.skippedIdle}, dwell ${s.skippedDwell}, busy ${s.skippedBusy}`);
  console.log(`latency avg ${seconds(r.avgLatencyMs)}, p95 ${seconds(r.p95LatencyMs)}`);
  console.log(`screen changes ${r.screenChanges}, shortest time on screen ${seconds(r.minOnScreenMs)}`);
  console.log('final deck:');
  for (const slide of r.finalDeck.slides) {
    const marker = slide.id === r.finalDeck.currentId ? '>' : ' ';
    console.log(`${marker} [${slide.id}] ${slide.title}`);
    for (const bullet of slide.bullets) console.log(`      - ${bullet}`);
  }
  if (s.errors > 0 && r.provider.startsWith('ollama')) {
    console.log('hint: is Ollama running? Install from https://ollama.com, then `ollama pull llama3.2:3b`.');
  }
}

async function main(): Promise<void> {
  const providerName = values.provider ?? process.env['LLM_PROVIDER'] ?? 'ollama';
  const llm = makeProvider(providerName === 'proxy' ? 'groq' : providerName, values.model ?? process.env['LLM_MODEL']);
  const intervalMs = Number(values.interval ?? process.env['DIRECTOR_INTERVAL_MS'] ?? 6000);
  const fixtures =
    values.fixture && values.fixture.length > 0
      ? values.fixture.map((f) => resolve(f))
      : readdirSync(FIXTURE_DIR)
          .filter((f) => f.endsWith('.txt'))
          .map((f) => join(FIXTURE_DIR, f));

  const logger = values.verbose
    ? createDebugLogger((event, data) => console.error(`[debug] ${event} ${JSON.stringify(data)}`))
    : silentLogger;

  const reports: Array<{ fixture: string; report: ReplayReport }> = [];
  for (const file of fixtures) {
    const report = await runReplay(parseFixture(readFileSync(file, 'utf8')), llm, logger, {
      intervalMs,
      simulateLatency: !values['no-latency'],
      tailMs: 3 * intervalMs,
    });
    reports.push({ fixture: basename(file), report });
    if (!values.json) printReport(basename(file), report);
  }
  if (values.json) console.log(JSON.stringify(reports, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
