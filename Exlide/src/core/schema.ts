// Validation of untrusted model output. Nothing reaches the reducer without
// passing through validateOperations().

import { LIMITS, type DeckState } from './deck.ts';
import { OPERATION_NAMES, type Operation, type OperationName } from './operations.ts';
import { applyOperation } from './reducer.ts';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface DroppedOperation {
  raw: unknown;
  error: string;
}

export interface ValidationReport {
  valid: Operation[];
  dropped: DroppedOperation[];
}

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(error: string): Result<T> => ({ ok: false, error });

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOperationName(value: unknown): value is OperationName {
  return OPERATION_NAMES.some((name) => name === value);
}

/** Collapses whitespace and strips leading bullet markers models like to add. */
function cleanText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^\s*(?:[-*•–]|\d+[.)])\s+/, '')
    .trim();
}

function readText(fields: Fields, key: string, maxLength: number): Result<string> {
  const value = fields[key];
  if (typeof value !== 'string') return fail(`"${key}" must be a string`);
  const text = cleanText(value);
  if (text === '') return fail(`"${key}" is empty`);
  if (text.length > maxLength) return fail(`"${key}" is longer than ${maxLength} characters`);
  return ok(text);
}

function readBullets(fields: Fields): Result<string[]> {
  const value = fields['bullets'];
  if (!Array.isArray(value)) return fail('"bullets" must be an array of strings');
  const bullets: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return fail('"bullets" must contain only strings');
    const text = cleanText(item);
    if (text === '') continue;
    if (text.length > LIMITS.maxBulletLength) {
      return fail(`a bullet is longer than ${LIMITS.maxBulletLength} characters`);
    }
    bullets.push(text);
  }
  if (bullets.length > LIMITS.maxBullets) {
    return fail(`more than ${LIMITS.maxBullets} bullets (the slide is full: put the new point on a new slide with add_slide)`);
  }
  return ok(bullets);
}

function readSlideRef(fields: Fields, key: string, deck: DeckState): Result<string> {
  const value = fields[key];
  if (typeof value !== 'string') return fail(`"${key}" must be a slide id string`);
  if (!deck.slides.some((s) => s.id === value)) return fail(`unknown slide id "${value}"`);
  return ok(value);
}

/** Checks one raw operation's shape and its references against `deck`. */
export function validateOperation(raw: unknown, deck: DeckState): Result<Operation> {
  if (!isFields(raw)) return fail('operation must be an object');
  const name = raw['op'];
  if (!isOperationName(name)) return fail(`unknown op ${JSON.stringify(name)}`);

  switch (name) {
    case 'no_change':
      return ok({ op: 'no_change' });

    case 'add_slide': {
      if (deck.slides.length >= LIMITS.maxSlides) return fail(`deck already has ${LIMITS.maxSlides} slides`);
      const title = readText(raw, 'title', LIMITS.maxTitleLength);
      if (!title.ok) return title;
      const lower = title.value.toLowerCase();
      if (deck.slides.some((s) => s.title.toLowerCase() === lower)) {
        return fail(`a slide titled "${title.value}" already exists; use update_bullets`);
      }
      const bullets = readBullets(raw);
      if (!bullets.ok) return bullets;
      if (raw['after'] === undefined || raw['after'] === null) {
        return ok({ op: 'add_slide', title: title.value, bullets: bullets.value });
      }
      const after = readSlideRef(raw, 'after', deck);
      if (!after.ok) return after;
      return ok({ op: 'add_slide', title: title.value, bullets: bullets.value, after: after.value });
    }

    case 'update_bullets': {
      const slide = readSlideRef(raw, 'slide', deck);
      if (!slide.ok) return slide;
      const bullets = readBullets(raw);
      if (!bullets.ok) return bullets;
      return ok({ op: 'update_bullets', slide: slide.value, bullets: bullets.value });
    }

    case 'set_title': {
      const slide = readSlideRef(raw, 'slide', deck);
      if (!slide.ok) return slide;
      const title = readText(raw, 'title', LIMITS.maxTitleLength);
      if (!title.ok) return title;
      return ok({ op: 'set_title', slide: slide.value, title: title.value });
    }

    case 'remove_slide': {
      const slide = readSlideRef(raw, 'slide', deck);
      if (!slide.ok) return slide;
      return ok({ op: 'remove_slide', slide: slide.value });
    }

    case 'reorder': {
      const order = raw['order'];
      if (!Array.isArray(order) || !order.every((id): id is string => typeof id === 'string')) {
        return fail('"order" must be an array of slide ids');
      }
      const existing = deck.slides.map((s) => s.id);
      const isPermutation =
        order.length === existing.length &&
        new Set(order).size === order.length &&
        order.every((id) => existing.includes(id));
      if (!isPermutation) return fail('"order" must list every existing slide id exactly once');
      return ok({ op: 'reorder', order: [...order] });
    }
  }
}

/**
 * Validates a list of raw operations in sequence. Each one is checked against
 * the deck as it would be after the previous valid ones, so "add then update"
 * or "remove then reorder" are judged correctly.
 */
export function validateOperations(raws: readonly unknown[], deck: DeckState): ValidationReport {
  const report: ValidationReport = { valid: [], dropped: [] };
  let simulated = deck;
  for (const raw of raws) {
    const result = validateOperation(raw, simulated);
    if (result.ok) {
      report.valid.push(result.value);
      simulated = applyOperation(simulated, result.value, simulated.changedAt);
    } else {
      report.dropped.push({ raw, error: result.error });
    }
  }
  return report;
}

/**
 * Extracts the operation list from raw model text. Accepts a bare JSON array,
 * an object with an "operations" array (JSON modes often require an object),
 * a single operation object, and text wrapped in markdown code fences.
 */
export function parseModelOutput(text: string): Result<unknown[]> {
  const unfenced = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(unfenced);
  } catch {
    const start = unfenced.search(/[[{]/);
    const end = Math.max(unfenced.lastIndexOf(']'), unfenced.lastIndexOf('}'));
    if (start === -1 || end <= start) return fail('output is not JSON');
    try {
      parsed = JSON.parse(unfenced.slice(start, end + 1));
    } catch (error) {
      return fail(`output is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (Array.isArray(parsed)) return ok(parsed);
  if (isFields(parsed)) {
    const ops = parsed['operations'];
    if (Array.isArray(ops)) return ok(ops);
    if ('op' in parsed) return ok([parsed]);
  }
  return fail('expected a JSON array of operations');
}
