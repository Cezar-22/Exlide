import { describe, expect, it } from 'vitest';
import { emptyDeck, LIMITS, type DeckState } from '../src/core/deck.ts';
import { applyOperations } from '../src/core/reducer.ts';
import { parseModelOutput, validateOperation, validateOperations } from '../src/core/schema.ts';

const deck: DeckState = applyOperations(
  emptyDeck(0),
  [
    { op: 'add_slide', title: 'Intro', bullets: ['hello'] },
    { op: 'add_slide', title: 'Results', bullets: [] },
  ],
  0,
);

function errorOf(raw: unknown, d: DeckState = deck): string {
  const r = validateOperation(raw, d);
  if (r.ok) throw new Error(`expected failure, got ${JSON.stringify(r.value)}`);
  return r.error;
}

describe('validateOperation', () => {
  it('accepts every well-formed operation', () => {
    const raws = [
      { op: 'no_change' },
      { op: 'add_slide', title: 'Next', bullets: ['a', 'b', 'c'] },
      { op: 'add_slide', title: 'Next', bullets: [], after: 's1' },
      { op: 'update_bullets', slide: 's2', bullets: ['x'] },
      { op: 'set_title', slide: 's1', title: 'Welcome' },
      { op: 'remove_slide', slide: 's2' },
      { op: 'reorder', order: ['s2', 's1'] },
    ];
    for (const raw of raws) expect(validateOperation(raw, deck).ok, JSON.stringify(raw)).toBe(true);
  });

  it('cleans whitespace and bullet markers, and drops empty bullets', () => {
    const r = validateOperation(
      { op: 'add_slide', title: '  Big   idea ', bullets: ['- first', '• second', '2) third', '   ', '3.5 million users'] },
      deck,
    );
    expect(r).toEqual({
      ok: true,
      value: { op: 'add_slide', title: 'Big idea', bullets: ['first', 'second', 'third', '3.5 million users'] },
    });
  });

  it('rejects non-objects and unknown ops', () => {
    expect(errorOf('add_slide')).toMatch(/object/);
    expect(errorOf(null)).toMatch(/object/);
    expect(errorOf([{ op: 'no_change' }])).toMatch(/object/);
    expect(errorOf({ op: 'delete_everything' })).toMatch(/unknown op/);
    expect(errorOf({})).toMatch(/unknown op/);
  });

  it('rejects unknown slide references', () => {
    expect(errorOf({ op: 'update_bullets', slide: 's7', bullets: [] })).toMatch(/unknown slide/);
    expect(errorOf({ op: 'set_title', slide: 1, title: 'x' })).toMatch(/slide id/);
    expect(errorOf({ op: 'add_slide', title: 'x', bullets: [], after: 's9' })).toMatch(/unknown slide/);
  });

  it('enforces bullet and title limits', () => {
    const tooMany = Array.from({ length: LIMITS.maxBullets + 1 }, (_, i) => `b${i}`);
    expect(errorOf({ op: 'update_bullets', slide: 's1', bullets: tooMany })).toMatch(/more than/);
    expect(errorOf({ op: 'update_bullets', slide: 's1', bullets: ['x'.repeat(LIMITS.maxBulletLength + 1)] })).toMatch(/longer/);
    expect(errorOf({ op: 'update_bullets', slide: 's1', bullets: 'x' })).toMatch(/array/);
    expect(errorOf({ op: 'update_bullets', slide: 's1', bullets: [3] })).toMatch(/only strings/);
    expect(errorOf({ op: 'set_title', slide: 's1', title: 'x'.repeat(LIMITS.maxTitleLength + 1) })).toMatch(/longer/);
    expect(errorOf({ op: 'set_title', slide: 's1', title: '   ' })).toMatch(/empty/);
  });

  it('rejects a duplicate slide title (weak models love re-adding the same slide)', () => {
    expect(errorOf({ op: 'add_slide', title: 'intro', bullets: [] })).toMatch(/already exists/);
  });

  it('rejects a reorder that is not a permutation', () => {
    expect(errorOf({ op: 'reorder', order: ['s1'] })).toMatch(/every existing/);
    expect(errorOf({ op: 'reorder', order: ['s1', 's1'] })).toMatch(/every existing/);
    expect(errorOf({ op: 'reorder', order: ['s1', 's3'] })).toMatch(/every existing/);
    expect(errorOf({ op: 'reorder', order: 's1,s2' })).toMatch(/array/);
  });

  it('rejects add_slide when the deck is full', () => {
    const full = applyOperations(
      emptyDeck(0),
      Array.from({ length: LIMITS.maxSlides }, (_, i) => ({ op: 'add_slide' as const, title: `T${i}`, bullets: [] })),
      0,
    );
    expect(errorOf({ op: 'add_slide', title: 'one more', bullets: [] }, full)).toMatch(/already has/);
  });
});

describe('validateOperations', () => {
  it('keeps valid ops, drops invalid ones with the reason', () => {
    const report = validateOperations(
      [{ op: 'set_title', slide: 's1', title: 'Hi' }, { op: 'explode' }, { op: 'remove_slide', slide: 's9' }],
      deck,
    );
    expect(report.valid).toEqual([{ op: 'set_title', slide: 's1', title: 'Hi' }]);
    expect(report.dropped).toHaveLength(2);
    expect(report.dropped[0]).toEqual({ raw: { op: 'explode' }, error: expect.stringMatching(/unknown op/) });
  });

  it('judges each op against the deck as changed by the previous ones', () => {
    const report = validateOperations(
      [
        { op: 'add_slide', title: 'New', bullets: [] }, // becomes s3
        { op: 'update_bullets', slide: 's3', bullets: ['works'] },
        { op: 'remove_slide', slide: 's1' },
        { op: 'set_title', slide: 's1', title: 'gone' }, // s1 no longer exists
      ],
      deck,
    );
    expect(report.valid.map((o) => o.op)).toEqual(['add_slide', 'update_bullets', 'remove_slide']);
    expect(report.dropped.map((d) => d.error)).toEqual([expect.stringMatching(/unknown slide/)]);
  });
});

describe('parseModelOutput', () => {
  it('accepts a bare array', () => {
    expect(parseModelOutput('[{"op":"no_change"}]')).toEqual({ ok: true, value: [{ op: 'no_change' }] });
  });

  it('accepts {"operations": [...]}, a single op object, and code fences', () => {
    expect(parseModelOutput('{"operations":[{"op":"no_change"}]}')).toEqual({ ok: true, value: [{ op: 'no_change' }] });
    expect(parseModelOutput('{"op":"no_change"}')).toEqual({ ok: true, value: [{ op: 'no_change' }] });
    expect(parseModelOutput('```json\n[{"op":"no_change"}]\n```')).toEqual({ ok: true, value: [{ op: 'no_change' }] });
  });

  it('digs JSON out of surrounding chatter', () => {
    expect(parseModelOutput('Sure! Here you go: [{"op":"no_change"}] Hope this helps.')).toEqual({
      ok: true,
      value: [{ op: 'no_change' }],
    });
  });

  it('fails on non-JSON or the wrong top-level shape', () => {
    expect(parseModelOutput('no change needed').ok).toBe(false);
    expect(parseModelOutput('[{"op": "no_change"').ok).toBe(false);
    expect(parseModelOutput('{"slides": []}').ok).toBe(false);
    expect(parseModelOutput('42').ok).toBe(false);
  });
});
