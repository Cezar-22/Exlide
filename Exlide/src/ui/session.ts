// Connects a transcript source to the director and the deck view: ticks the
// director on an interval (never overlapping, the director skips if busy)
// and renders every deck change. Platform glue only; the logic is in core.

import type { DebugLogger } from '../core/debug.ts';
import { Director } from '../core/director.ts';
import type { Lang } from '../core/language.ts';
import type { LlmProvider, TranscriptSegment } from '../core/providers.ts';
import { TranscriptBuffer } from '../core/transcript.ts';
import type { DeckView } from './deck-view.ts';

/** What the session reports; the UI turns it into text in the lesson language. */
export type SessionStatus =
  | { kind: 'llm-unreachable'; provider: string; local: boolean }
  | { kind: 'stats'; provider: string; calls: number; changes: number };

export interface SessionOptions {
  llm: LlmProvider;
  view: DeckView;
  logger: DebugLogger;
  intervalMs: number;
  language: Lang;
  onStatus: (status: SessionStatus) => void;
}

export class Session {
  readonly transcript = new TranscriptBuffer();
  readonly director: Director;
  private readonly options: SessionOptions;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: SessionOptions) {
    this.options = options;
    this.director = new Director({
      llm: options.llm,
      transcript: this.transcript,
      clock: () => Date.now(),
      logger: options.logger,
      options: { timeoutMs: Math.max(15_000, options.intervalMs * 3), language: options.language },
    });
    this.director.onDeckChange((deck) => options.view.render(deck));
  }

  start(): void {
    if (this.timer !== null) return;
    this.options.llm.warmUp?.().catch(() => undefined); // failures show up on the first real tick
    this.timer = setInterval(() => void this.tick(), this.options.intervalMs);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  addSegment(segment: TranscriptSegment): void {
    this.transcript.add(segment);
  }

  /** Typed steering note: high priority, so the director runs right away. */
  steer(note: string): void {
    this.director.steer(note);
    void this.tick();
  }

  private async tick(): Promise<void> {
    const outcome = await this.director.tick();
    const { stats } = this.director;
    const provider = this.options.llm.name;
    if (outcome === 'error') {
      this.options.onStatus({ kind: 'llm-unreachable', provider, local: provider.startsWith('ollama') });
    } else if (outcome !== 'skipped-busy' && outcome !== 'skipped-idle') {
      this.options.onStatus({ kind: 'stats', provider, calls: stats.calls, changes: stats.appliedOps });
    }
  }
}
