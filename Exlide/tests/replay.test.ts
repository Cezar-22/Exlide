import { describe, expect, it } from 'vitest';
import { MockLlmProvider } from '../src/adapters/llm/mock.ts';
import { silentLogger } from '../src/core/debug.ts';
import { parseFixture } from '../src/core/fixture.ts';
import { runReplay } from '../src/core/replay.ts';

const FIXTURE = `
[00:00] Today I want to talk about solar panels on a normal house.
[00:06] A typical roof fits about ten panels.
[00:14] Now let's move on to batteries.
[00:20] A battery stores the midday surplus.
[00:26] >> add a slide about cost
[00:30] And that is basically it.
`;

describe('runReplay', () => {
  it('runs a fixture through the director on a simulated clock and reports quality numbers', async () => {
    const llm = new MockLlmProvider([
      '{"operations":[{"op":"add_slide","title":"Solar at home","bullets":["About ten panels per roof"]}]}',
      'not json at all',
      '{"operations":[{"op":"add_slide","title":"Batteries","bullets":["Store midday surplus"]}]}',
      '{"operations":[{"op":"add_slide","title":"Cost","bullets":[]},{"op":"bogus"}]}',
    ]);
    const report = await runReplay(parseFixture(FIXTURE), llm, silentLogger, {
      intervalMs: 4000,
      simulateLatency: false,
      tailMs: 10_000,
    });

    expect(report.finalDeck.slides.map((s) => s.title)).toEqual(['Solar at home', 'Batteries', 'Cost']);
    expect(report.stats).toMatchObject({ retries: 1, droppedOps: 1, fallbacks: 0, appliedOps: 3 });
    // The mock answers no_change once its script runs out; those count as valid ops too.
    expect(report.stats.noChangeReplies).toBeGreaterThan(0);
    expect(report.stats.validOps).toBe(3 + report.stats.noChangeReplies);
    expect(report.screenChanges).toBe(3);
    // Without steering, slides never change faster than the 8 s dwell rule; the
    // steering note at 0:26 is the only thing allowed to cut that short.
    expect(report.minOnScreenMs).not.toBeNull();
    expect(report.validRate).toBeCloseTo(report.stats.validOps / (report.stats.validOps + 1));
    expect(report.provider).toBe('mock');
  });

  it('every non-steered screen change respects the dwell time', async () => {
    const replies = Array.from({ length: 30 }, (_, i) =>
      JSON.stringify({ operations: [{ op: 'add_slide', title: `Topic ${i}`, bullets: [] }] }),
    );
    const prose = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} keeps going.`).join(' ');
    const report = await runReplay(parseFixture(prose), new MockLlmProvider(replies), silentLogger, {
      intervalMs: 2000,
      simulateLatency: false,
      tailMs: 0,
    });
    expect(report.screenChanges).toBeGreaterThan(3);
    expect(report.minOnScreenMs).toBeGreaterThanOrEqual(8000);
    expect(report.stats.skippedDwell).toBeGreaterThan(0);
  });
});
