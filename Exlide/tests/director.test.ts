import { describe, expect, it } from 'vitest';
import { MockLlmProvider } from '../src/adapters/llm/mock.ts';
import { silentLogger } from '../src/core/debug.ts';
import { Director } from '../src/core/director.ts';
import { DIRECTOR_REPLY_SCHEMA } from '../src/core/json-schema.ts';
import type { LlmProvider } from '../src/core/providers.ts';
import { TranscriptBuffer } from '../src/core/transcript.ts';

const add = (title: string, bullets: string[] = []) => JSON.stringify({ operations: [{ op: 'add_slide', title, bullets }] });
const NO_CHANGE = '{"operations":[{"op":"no_change"}]}';

function setup(script: Array<string | Error> = []) {
  const clock = { now: 0 };
  const llm = new MockLlmProvider(script, NO_CHANGE);
  const transcript = new TranscriptBuffer();
  const director = new Director({ llm, transcript, clock: () => clock.now, logger: silentLogger });
  const say = (text: string) => transcript.add({ text, isFinal: true, at: clock.now });
  return { clock, llm, transcript, director, say };
}

describe('Director', () => {
  it('skips the call when there is no new transcript and no steering', async () => {
    const { director, llm } = setup();
    expect(await director.tick()).toBe('skipped-idle');
    expect(llm.requests).toHaveLength(0);
  });

  it('sends transcript + deck with the JSON schema, and applies the reply', async () => {
    const { director, llm, say } = setup([add('Solar basics', ['Panels make DC power'])]);
    const seen: number[] = [];
    director.onDeckChange((d) => seen.push(d.version));
    say('Solar panels make DC power.');
    expect(await director.tick()).toBe('changed');
    const request = llm.requests[0];
    expect(request?.jsonSchema).toBe(DIRECTOR_REPLY_SCHEMA);
    expect(request?.user).toContain('Solar panels make DC power.');
    expect(request?.user).toContain('DECK: {"current":null,"slides":[]}');
    expect(director.deck.slides[0]?.title).toBe('Solar basics');
    expect(seen).toEqual([1]);
  });

  it('does not call the model again until new words arrive', async () => {
    const { director, llm, say, clock } = setup([add('A')]);
    say('one.');
    await director.tick();
    clock.now = 60_000;
    expect(await director.tick()).toBe('skipped-idle');
    expect(llm.requests).toHaveLength(1);
  });

  it('does not call the model while the current slide is younger than 8 s', async () => {
    const { director, llm, say, clock } = setup([add('A'), add('B')]);
    say('one.');
    await director.tick();
    clock.now = 5000;
    say('two.');
    expect(await director.tick()).toBe('skipped-dwell');
    clock.now = 8000;
    expect(await director.tick()).toBe('changed');
    expect(llm.requests).toHaveLength(2);
  });

  it('never runs two calls at once', async () => {
    let release: (v: string) => void = () => undefined;
    const slow: LlmProvider = {
      name: 'slow',
      complete: () => new Promise<string>((resolve) => (release = resolve)),
    };
    const transcript = new TranscriptBuffer();
    const director = new Director({ llm: slow, transcript, clock: () => 0, logger: silentLogger });
    transcript.add({ text: 'hello.', isFinal: true, at: 0 });
    const first = director.tick();
    expect(director.isBusy).toBe(true);
    expect(await director.tick()).toBe('skipped-busy');
    release(NO_CHANGE);
    expect(await first).toBe('no-change');
    expect(director.stats.skippedBusy).toBe(1);
  });

  it('retries once with the error message, then succeeds', async () => {
    const { director, llm, say } = setup(['Sure! Here is a slide about solar.', add('Solar')]);
    say('Solar is cheap now.');
    expect(await director.tick()).toBe('changed');
    expect(llm.requests).toHaveLength(2);
    expect(llm.requests[1]?.user).toContain('Your previous reply was rejected: output is not JSON');
    expect(director.stats.retries).toBe(1);
  });

  it('retries when every op is invalid, then falls back to no_change', async () => {
    const bad = '{"operations":[{"op":"update_bullets","slide":"s9","bullets":["x"]}]}';
    const { director, llm, say } = setup([bad, bad]);
    say('Something.');
    expect(await director.tick()).toBe('fallback');
    expect(llm.requests).toHaveLength(2);
    expect(llm.requests[1]?.user).toContain('unknown slide id "s9"');
    expect(director.deck.slides).toEqual([]);
    expect(director.stats).toMatchObject({ retries: 1, fallbacks: 1, droppedOps: 2, validOps: 0 });
  });

  it('applies valid ops and drops invalid ones from a mixed reply without retrying', async () => {
    const mixed = '{"operations":[{"op":"add_slide","title":"Good","bullets":[]},{"op":"explode"}]}';
    const { director, llm, say } = setup([mixed]);
    say('text.');
    expect(await director.tick()).toBe('changed');
    expect(llm.requests).toHaveLength(1);
    expect(director.stats).toMatchObject({ validOps: 1, droppedOps: 1, retries: 0 });
  });

  it('counts no_change replies', async () => {
    const { director, say } = setup([NO_CHANGE]);
    say('um, so.');
    expect(await director.tick()).toBe('no-change');
    expect(director.stats.noChangeReplies).toBe(1);
  });

  it('holds a second new slide in the same reply (stability)', async () => {
    const two = JSON.stringify({
      operations: [
        { op: 'add_slide', title: 'A', bullets: [] },
        { op: 'add_slide', title: 'B', bullets: [] },
      ],
    });
    const { director, say } = setup([two]);
    say('a and b.');
    expect(await director.tick()).toBe('changed');
    expect(director.deck.slides.map((s) => s.title)).toEqual(['A']);
    expect(director.stats.heldOps).toBe(1);
  });

  it('a steering note bypasses idle and dwell, reaches the prompt, and is consumed', async () => {
    const { director, llm, say, clock } = setup([add('A'), add('Examples')]);
    say('intro.');
    await director.tick();
    clock.now = 1000; // well inside the 8 s dwell, and no new words
    director.steer('  skip the history,   go to examples ');
    expect(await director.tick()).toBe('changed');
    expect(llm.requests[1]?.user).toContain('STEERING: "skip the history, go to examples"');
    expect(director.deck.slides.map((s) => s.title)).toEqual(['A', 'Examples']);
    expect(director.hasPendingSteering).toBe(false);
  });

  it('keeps the steering note and the transcript for the next tick after a transport error', async () => {
    const { director, llm, say } = setup([new Error('connection refused'), add('A')]);
    say('hello.');
    director.steer('start with the agenda');
    expect(await director.tick()).toBe('error');
    expect(director.hasPendingSteering).toBe(true);
    expect(await director.tick()).toBe('changed');
    expect(llm.requests[1]?.user).toContain('start with the agenda');
    expect(director.stats.errors).toBe(1);
  });
});
