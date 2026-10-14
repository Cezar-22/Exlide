// Diagnoses "the mic shows sound but nothing happens". Fed with the input
// level, recognizer events and results, it returns a plain-language hint
// once the pattern is clear. Pure logic, so it is unit tested. Returns a
// code; the UI turns it into text in the lesson language.

export interface MicCheckState {
  startedAt: number;
  loudSince: number | null;
  sawAudioStart: boolean;
  sawResult: boolean;
  lastError: string | null;
}

export const LOUD_LEVEL = 0.12;

export function newMicCheck(now: number): MicCheckState {
  return { startedAt: now, loudSince: null, sawAudioStart: false, sawResult: false, lastError: null };
}

export function micCheckEvent(state: MicCheckState, event: string): MicCheckState {
  if (event === 'audiostart') return { ...state, sawAudioStart: true };
  if (event.startsWith('error:')) return { ...state, lastError: event.slice('error:'.length) };
  return state;
}

export function micCheckLevel(state: MicCheckState, level: number, now: number): MicCheckState {
  if (level >= LOUD_LEVEL && state.loudSince === null) return { ...state, loudSince: now };
  return state;
}

export function micCheckResult(state: MicCheckState): MicCheckState {
  return state.sawResult ? state : { ...state, sawResult: true, lastError: null };
}

export type MicHint = 'network' | 'no-mic-access' | 'sound-no-words';

/** Returns a hint for the speaker, or null while things look fine (or it is too early to tell). */
export function micCheckHint(state: MicCheckState, now: number): MicHint | null {
  if (state.sawResult) return null;
  if (state.lastError === 'network') return 'network';
  if (!state.sawAudioStart && now - state.startedAt > 5000) return 'no-mic-access';
  if (state.loudSince !== null && now - state.loudSince > 8000) return 'sound-no-words';
  return null;
}
