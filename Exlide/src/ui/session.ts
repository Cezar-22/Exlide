// Connects a transcript source to the director and the deck view: ticks the
// director on an interval (never overlapping, the director skips if busy)
// and renders every deck change. Platform glue only; the logic is in core.

import type { DebugLogger } from '../core/debug.ts';
import { Director } from '../core/director.ts';
import type { LlmProvider, TranscriptSegment } from '../core/providers.ts';
import { TranscriptBuffer } from '../core/transcript.ts';
import type { DeckView } from './deck-view.ts';

export interface SessionOptions {
  llm: LlmProvider;
  view: DeckView;
  logger: DebugLogger;
  intervalMs: number;
  onStatus: (text: string) => void;
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
      options: { timeoutMs: Math.max(15_000, options.intervalMs * 3) },
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
    if (outcome === 'error') {
      const local = this.options.llm.name.startsWith('ollama');
      this.options.onStatus(
        local
          ? 'No slides yet: the AI model (Ollama) is not running. See README, "Providers".'
          : `No slides yet: ${this.options.llm.name} is not reachable. Retrying.`,
      );
    } else if (outcome !== 'skipped-busy' && outcome !== 'skipped-idle') {
      this.options.onStatus(`${this.options.llm.name}: ${stats.calls} calls, ${stats.appliedOps} changes`);
    }
  }
}
