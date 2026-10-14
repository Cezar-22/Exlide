import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TranscriptSegment } from '../src/core/providers.ts';
import { WebSpeechProvider, type RecognitionLike, type RecognitionResultEvent } from '../src/adapters/stt/webspeech.ts';

const instances: FakeRecognition[] = [];

class FakeRecognition implements RecognitionLike {
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((event: RecognitionResultEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = 0;
  constructor() {
    instances.push(this);
  }
  start(): void {
    this.started += 1;
  }
  stop(): void {
    this.onend?.();
  }
  abort(): void {
    this.onend?.();
  }
  say(text: string, isFinal: boolean): void {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal, 0: { transcript: text } }] });
  }
}

function setup() {
  instances.length = 0;
  const stt = new WebSpeechProvider({ ctor: FakeRecognition, lang: 'en-GB', now: () => 42 });
  const segments: TranscriptSegment[] = [];
  const states: string[] = [];
  stt.onSegment((s) => segments.push(s));
  stt.onStateChange((s, d) => states.push(d ? `${s}:${d}` : s));
  return { stt, segments, states };
}

afterEach(() => vi.useRealTimers());

describe('WebSpeechProvider', () => {
  it('reports unsupported when the browser has no SpeechRecognition', () => {
    expect(new WebSpeechProvider({ ctor: null, lang: 'en-US' }).isSupported()).toBe(false);
  });

  it('configures continuous recognition with interim results and forwards segments', async () => {
    const { stt, segments } = setup();
    await stt.start();
    const rec = instances[0]!;
    expect(rec).toMatchObject({ lang: 'en-GB', continuous: true, interimResults: true, started: 1 });
    rec.say('a squared plus', false);
    rec.say('a squared plus b squared.', true);
    expect(segments).toEqual([
      { text: 'a squared plus', isFinal: false, at: 42 },
      { text: 'a squared plus b squared.', isFinal: true, at: 42 },
    ]);
  });

  it('restarts after the browser ends recognition on a pause', async () => {
    vi.useFakeTimers();
    const { stt } = setup();
    await stt.start();
    instances[0]!.onerror?.({ error: 'no-speech' });
    instances[0]!.onend?.();
    vi.runAllTimers();
    expect(instances).toHaveLength(2);
    expect(instances[1]!.started).toBe(1);
  });

  it('does not restart after stop()', async () => {
    vi.useFakeTimers();
    const { stt, states } = setup();
    await stt.start();
    stt.stop();
    vi.runAllTimers();
    expect(instances).toHaveLength(1);
    expect(states.at(-1)).toBe('idle');
  });

  it('stops with a clear message when mic permission is denied', async () => {
    vi.useFakeTimers();
    const { stt, states } = setup();
    await stt.start();
    instances[0]!.onerror?.({ error: 'not-allowed' });
    instances[0]!.onend?.();
    vi.runAllTimers();
    expect(instances).toHaveLength(1);
    expect(states.at(-1)).toMatch(/^error:Microphone permission denied/);
  });

  it('backs off on network errors and gives up after five in a row', async () => {
    vi.useFakeTimers();
    const { stt, states } = setup();
    await stt.start();
    for (let i = 0; i < 5; i++) {
      const rec = instances.at(-1)!;
      rec.onerror?.({ error: 'network' });
      rec.onend?.();
      vi.runAllTimers();
    }
    expect(instances).toHaveLength(5);
    expect(states.at(-1)).toMatch(/^error:Speech service unreachable/);
  });
});
