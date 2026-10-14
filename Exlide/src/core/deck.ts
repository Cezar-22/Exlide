// Deck state. Immutable: every change produces a new object, so the renderer
// can diff old vs new and never sees a half-applied state.

export interface Slide {
  readonly id: string;
  readonly title: string;
  readonly bullets: readonly string[];
}

export interface DeckState {
  readonly slides: readonly Slide[];
  /** Slide currently on screen, or null for an empty deck. */
  readonly currentId: string | null;
  /** When what is on screen last changed (navigation or content). Drives the stability rule. */
  readonly changedAt: number;
  /** Counter used to mint slide ids ("s1", "s2", ...). Never reused. */
  readonly nextSeq: number;
  /** Bumped on every effective change; equal versions mean identical decks. */
  readonly version: number;
}

export const LIMITS = {
  maxSlides: 40,
  maxBullets: 5,
  maxBulletLength: 120,
  maxTitleLength: 80,
} as const;

export function emptyDeck(now = 0): DeckState {
  return { slides: [], currentId: null, changedAt: now, nextSeq: 1, version: 0 };
}

export function findSlide(deck: DeckState, id: string): Slide | undefined {
  return deck.slides.find((s) => s.id === id);
}

export function currentSlide(deck: DeckState): Slide | undefined {
  return deck.currentId === null ? undefined : findSlide(deck, deck.currentId);
}
