import type {
  SttProvider,
  SttState,
  TranscriptSegment,
  Unsubscribe,
} from '../../core/providers.ts';

/** Test double: segments are pushed by hand with `emit`. */
export class MockSttProvider implements SttProvider {
  readonly name = 'mock';
  private readonly segmentListeners = new Set<(s: TranscriptSegment) => void>();
  private readonly stateListeners = new Set<(s: SttState, detail?: string) => void>();
  state: SttState = 'idle';

  isSupported(): boolean {
    return true;
  }

  start(): Promise<void> {
    this.setState('listening');
    return Promise.resolve();
  }

  stop(): void {
    this.setState('idle');
  }

  emit(segment: TranscriptSegment): void {
    if (this.state !== 'listening') return;
    for (const l of this.segmentListeners) l(segment);
  }

  onSegment(listener: (segment: TranscriptSegment) => void): Unsubscribe {
    this.segmentListeners.add(listener);
    return () => this.segmentListeners.delete(listener);
  }

  onStateChange(listener: (state: SttState, detail?: string) => void): Unsubscribe {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private setState(state: SttState): void {
    this.state = state;
    for (const l of this.stateListeners) l(state);
  }
}
