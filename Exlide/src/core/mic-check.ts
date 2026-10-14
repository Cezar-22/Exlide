// Diagnoses "the mic shows sound but nothing happens". Fed with the input
// level, recognizer events and results, it returns a plain-language hint
// once the pattern is clear. Pure logic, so it is unit tested.

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

/** Returns a hint for the speaker, or null while things look fine (or it is too early to tell). */
export function micCheckHint(state: MicCheckState, now: number): string | null {
  if (state.sawResult) return null;
  if (state.lastError === 'network') {
    return 'The speech service cannot be reached. Speech recognition in Chrome/Edge needs an internet connection.';
  }
  if (!state.sawAudioStart && now - state.startedAt > 5000) {
    return 'The speech engine did not get the microphone. Close other apps using the mic (Teams, Discord, Zoom), check that the right mic is the Windows default input, then press Mic again.';
  }
  if (state.loudSince !== null && now - state.loudSince > 8000) {
    return 'The mic picks up sound but no words come back. Speak a full sentence close to the mic, check the language setting (STT_LANG), or try another mic. See README, "Mic troubleshooting".';
  }
  return null;
}
