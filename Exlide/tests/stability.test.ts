import { describe, expect, it } from 'vitest';
import { emptyDeck } from '../src/core/deck.ts';
import { applyOperation } from '../src/core/reducer.ts';
import { applyStability, DEFAULT_STABILITY, dwellRemaining } from '../src/core/stability.ts';

const opts = DEFAULT_STABILITY;
// One slide, shown at t=0 with three bullets.
const deck = applyOperation(emptyDeck(0), { op: 'add_slide', title: 'A', bullets: ['one', 'two', 'three'] }, 0);

describe('applyStability', () => {
  it('holds every change while the slide is younger than the dwell time', () => {
    const r = applyStability([{ op: 'add_slide', title: 'B', bullets: [] }], deck, 7999, opts, false);
    expect(r.allowed).toEqual([]);
    expect(r.held[0]?.reason).toMatch(/long enough/);
    expect(dwellRemaining(deck, 7999, opts)).toBe(1);
  });

  it('allows changes after the dwell time', () => {
    const r = applyStability([{ op: 'add_slide', title: 'B', bullets: [] }], deck, 8000, opts, false);
    expect(r.allowed).toHaveLength(1);
  });

  it('an empty deck has no dwell time', () => {
    expect(dwellRemaining(emptyDeck(0), 1, opts)).toBe(0);
    expect(applyStability([{ op: 'add_slide', title: 'A', bullets: [] }], emptyDeck(0), 1, opts, false).allowed).toHaveLength(1);
  });

  it('steering overrides the dwell time and churn limits', () => {
    const ops = [
      { op: 'add_slide', title: 'B', bullets: [] },
      { op: 'add_slide', title: 'C', bullets: [] },
    ] as const;
    const r = applyStability(ops, deck, 100, opts, true);
    expect(r.allowed).toHaveLength(2);
    expect(r.held).toEqual([]);
  });

  it('allows only one new slide per response', () => {
    const r = applyStability(
      [
        { op: 'add_slide', title: 'B', bullets: [] },
        { op: 'add_slide', title: 'C', bullets: [] },
      ],
      deck,
      10_000,
      opts,
      false,
    );
    expect(r.allowed.map((o) => o.op)).toEqual(['add_slide']);
    expect(r.held[0]?.reason).toMatch(/new slide/);
  });

  it('allows appending bullets and one edit, but not a rewrite', () => {
    const append = applyStability([{ op: 'update_bullets', slide: 's1', bullets: ['one', 'two', 'three', 'four'] }], deck, 10_000, opts, false);
    expect(append.allowed).toHaveLength(1);
    const oneEdit = applyStability([{ op: 'update_bullets', slide: 's1', bullets: ['One', 'two', 'drei'] }], deck, 10_000, opts, false);
    expect(oneEdit.allowed).toHaveLength(1); // case-insensitive match, one changed
    const rewrite = applyStability([{ op: 'update_bullets', slide: 's1', bullets: ['uno', 'dos', 'three'] }], deck, 10_000, opts, false);
    expect(rewrite.allowed).toEqual([]);
    expect(rewrite.held[0]?.reason).toMatch(/rewrite 2/);
  });

  it('drops no_change from the result', () => {
    expect(applyStability([{ op: 'no_change' }], deck, 10_000, opts, false)).toEqual({ allowed: [], held: [] });
  });
});
