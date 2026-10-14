// Replay mode: feeds a recorded transcript through the director on a
// simulated clock, with no microphone. Used to tune stability and to compare
// providers on the same fixture.

import type { DebugLogger } from './debug.ts';
import { currentSlide, type DeckState } from './deck.ts';
import { Director, type DirectorOptions, type DirectorStats, type TickOutcome } from './director.ts';
import type { FixtureEvent } from './fixture.ts';
import type { LlmProvider } from './providers.ts';
import { TranscriptBuffer } from './transcript.ts';

export interface ReplayOptions {
  intervalMs: number;
  /** Advance the simulated clock by each call's real latency, as in live use. */
  simulateLatency: boolean;
  /** Extra simulated time after the last event, so the director can catch up. */
  tailMs: number;
  director?: Partial<DirectorOptions>;
}

export interface TimelineEntry {
  at: number;
  outcome: TickOutcome;
  slides: number;
  current: string | null;
}

export interface ReplayReport {
  provider: string;
  durationMs: number;
  stats: DirectorStats;
  /** Times the visible slide (or its content) changed. */
  screenChanges: number;
  /** Shortest time any screen state stayed up before the next change. */
  minOnScreenMs: number | null;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  validRate: number | null;
  finalDeck: DeckState;
  timeline: TimelineEntry[];
}

function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? null;
}

export async function runReplay(
  events: readonly FixtureEvent[],
  llm: LlmProvider,
  logger: DebugLogger,
  options: ReplayOptions,
): Promise<ReplayReport> {
  await llm.warmUp?.().catch(() => undefined); // keep model load time out of the latency numbers
  let now = 0;
  const transcript = new TranscriptBuffer();
  const director = new Director({
    llm,
    transcript,
    clock: () => now,
    logger,
    ...(options.director ? { options: options.director } : {}),
  });

  const changeTimes: number[] = [];
  director.onDeckChange(() => changeTimes.push(now));
  const timeline: TimelineEntry[] = [];
  const end = (events.at(-1)?.at ?? 0) + options.tailMs;
  let next = 0;

  for (let tickAt = options.intervalMs; tickAt <= end; tickAt += options.intervalMs) {
    now = Math.max(now, tickAt);
    while (next < events.length && (events[next]?.at ?? Infinity) <= now) {
      const event = events[next];
      next += 1;
      if (!event) continue;
      if (event.kind === 'steer') director.steer(event.text);
      else transcript.add({ text: event.text, isFinal: true, at: event.at });
    }
    const callsBefore = director.stats.calls;
    const outcome = await director.tick();
    if (options.simulateLatency && director.stats.calls > callsBefore) {
      const spent = director.stats.latenciesMs.slice(callsBefore - director.stats.calls);
      now += spent.reduce((a, b) => a + b, 0);
    }
    timeline.push({
      at: now,
      outcome,
      slides: director.deck.slides.length,
      current: currentSlide(director.deck)?.title ?? null,
    });
  }

  const gaps = changeTimes.slice(1).map((t, i) => t - (changeTimes[i] ?? t));
  const { stats } = director;
  const judged = stats.validOps + stats.droppedOps;
  const latencies = stats.latenciesMs;
  return {
    provider: llm.name,
    durationMs: now,
    stats,
    screenChanges: changeTimes.length,
    minOnScreenMs: gaps.length > 0 ? Math.min(...gaps) : null,
    avgLatencyMs: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
    p95LatencyMs: percentile(latencies, 95),
    validRate: judged > 0 ? stats.validOps / judged : null,
    finalDeck: director.deck,
    timeline,
  };
}
