// Stability rules applied to validated operations before they reach the deck.
// Prefer a calm deck over a responsive one: a slide that rewrites itself
// every few seconds is a bug. A typed steering note overrides all of this.

import { findSlide, type DeckState } from './deck.ts';
import type { Operation } from './operations.ts';

export interface StabilityOptions {
  /** A slide stays on screen at least this long before the director may change it. */
  minDwellMs: number;
  /** New slides allowed per director response. */
  maxAddsPerTick: number;
  /** Existing bullets an update may drop or reword at once. */
  maxBulletChurn: number;
  /** remove_slide / reorder only when a steering note asks: the class has already seen those slides. */
  structuralNeedsSteering: boolean;
}

export const DEFAULT_STABILITY: StabilityOptions = {
  minDwellMs: 8000,
  maxAddsPerTick: 1,
  maxBulletChurn: 1,
  structuralNeedsSteering: true,
};

export interface HeldOperation {
  op: Operation;
  reason: string;
}

export interface StabilityResult {
  allowed: Operation[];
  held: HeldOperation[];
}

export function dwellRemaining(deck: DeckState, now: number, options: StabilityOptions): number {
  if (deck.slides.length === 0) return 0;
  return Math.max(0, deck.changedAt + options.minDwellMs - now);
}

/** Existing bullets that would disappear or be reworded by the update. */
function bulletChurn(before: readonly string[], after: readonly string[]): number {
  const kept = new Set(after.map((b) => b.toLowerCase()));
  return before.filter((b) => !kept.has(b.toLowerCase())).length;
}

// Words in a steering note that explicitly ask for a destructive change.
const ASKS_REMOVE = /\b(remove|delete|drop|get rid|clear|erase|scrap|throw away)\b/i;
const ASKS_REORDER = /\b(reorder|re-order|move|swap|order|before|after|first|last|put)\b/i;

/** Slides the class has seen are only deleted or shuffled when the speaker literally asks. */
function structuralAllowed(op: Operation, steering: string | null): boolean {
  if (op.op === 'remove_slide') return steering !== null && ASKS_REMOVE.test(steering);
  if (op.op === 'reorder') return steering !== null && ASKS_REORDER.test(steering);
  return true;
}

const normalize = (bullet: string) => bullet.toLowerCase().replace(/[\s.,;:!]+$/u, '').trim();

/**
 * Drops bullets that are already on another slide (weak models copy whole
 * bullet lists onto the next slide). Returns null when an add_slide was
 * nothing but copies. A steering note (e.g. "recap...") skips this.
 */
function withoutRepeats(op: Operation, deck: DeckState): Operation | null {
  if (op.op !== 'add_slide' && op.op !== 'update_bullets') return op;
  const own = op.op === 'update_bullets' ? op.slide : null;
  const elsewhere = new Set(
    deck.slides.filter((s) => s.id !== own).flatMap((s) => s.bullets.map(normalize)),
  );
  const bullets = op.bullets.filter((b) => !elsewhere.has(normalize(b)));
  if (bullets.length === op.bullets.length) return op;
  if (op.op === 'add_slide' && bullets.length === 0 && op.bullets.length > 0) return null;
  return { ...op, bullets };
}

export function applyStability(
  ops: readonly Operation[],
  deck: DeckState,
  now: number,
  options: StabilityOptions,
  steering: string | null,
): StabilityResult {
  const result: StabilityResult = { allowed: [], held: [] };
  const changes = ops.filter((op) => op.op !== 'no_change');
  const holdStructural = (op: Operation) => options.structuralNeedsSteering && !structuralAllowed(op, steering);
  if (steering !== null) {
    for (const op of changes) {
      if (holdStructural(op)) result.held.push({ op, reason: `steering note did not ask for ${op.op}` });
      else result.allowed.push(op);
    }
    return result;
  }

  if (dwellRemaining(deck, now, options) > 0) {
    for (const op of changes) result.held.push({ op, reason: 'slide has not been on screen long enough' });
    return result;
  }

  let adds = 0;
  for (const original of changes) {
    const op = withoutRepeats(original, deck);
    if (op === null) {
      result.held.push({ op: original, reason: 'new slide only repeats bullets from other slides' });
      continue;
    }
    if (holdStructural(op)) {
      result.held.push({ op, reason: `${op.op} only on a steering note` });
      continue;
    }
    if (op.op === 'add_slide') {
      adds += 1;
      if (adds > options.maxAddsPerTick) {
        result.held.push({ op, reason: `more than ${options.maxAddsPerTick} new slide(s) in one response` });
        continue;
      }
    }
    if (op.op === 'update_bullets') {
      const before = findSlide(deck, op.slide)?.bullets ?? [];
      const churn = bulletChurn(before, op.bullets);
      if (churn > options.maxBulletChurn) {
        result.held.push({ op, reason: `would rewrite ${churn} existing bullets` });
        continue;
      }
    }
    result.allowed.push(op);
  }
  return result;
}
