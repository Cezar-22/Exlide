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
  /** Buffer version right after this segment was added. */
  readonly seq: number;
}

export interface TranscriptSplit {
  /** Context the director has already seen. */
  earlier: string;
  /** Words that arrived after the given version. */
  latest: string;
}

/** Keeps the end of `text`, at most `maxChars`, cut at a word boundary. */
function tail(text: string, maxChars: number): string {
  if (maxChars <= 0) return '';
  if (text.length <= maxChars) return text;
  const start = text.length - maxChars;
  const cut = text.slice(start);
  if (text[start - 1] === ' ') return cut;
  const firstSpace = cut.indexOf(' ');
  return firstSpace === -1 ? cut : cut.slice(firstSpace + 1);
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
    this.version += 1;
    this.finals.push({ text, at: segment.at, seq: this.version });
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
    return tail(this.finals.map((s) => s.text).join(' '), maxChars);
  }

  /**
   * Recent text split into what the director already saw (up to `version`)
   * and what is new, together at most `maxChars`. New words get priority.
   */
  splitSince(version: number, maxChars: number): TranscriptSplit {
    const join = (segments: FinalSegment[]) => segments.map((s) => s.text).join(' ');
    const latest = tail(join(this.finals.filter((s) => s.seq > version)), maxChars);
    const earlier = tail(join(this.finals.filter((s) => s.seq <= version)), maxChars - latest.length - 1);
    return { earlier, latest };
  }

  clear(): void {
    this.finals = [];
    this.interimText = '';
    this.version += 1;
  }
}
