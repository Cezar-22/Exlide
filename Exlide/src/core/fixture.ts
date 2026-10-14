// Transcript fixtures for replay mode and the paste-a-transcript dev mode.
//
// Format, one entry per line:
//   [mm:ss] spoken text            a final transcript segment at that time
//   [mm:ss] >> steering note       a typed steering note at that time
//   plain text                     timed automatically after the previous line
//   # comment                      ignored
// Plain prose (e.g. a pasted transcript) is split into sentences and timed at
// a normal speaking rate.

export interface FixtureEvent {
  readonly at: number;
  readonly kind: 'speech' | 'steer';
  readonly text: string;
}

const WORDS_PER_SECOND = 2.5;
const STAMP = /^\[(\d+):(\d{1,2})(?:\.(\d+))?\]\s*(.*)$/;

export function speakingTimeMs(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(800, Math.round((words / WORDS_PER_SECOND) * 1000));
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

export function parseFixture(source: string): FixtureEvent[] {
  const events: FixtureEvent[] = [];
  let clock = 0;
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const stamped = STAMP.exec(line);
    let body = line;
    if (stamped) {
      const [, min = '0', sec = '0', frac = '', rest = ''] = stamped;
      clock = (Number(min) * 60 + Number(sec)) * 1000 + (frac === '' ? 0 : Math.round(Number(`0.${frac}`) * 1000));
      body = rest.trim();
    }
    if (body.startsWith('>>')) {
      events.push({ at: clock, kind: 'steer', text: body.slice(2).trim() });
      continue;
    }
    for (const sentence of stamped ? [body] : splitSentences(body)) {
      if (sentence === '') continue;
      clock += speakingTimeMs(sentence);
      events.push({ at: clock, kind: 'speech', text: sentence });
    }
  }
  return events.sort((a, b) => a.at - b.at);
}
