import { describe, expect, it } from 'vitest';
import { currentSlide, emptyDeck, type DeckState } from '../src/core/deck.ts';
import { applyOperation, applyOperations } from '../src/core/reducer.ts';

function deckWith(titles: string[]): DeckState {
  return applyOperations(
    emptyDeck(0),
    titles.map((title) => ({ op: 'add_slide', title, bullets: [] })),
    0,
  );
}

describe('applyOperation', () => {
  it('add_slide mints ids, shows the new slide and records the time', () => {
    const d = applyOperation(emptyDeck(0), { op: 'add_slide', title: 'Intro', bullets: ['a'] }, 1000);
    expect(d.slides).toEqual([{ id: 's1', title: 'Intro', bullets: ['a'] }]);
    expect(d.currentId).toBe('s1');
    expect(d.changedAt).toBe(1000);
    expect(d.version).toBe(1);
    expect(d.nextSeq).toBe(2);
  });

  it('add_slide inserts after the current slide by default, or after `after`', () => {
    let d = deckWith(['A', 'B', 'C']);
    d = applyOperation(d, { op: 'update_bullets', slide: 's1', bullets: ['x'] }, 1); // show A
    d = applyOperation(d, { op: 'add_slide', title: 'A2', bullets: [] }, 2);
    expect(d.slides.map((s) => s.title)).toEqual(['A', 'A2', 'B', 'C']);
    d = applyOperation(d, { op: 'add_slide', title: 'C2', bullets: [], after: 's3' }, 3);
    expect(d.slides.map((s) => s.title)).toEqual(['A', 'A2', 'B', 'C', 'C2']);
    expect(currentSlide(d)?.title).toBe('C2');
  });

  it('never reuses ids after a removal', () => {
    let d = deckWith(['A', 'B']);
    d = applyOperation(d, { op: 'remove_slide', slide: 's2' }, 1);
    d = applyOperation(d, { op: 'add_slide', title: 'C', bullets: [] }, 2);
    expect(d.slides.map((s) => s.id)).toEqual(['s1', 's3']);
  });

  it('update_bullets and set_title change content and show the slide', () => {
    let d = deckWith(['A', 'B']);
    d = applyOperation(d, { op: 'update_bullets', slide: 's1', bullets: ['one', 'two'] }, 5);
    expect(d.currentId).toBe('s1');
    expect(d.slides[0]?.bullets).toEqual(['one', 'two']);
    d = applyOperation(d, { op: 'set_title', slide: 's1', title: 'Alpha' }, 6);
    expect(d.slides[0]?.title).toBe('Alpha');
    expect(d.changedAt).toBe(6);
  });

  it('returns the same object for edits that change nothing (no flicker)', () => {
    const d = applyOperation(emptyDeck(0), { op: 'add_slide', title: 'A', bullets: ['x'] }, 0);
    expect(applyOperation(d, { op: 'update_bullets', slide: 's1', bullets: ['x'] }, 9)).toBe(d);
    expect(applyOperation(d, { op: 'set_title', slide: 's1', title: 'A' }, 9)).toBe(d);
    expect(applyOperation(d, { op: 'no_change' }, 9)).toBe(d);
    expect(applyOperation(d, { op: 'reorder', order: ['s1'] }, 9)).toBe(d);
  });

  it('remove_slide of the current slide shows the previous one, or the first, or nothing', () => {
    let d = deckWith(['A', 'B', 'C']); // current = s3
    d = applyOperation(d, { op: 'remove_slide', slide: 's3' }, 1);
    expect(d.currentId).toBe('s2');
    d = applyOperation(d, { op: 'update_bullets', slide: 's1', bullets: ['x'] }, 2);
    d = applyOperation(d, { op: 'remove_slide', slide: 's1' }, 3);
    expect(d.currentId).toBe('s2');
    d = applyOperation(d, { op: 'remove_slide', slide: 's2' }, 4);
    expect(d.currentId).toBeNull();
    expect(d.slides).toEqual([]);
  });

  it('reorder keeps every slide and the current one', () => {
    let d = deckWith(['A', 'B', 'C']);
    d = applyOperation(d, { op: 'reorder', order: ['s3', 's1', 's2'] }, 1);
    expect(d.slides.map((s) => s.title)).toEqual(['C', 'A', 'B']);
    expect(d.currentId).toBe('s3');
  });

  it('ignores references to unknown slides instead of throwing', () => {
    const d = deckWith(['A']);
    expect(applyOperation(d, { op: 'remove_slide', slide: 's9' }, 1)).toBe(d);
    expect(applyOperation(d, { op: 'reorder', order: ['s9'] }, 1)).toBe(d);
  });

  it('does not mutate the input deck', () => {
    const d = deckWith(['A']);
    const snapshot = JSON.stringify(d);
    applyOperations(d, [
      { op: 'update_bullets', slide: 's1', bullets: ['x'] },
      { op: 'add_slide', title: 'B', bullets: [] },
      { op: 'remove_slide', slide: 's1' },
    ], 5);
    expect(JSON.stringify(d)).toBe(snapshot);
  });
});
