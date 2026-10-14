import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFixture, speakingTimeMs } from '../src/core/fixture.ts';

describe('parseFixture', () => {
  it('parses timestamps, steering notes and comments', () => {
    const events = parseFixture(['# a comment', '[00:05] Hello everyone.', '[01:02.5] >> skip the history', ''].join('\n'));
    expect(events).toEqual([
      { at: 5000 + speakingTimeMs('Hello everyone.'), kind: 'speech', text: 'Hello everyone.' },
      { at: 62_500, kind: 'steer', text: 'skip the history' },
    ]);
  });

  it('splits pasted prose into sentences timed at a speaking rate', () => {
    const events = parseFixture('First point here. Second point! And a third?');
    expect(events.map((e) => e.text)).toEqual(['First point here.', 'Second point!', 'And a third?']);
    expect(events.every((e, i) => i === 0 || e.at > (events[i - 1]?.at ?? 0))).toBe(true);
  });

  it('parses every fixture in fixtures/', () => {
    const dir = new URL('../fixtures/', import.meta.url);
    const files = readdirSync(dir).filter((f) => f.endsWith('.txt'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const events = parseFixture(readFileSync(new URL(file, dir), 'utf8'));
      expect(events.length, file).toBeGreaterThan(10);
    }
  });
});
