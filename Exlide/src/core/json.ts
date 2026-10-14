/** Safely reads a nested value from parsed JSON of unknown shape. */
export function pick(value: unknown, ...path: Array<string | number>): unknown {
  let current: unknown = value;
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return undefined;
    const next: unknown = Reflect.get(current, key);
    current = next;
  }
  return current;
}
