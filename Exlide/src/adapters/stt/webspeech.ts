// Browser Web Speech API (Chrome / Edge). Free, no key. Chrome sends the
// audio to Google's recognizer, Edge to Microsoft's. The API stops by itself
// after pauses or about a minute, so this restarts it until stop() is called.
// It always listens on the OS default microphone (the API cannot pick one).

import type { SttProvider, SttState, TranscriptSegment, Unsubscribe } from '../../core/providers.ts';

/** The subset of SpeechRecognition we use (not in TypeScript's DOM lib). */
export interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  onaudiostart?: (() => void) | null;
  onsoundstart?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

export type RecognitionCtor = new () => RecognitionLike;

export function findRecognitionCtor(scope: object): RecognitionCtor | null {
  const ctor: unknown = Reflect.get(scope, 'SpeechRecognition') ?? Reflect.get(scope, 'webkitSpeechRecognition');
  // Unavoidable cast: the API is vendor-prefixed and untyped; we only know it is a constructor.
  return typeof ctor === 'function' ? (ctor as RecognitionCtor) : null;
}

const FATAL: Record<string, string> = {
  'not-allowed': 'Microphone permission denied. Allow it in the browser address bar.',
  'service-not-allowed': 'Speech recognition is blocked in this browser. Use Chrome or Edge.',
  'audio-capture': 'No microphone found. Check that one is connected and set as the default input.',
  'language-not-supported': 'This speech language is not supported.',
};

export class WebSpeechProvider implements SttProvider {
  readonly name = 'webspeech';
  private readonly ctor: RecognitionCtor | null;
  private readonly lang: string;
  private readonly now: () => number;
  private readonly onDebug: (event: string) => void;
  private recognition: RecognitionLike | null = null;
  private wanted = false;
  private failures = 0;
  private readonly segmentListeners = new Set<(s: TranscriptSegment) => void>();
  private readonly stateListeners = new Set<(s: SttState, detail?: string) => void>();

  constructor(options: {
    ctor: RecognitionCtor | null;
    lang: string;
    now?: () => number;
    /** Low-level recognizer events (audiostart, soundstart, errors...) for diagnostics. */
    onDebug?: (event: string) => void;
  }) {
    this.ctor = options.ctor;
    this.lang = options.lang;
    this.now = options.now ?? (() => Date.now());
    this.onDebug = options.onDebug ?? (() => undefined);
  }

  isSupported(): boolean {
    return this.ctor !== null;
  }

  start(): Promise<void> {
    if (!this.ctor) {
      this.setState('error', 'Speech recognition needs Chrome or Edge.');
      return Promise.resolve();
    }
    this.wanted = true;
    this.failures = 0;
    this.setState('starting');
    this.launch();
    return Promise.resolve();
  }

  stop(): void {
    this.wanted = false;
    this.recognition?.stop();
    this.recognition = null;
    this.setState('idle');
  }

  onSegment(listener: (segment: TranscriptSegment) => void): Unsubscribe {
    this.segmentListeners.add(listener);
    return () => this.segmentListeners.delete(listener);
  }

  onStateChange(listener: (state: SttState, detail?: string) => void): Unsubscribe {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private launch(): void {
    if (!this.ctor || !this.wanted) return;
    const rec = new this.ctor();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      this.failures = 0;
      if (this.recognition === rec) this.setState('listening');
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        this.emit({ text: result[0].transcript, isFinal: result.isFinal, at: this.now() });
      }
    };
    rec.onaudiostart = () => this.onDebug('audiostart');
    rec.onsoundstart = () => this.onDebug('soundstart');
    rec.onspeechstart = () => this.onDebug('speechstart');
    rec.onerror = (event) => {
      this.onDebug(`error:${event.error}`);
      const fatal = FATAL[event.error];
      if (fatal) {
        this.wanted = false;
        this.setState('error', fatal);
      } else if (event.error === 'network') {
        this.failures += 1;
      }
      // 'no-speech' and 'aborted' are normal during pauses; onend restarts.
    };
    rec.onend = () => {
      this.onDebug('end');
      if (this.recognition !== rec || !this.wanted) return;
      if (this.failures >= 5) {
        this.wanted = false;
        this.setState('error', 'Speech service unreachable. Check the internet connection.');
        return;
      }
      // Back off after network errors, otherwise restart at once so no words are lost.
      setTimeout(() => this.launch(), this.failures === 0 ? 0 : 500 * 2 ** this.failures);
    };
    this.recognition = rec;
    try {
      rec.start();
      this.setState('listening');
    } catch (error) {
      this.setState('error', error instanceof Error ? error.message : String(error));
    }
  }

  private emit(segment: TranscriptSegment): void {
    for (const l of this.segmentListeners) l(segment);
  }

  private setState(state: SttState, detail?: string): void {
    for (const l of this.stateListeners) l(state, detail);
  }
}
