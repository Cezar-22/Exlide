// Provider interfaces. Core code talks to speech and AI services only through
// these. Concrete implementations live in src/adapters/ and are picked by the
// STT_PROVIDER / LLM_PROVIDER config values.

export type Unsubscribe = () => void;

/** One piece of recognized speech. Interim segments may be replaced later. */
export interface TranscriptSegment {
  text: string;
  isFinal: boolean;
  /** Milliseconds since epoch (or since replay start) when the segment ended. */
  at: number;
}

export type SttState = 'idle' | 'starting' | 'listening' | 'error';

export interface SttProvider {
  readonly name: string;
  /** False when the current platform cannot run this provider. */
  isSupported(): boolean;
  start(): Promise<void>;
  stop(): void;
  onSegment(listener: (segment: TranscriptSegment) => void): Unsubscribe;
  onStateChange(listener: (state: SttState, detail?: string) => void): Unsubscribe;
}

export interface LlmRequest {
  system: string;
  user: string;
  /** Ask the provider for its JSON / structured-output mode when it has one. */
  json: boolean;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

export interface LlmProvider {
  readonly name: string;
  /** Returns the raw model text. Throws on transport errors. */
  complete(request: LlmRequest): Promise<string>;
}
