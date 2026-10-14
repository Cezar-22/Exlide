// The slide director. On each tick it may send the transcript window, the
// deck and any steering note to the LLM, then validates the reply, applies
// the stability rules and updates the deck. It never runs two calls at once.
// Timing (when to tick) is driven from outside so this stays platform-free.

import type { DebugLogger } from './debug.ts';
import type { Lang } from './language.ts';
import { emptyDeck, type DeckState } from './deck.ts';
import { DIRECTOR_REPLY_SCHEMA } from './json-schema.ts';
import type { Operation } from './operations.ts';
import {
  buildDirectorUserPrompt,
  buildRetryUserPrompt,
  coveredSummary,
  DIRECTOR_SYSTEM_PROMPT,
} from './prompts.ts';
import type { LlmProvider, LlmRequest } from './providers.ts';
import { applyOperations } from './reducer.ts';
import { parseModelOutput, validateOperations, type DroppedOperation } from './schema.ts';
import { applyStability, DEFAULT_STABILITY, dwellRemaining, type StabilityOptions } from './stability.ts';
import type { TranscriptBuffer } from './transcript.ts';

export interface DirectorOptions {
  stability: StabilityOptions;
  /** Characters of recent transcript sent per call. Small = fewer tokens, less latency. */
  maxTranscriptChars: number;
  /** Lesson language; slides are written in it. */
  language: Lang;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

export const DEFAULT_DIRECTOR_OPTIONS: DirectorOptions = {
  stability: DEFAULT_STABILITY,
  maxTranscriptChars: 1200,
  language: 'en',
  temperature: 0.2,
  maxTokens: 500,
  timeoutMs: 20_000,
};

export interface DirectorStats {
  ticks: number;
  calls: number;
  skippedBusy: number;
  skippedIdle: number;
  skippedDwell: number;
  retries: number;
  fallbacks: number;
  errors: number;
  validOps: number;
  droppedOps: number;
  heldOps: number;
  appliedOps: number;
  noChangeReplies: number;
  latenciesMs: number[];
}

export type TickOutcome =
  | 'skipped-busy'
  | 'skipped-idle'
  | 'skipped-dwell'
  | 'no-change'
  | 'changed'
  | 'held'
  | 'fallback'
  | 'error';

export interface DirectorDeps {
  llm: LlmProvider;
  transcript: TranscriptBuffer;
  clock: () => number;
  logger: DebugLogger;
  options?: Partial<DirectorOptions>;
  initialDeck?: DeckState;
}

interface Attempt {
  ops: Operation[];
  dropped: DroppedOperation[];
  /** Set when the reply should be retried (unparseable or nothing valid in it). */
  failure: string | null;
  raw: string;
}

function emptyStats(): DirectorStats {
  return {
    ticks: 0,
    calls: 0,
    skippedBusy: 0,
    skippedIdle: 0,
    skippedDwell: 0,
    retries: 0,
    fallbacks: 0,
    errors: 0,
    validOps: 0,
    droppedOps: 0,
    heldOps: 0,
    appliedOps: 0,
    noChangeReplies: 0,
    latenciesMs: [],
  };
}

export class Director {
  private readonly deps: DirectorDeps;
  private readonly options: DirectorOptions;
  private readonly listeners = new Set<(deck: DeckState) => void>();
  private currentDeck: DeckState;
  private busy = false;
  private pendingSteering: string[] = [];
  private lastTranscriptVersion: number;
  readonly stats: DirectorStats = emptyStats();

  constructor(deps: DirectorDeps) {
    this.deps = deps;
    this.options = { ...DEFAULT_DIRECTOR_OPTIONS, ...deps.options };
    this.currentDeck = deps.initialDeck ?? emptyDeck(deps.clock());
    this.lastTranscriptVersion = deps.transcript.version;
  }

  get deck(): DeckState {
    return this.currentDeck;
  }

  get isBusy(): boolean {
    return this.busy;
  }

  get hasPendingSteering(): boolean {
    return this.pendingSteering.length > 0;
  }

  onDeckChange(listener: (deck: DeckState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Queues a typed steering note. It is sent on the next tick and overrides stability. */
  steer(note: string): void {
    const trimmed = note.replace(/\s+/g, ' ').trim();
    if (trimmed !== '') this.pendingSteering.push(trimmed);
  }

  /** Milliseconds until the stability rule lets the director change the deck. */
  dwellRemaining(): number {
    return dwellRemaining(this.currentDeck, this.deps.clock(), this.options.stability);
  }

  async tick(): Promise<TickOutcome> {
    const { transcript, logger } = this.deps;
    this.stats.ticks += 1;
    if (this.busy) {
      this.stats.skippedBusy += 1;
      logger.log('director.skip', { reason: 'previous call still running' });
      return 'skipped-busy';
    }

    const steering = this.pendingSteering.length > 0 ? this.pendingSteering.join(' / ') : null;
    if (steering === null) {
      if (transcript.version === this.lastTranscriptVersion) {
        this.stats.skippedIdle += 1;
        return 'skipped-idle';
      }
      if (this.dwellRemaining() > 0) {
        this.stats.skippedDwell += 1;
        return 'skipped-dwell';
      }
    }

    this.busy = true;
    const steeringCount = this.pendingSteering.length;
    const transcriptVersion = transcript.version;
    try {
      const outcome = await this.direct(steering, this.lastTranscriptVersion);
      // Only consume what this call actually saw; notes typed meanwhile wait for the next tick.
      this.pendingSteering = this.pendingSteering.slice(steeringCount);
      this.lastTranscriptVersion = transcriptVersion;
      return outcome;
    } catch (error) {
      this.stats.errors += 1;
      logger.log('director.error', { error: error instanceof Error ? error.message : String(error) });
      return 'error';
    } finally {
      this.busy = false;
    }
  }

  private async direct(steering: string | null, seenVersion: number): Promise<TickOutcome> {
    const { transcript, clock, logger } = this.deps;
    transcript.prune(clock());
    transcript.summary = coveredSummary(this.currentDeck);
    const deckAtCall = this.currentDeck;
    const { earlier, latest } = transcript.splitSince(seenVersion, this.options.maxTranscriptChars);
    const userPrompt = buildDirectorUserPrompt({
      deck: deckAtCall,
      earlier,
      latest,
      summary: transcript.summary,
      steering,
      language: this.options.language,
    });

    let attempt = await this.attempt(userPrompt, deckAtCall);
    if (attempt.failure !== null) {
      this.stats.retries += 1;
      logger.log('director.retry', { error: attempt.failure, raw: attempt.raw });
      attempt = await this.attempt(buildRetryUserPrompt(userPrompt, attempt.raw, attempt.failure), deckAtCall);
      if (attempt.failure !== null) {
        this.stats.fallbacks += 1;
        logger.log('director.fallback', { error: attempt.failure, raw: attempt.raw });
        return 'fallback';
      }
    }

    const changes = attempt.ops.filter((op) => op.op !== 'no_change');
    if (changes.length === 0) {
      this.stats.noChangeReplies += 1;
      return 'no-change';
    }

    const now = clock();
    const stable = applyStability(changes, this.currentDeck, now, this.options.stability, steering);
    this.stats.heldOps += stable.held.length;
    for (const held of stable.held) logger.log('op.held', { op: held.op, reason: held.reason });
    if (stable.allowed.length === 0) return 'held';

    // Re-validate against the live deck in case it changed while the model was thinking.
    const report = validateOperations(stable.allowed, this.currentDeck);
    for (const d of report.dropped) logger.log('op.dropped', { ...d });
    const next = applyOperations(this.currentDeck, report.valid, now);
    this.stats.appliedOps += report.valid.length;
    if (next === this.currentDeck) return 'no-change';
    this.currentDeck = next;
    for (const listener of this.listeners) listener(next);
    return 'changed';
  }

  private async attempt(userPrompt: string, deck: DeckState): Promise<Attempt> {
    const { llm, logger } = this.deps;
    const request: LlmRequest = {
      system: DIRECTOR_SYSTEM_PROMPT,
      user: userPrompt,
      jsonSchema: DIRECTOR_REPLY_SCHEMA,
      temperature: this.options.temperature,
      maxTokens: this.options.maxTokens,
      timeoutMs: this.options.timeoutMs,
    };
    this.stats.calls += 1;
    logger.log('director.request', { provider: llm.name, user: userPrompt });
    const started = Date.now(); // wall time, even when replay simulates the clock
    const raw = await llm.complete(request);
    this.stats.latenciesMs.push(Date.now() - started);
    logger.log('director.response', { raw });

    const parsed = parseModelOutput(raw);
    if (!parsed.ok) return { ops: [], dropped: [], failure: parsed.error, raw };
    const report = validateOperations(parsed.value, deck);
    this.stats.validOps += report.valid.length;
    this.stats.droppedOps += report.dropped.length;
    for (const d of report.dropped) logger.log('op.dropped', { ...d });
    const failure =
      report.valid.length === 0 && report.dropped.length > 0
        ? report.dropped.map((d) => d.error).join('; ')
        : null;
    return { ops: report.valid, dropped: report.dropped, failure, raw };
  }
}
