// The only things the director may ask for. Defined once here and reused by
// the validator, reducer, prompt and renderer.

export const OPERATION_NAMES = [
  'add_slide',
  'update_bullets',
  'set_title',
  'remove_slide',
  'reorder',
  'no_change',
] as const;

export type OperationName = (typeof OPERATION_NAMES)[number];

/** Adds a slide after `after` (default: after the current slide) and shows it. */
export interface AddSlideOp {
  readonly op: 'add_slide';
  readonly title: string;
  readonly bullets: readonly string[];
  readonly after?: string;
}

/** Replaces a slide's bullets and shows that slide. */
export interface UpdateBulletsOp {
  readonly op: 'update_bullets';
  readonly slide: string;
  readonly bullets: readonly string[];
}

/** Renames a slide and shows it. */
export interface SetTitleOp {
  readonly op: 'set_title';
  readonly slide: string;
  readonly title: string;
}

export interface RemoveSlideOp {
  readonly op: 'remove_slide';
  readonly slide: string;
}

/** `order` must list every existing slide id exactly once. */
export interface ReorderOp {
  readonly op: 'reorder';
  readonly order: readonly string[];
}

export interface NoChangeOp {
  readonly op: 'no_change';
}

export type Operation =
  | AddSlideOp
  | UpdateBulletsOp
  | SetTitleOp
  | RemoveSlideOp
  | ReorderOp
  | NoChangeOp;

/** Slide ids an operation touches (used by the stability rule). */
export function touchedSlides(op: Operation): readonly string[] {
  switch (op.op) {
    case 'update_bullets':
    case 'set_title':
    case 'remove_slide':
      return [op.slide];
    case 'reorder':
      return op.order;
    case 'add_slide':
    case 'no_change':
      return [];
  }
}
