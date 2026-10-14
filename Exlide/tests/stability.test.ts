import { describe, expect, it } from 'vitest';
import { emptyDeck } from '../src/core/deck.ts';
import { applyOperation } from '../src/core/reducer.ts';
import { applyStability, DEFAULT_STABILITY, dwellRemaining } from '../src/core/stability.ts';

const opts = DEFAULT_STABILITY;
// One slide, shown at t=0 with three bullets.
const deck = applyOperation(emptyDeck(0), { op: 'add_slide', title: 'A', bullets: ['one', 'two', 'three'] }, 0);

describe('applyStability', () => {
  it('holds every change while the slide is younger than the dwell time', () => {
    const r = applyStability([{ op: 'add_slide', title: 'B', bullets: [] }], deck, 7999, opts, null);
    expect(r.allowed).toEqual([]);
    expect(r.held[0]?.reason).toMatch(/long enough/);
    expect(dwellRemaining(deck, 7999, opts)).toBe(1);
  });

  it('allows changes after the dwell time', () => {
    const r = applyStability([{ op: 'add_slide', title: 'B', bullets: [] }], deck, 8000, opts, null);
    expect(r.allowed).toHaveLength(1);
  });

  it('an empty deck has no dwell time', () => {
    expect(dwellRemaining(emptyDeck(0), 1, opts)).toBe(0);
    expect(applyStability([{ op: 'add_slide', title: 'A', bullets: [] }], emptyDeck(0), 1, opts, null).allowed).toHaveLength(1);
  });

  it('steering overrides the dwell time and churn limits', () => {
    const ops = [
      { op: 'add_slide', title: 'B', bullets: [] },
      { op: 'add_slide', title: 'C', bullets: [] },
    ] as const;
    const r = applyStability(ops, deck, 100, opts, 'add two slides');
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
      null,
    );
    expect(r.allowed.map((o) => o.op)).toEqual(['add_slide']);
    expect(r.held[0]?.reason).toMatch(/new slide/);
  });

  it('allows appending bullets and one edit, but not a rewrite', () => {
    const append = applyStability([{ op: 'update_bullets', slide: 's1', bullets: ['one', 'two', 'three', 'four'] }], deck, 10_000, opts, null);
    expect(append.allowed).toHaveLength(1);
    const oneEdit = applyStability([{ op: 'update_bullets', slide: 's1', bullets: ['One', 'two', 'drei'] }], deck, 10_000, opts, null);
    expect(oneEdit.allowed).toHaveLength(1); // case-insensitive match, one changed
    const rewrite = applyStability([{ op: 'update_bullets', slide: 's1', bullets: ['uno', 'dos', 'three'] }], deck, 10_000, opts, null);
    expect(rewrite.allowed).toEqual([]);
    expect(rewrite.held[0]?.reason).toMatch(/rewrite 2/);
  });

  it('holds remove_slide and reorder unless a steering note asks', () => {
    const ops = [
      { op: 'remove_slide', slide: 's1' },
      { op: 'reorder', order: ['s1'] },
    ] as const;
    const auto = applyStability(ops, deck, 10_000, opts, null);
    expect(auto.allowed).toEqual([]);
    expect(auto.held.map((h) => h.reason)).toEqual(['remove_slide only on a steering note', 'reorder only on a steering note']);
    expect(applyStability(ops, deck, 10_000, opts, 'remove slide A and reorder the rest').allowed).toHaveLength(2);
    // A note that only asks for something else does not license deleting slides.
    const other = applyStability(ops, deck, 10_000, opts, 'add a slide with a practice exercise');
    expect(other.allowed).toEqual([]);
    expect(other.held[0]?.reason).toBe('steering note did not ask for remove_slide');
  });

  it('strips bullets copied from other slides, and holds a new slide that is only copies', () => {
    const two = applyOperation(deck, { op: 'add_slide', title: 'B', bullets: ['four'] }, 0);
    const copy = applyStability([{ op: 'add_slide', title: 'C', bullets: ['One.', 'two'] }], two, 10_000, opts, null);
    expect(copy.allowed).toEqual([]);
    expect(copy.held[0]?.reason).toMatch(/only repeats/);
    const mixed = applyStability([{ op: 'update_bullets', slide: 's2', bullets: ['four', 'three', 'five'] }], two, 10_000, opts, null);
    expect(mixed.allowed).toEqual([{ op: 'update_bullets', slide: 's2', bullets: ['four', 'five'] }]);
    // A recap asked for by the speaker may repeat bullets.
    const recap = applyStability([{ op: 'add_slide', title: 'Recap', bullets: ['one', 'four'] }], two, 100, opts, 'recap on one slide');
    expect(recap.allowed).toHaveLength(1);
  });

  it('drops no_change from the result', () => {
    expect(applyStability([{ op: 'no_change' }], deck, 10_000, opts, null)).toEqual({ allowed: [], held: [] });
  });
});
