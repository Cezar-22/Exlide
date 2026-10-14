// Rolling transcript: the last few minutes of final text, the current interim
// text, and a short running summary of what the deck already covers.

import type { TranscriptSegment } from './providers.ts';

export interface TranscriptOptions {
  /** Final segments older than this are dropped from the window. */
  windowMs: number;
}

interface FinalSegment {
  readonly text: string;
  readonly at: number;
}

const SENTENCE_END = /[.!?…]["')\]]?$/;

export class TranscriptBuffer {
  private finals: FinalSegment[] = [];
  private interimText = '';
  private readonly options: TranscriptOptions;
  /** Bumped whenever new final text arrives. The director uses it to skip idle ticks. */
  version = 0;
  /** Short description of what has been covered so far (set by the director). */
  summary = '';

  constructor(options: TranscriptOptions = { windowMs: 3 * 60_000 }) {
    this.options = options;
  }

  add(segment: TranscriptSegment): void {
    const text = segment.text.replace(/\s+/g, ' ').trim();
    if (!segment.isFinal) {
      this.interimText = text;
      return;
    }
    this.interimText = '';
    if (text === '') return;
    this.finals.push({ text, at: segment.at });
    this.version += 1;
  }

  /** Drops final text that has fallen out of the time window. */
  prune(now: number): void {
    const cutoff = now - this.options.windowMs;
    this.finals = this.finals.filter((s) => s.at >= cutoff);
  }

  get interim(): string {
    return this.interimText;
  }

  /** True when the latest final segment ends a sentence. */
  endsSentence(): boolean {
    const last = this.finals.at(-1);
    return last !== undefined && SENTENCE_END.test(last.text);
  }

  /**
   * The most recent final text, at most `maxChars` long, cut at a word
   * boundary so the model never sees half a word.
   */
  recentText(maxChars: number): string {
    const all = this.finals.map((s) => s.text).join(' ');
    if (all.length <= maxChars) return all;
    const start = all.length - maxChars;
    const tail = all.slice(start);
    if (all[start - 1] === ' ') return tail;
    const firstSpace = tail.indexOf(' ');
    return firstSpace === -1 ? tail : tail.slice(firstSpace + 1);
  }

  clear(): void {
    this.finals = [];
    this.interimText = '';
    this.version += 1;
  }
}
