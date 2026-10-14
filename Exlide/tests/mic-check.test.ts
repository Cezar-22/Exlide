import { describe, expect, it } from 'vitest';
import { micCheckEvent, micCheckHint, micCheckLevel, micCheckResult, newMicCheck } from '../src/core/mic-check.ts';

describe('mic check', () => {
  it('stays quiet early on and once words arrive', () => {
    let s = newMicCheck(0);
    s = micCheckEvent(s, 'audiostart');
    expect(micCheckHint(s, 2000)).toBeNull();
    s = micCheckLevel(s, 0.5, 1000);
    s = micCheckResult(s);
    expect(micCheckHint(s, 60_000)).toBeNull();
  });

  it('flags a recognizer that never got the microphone', () => {
    const s = newMicCheck(0);
    expect(micCheckHint(s, 4000)).toBeNull();
    expect(micCheckHint(s, 6000)).toBe('no-mic-access');
  });

  it('flags sound without words after 8 s', () => {
    let s = micCheckEvent(newMicCheck(0), 'audiostart');
    s = micCheckLevel(s, 0.01, 500); // quiet: ignored
    expect(s.loudSince).toBeNull();
    s = micCheckLevel(s, 0.3, 1000);
    s = micCheckLevel(s, 0.3, 2000); // keeps the first loud moment
    expect(micCheckHint(s, 8999)).toBeNull();
    expect(micCheckHint(s, 9001)).toBe('sound-no-words');
  });

  it('reports network errors right away', () => {
    const s = micCheckEvent(micCheckEvent(newMicCheck(0), 'audiostart'), 'error:network');
    expect(micCheckHint(s, 100)).toBe('network');
  });
});
