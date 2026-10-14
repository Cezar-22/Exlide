// The app's own diagnostics (dropped operations, raw model output, provider
// errors). Separate from the developer work log in logs.txt. Core has no
// console, so the sink is injected by the platform layer.

export type DebugEvent =
  | 'director.skip'
  | 'director.request'
  | 'director.response'
  | 'director.retry'
  | 'director.fallback'
  | 'director.error'
  | 'op.dropped'
  | 'op.held'
  | 'stt.state'
  | 'stt.error'
  | 'llm.error';

export interface DebugLogger {
  enabled: boolean;
  log(event: DebugEvent, data: Record<string, unknown>): void;
}

export type DebugSink = (event: DebugEvent, data: Record<string, unknown>) => void;

export function createDebugLogger(sink: DebugSink, enabled = true): DebugLogger {
  return {
    enabled,
    log(event, data) {
      if (this.enabled) sink(event, data);
    },
  };
}

export const silentLogger: DebugLogger = createDebugLogger(() => undefined, false);
