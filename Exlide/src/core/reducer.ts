// Pure deck reducer. Expects operations that already passed validation
// (schema.ts); on an unexpected reference it returns the deck unchanged
// rather than throwing, so a bad op can never break the display.

import { findSlide, type DeckState, type Slide } from './deck.ts';
import type { Operation } from './operations.ts';

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function commit(deck: DeckState, patch: Partial<DeckState>, now: number): DeckState {
  return { ...deck, ...patch, changedAt: now, version: deck.version + 1 };
}

function replaceSlide(deck: DeckState, next: Slide): readonly Slide[] {
  return deck.slides.map((s) => (s.id === next.id ? next : s));
}

export function applyOperation(deck: DeckState, op: Operation, now: number): DeckState {
  switch (op.op) {
    case 'no_change':
      return deck;

    case 'add_slide': {
      const id = `s${deck.nextSeq}`;
      const anchor = op.after ?? deck.currentId;
      const anchorIndex = anchor === null ? -1 : deck.slides.findIndex((s) => s.id === anchor);
      const insertAt = anchorIndex === -1 ? deck.slides.length : anchorIndex + 1;
      const slides = [...deck.slides];
      slides.splice(insertAt, 0, { id, title: op.title, bullets: [...op.bullets] });
      return commit(deck, { slides, currentId: id, nextSeq: deck.nextSeq + 1 }, now);
    }

    case 'update_bullets': {
      const slide = findSlide(deck, op.slide);
      if (!slide) return deck;
      if (sameList(slide.bullets, op.bullets) && deck.currentId === slide.id) return deck;
      const slides = replaceSlide(deck, { ...slide, bullets: [...op.bullets] });
      return commit(deck, { slides, currentId: slide.id }, now);
    }

    case 'set_title': {
      const slide = findSlide(deck, op.slide);
      if (!slide) return deck;
      if (slide.title === op.title && deck.currentId === slide.id) return deck;
      const slides = replaceSlide(deck, { ...slide, title: op.title });
      return commit(deck, { slides, currentId: slide.id }, now);
    }

    case 'remove_slide': {
      const index = deck.slides.findIndex((s) => s.id === op.slide);
      if (index === -1) return deck;
      const slides = deck.slides.filter((s) => s.id !== op.slide);
      let currentId = deck.currentId;
      if (currentId === op.slide) {
        // Show the previous slide, or the new first one, or nothing.
        currentId = (slides[index - 1] ?? slides[0])?.id ?? null;
      }
      return commit(deck, { slides, currentId }, now);
    }

    case 'reorder': {
      const current = deck.slides.map((s) => s.id);
      if (sameList(current, op.order)) return deck;
      const byId = new Map(deck.slides.map((s) => [s.id, s]));
      const slides = op.order.map((id) => byId.get(id)).filter((s): s is Slide => s !== undefined);
      if (slides.length !== deck.slides.length) return deck;
      return commit(deck, { slides }, now);
    }
  }
}

export function applyOperations(deck: DeckState, ops: readonly Operation[], now: number): DeckState {
  return ops.reduce((d, op) => applyOperation(d, op, now), deck);
}
