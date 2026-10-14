import { createDebugLogger, type DebugLogger } from '../core/debug.ts';

/** App diagnostics go to the browser console at debug level. Off with DEBUG=false. */
export function createConsoleDebugLogger(enabled: boolean): DebugLogger {
  return createDebugLogger((event, data) => console.debug(`[exlide] ${event}`, data), enabled);
}
