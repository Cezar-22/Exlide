import { describe, expect, it } from 'vitest';
import { TranscriptBuffer } from '../src/core/transcript.ts';

describe('TranscriptBuffer', () => {
  it('keeps final text, tracks interim separately, and bumps version only on finals', () => {
    const t = new TranscriptBuffer();
    t.add({ text: 'hello  there', isFinal: false, at: 1 });
    expect(t.interim).toBe('hello there');
    expect(t.version).toBe(0);
    t.add({ text: 'Hello there.', isFinal: true, at: 2 });
    expect(t.interim).toBe('');
    expect(t.version).toBe(1);
    expect(t.recentText(100)).toBe('Hello there.');
  });

  it('ignores empty finals', () => {
    const t = new TranscriptBuffer();
    t.add({ text: '   ', isFinal: true, at: 1 });
    expect(t.version).toBe(0);
    expect(t.recentText(100)).toBe('');
  });

  it('returns only the most recent text, cut at a word boundary', () => {
    const t = new TranscriptBuffer();
    t.add({ text: 'alpha beta gamma', isFinal: true, at: 1 });
    t.add({ text: 'delta epsilon', isFinal: true, at: 2 });
    expect(t.recentText(1000)).toBe('alpha beta gamma delta epsilon');
    expect(t.recentText(16)).toBe('delta epsilon');
    expect(t.recentText(18)).toBe('delta epsilon'); // tail "amma delta epsilon" drops the partial word
    expect(t.recentText(19)).toBe('gamma delta epsilon'); // cut lands exactly on a word start
  });

  it('prunes text older than the window', () => {
    const t = new TranscriptBuffer({ windowMs: 1000 });
    t.add({ text: 'old', isFinal: true, at: 0 });
    t.add({ text: 'new', isFinal: true, at: 1500 });
    t.prune(2000);
    expect(t.recentText(100)).toBe('new');
  });

  it('detects sentence ends', () => {
    const t = new TranscriptBuffer();
    expect(t.endsSentence()).toBe(false);
    t.add({ text: 'so the first point', isFinal: true, at: 1 });
    expect(t.endsSentence()).toBe(false);
    t.add({ text: 'is cost.', isFinal: true, at: 2 });
    expect(t.endsSentence()).toBe(true);
    t.add({ text: 'Right?"', isFinal: true, at: 3 });
    expect(t.endsSentence()).toBe(true);
  });

  it('clear() empties the buffer and counts as a change', () => {
    const t = new TranscriptBuffer();
    t.add({ text: 'x', isFinal: true, at: 1 });
    t.clear();
    expect(t.recentText(100)).toBe('');
    expect(t.version).toBe(2);
  });
});
