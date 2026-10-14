// Dev-only panel (open the app with ?paste): paste a transcript or a
// fixture file and play it into the session in real time, no microphone.
// Hidden in normal use so the UI stays mic + steering + slides.

import { parseFixture } from '../core/fixture.ts';
import type { Session } from './session.ts';

export function mountPastePanel(host: HTMLElement, session: Session, speed: number): void {
  const panel = document.createElement('details');
  panel.className = 'paste-panel';
  panel.open = true;
  const summary = document.createElement('summary');
  summary.textContent = 'Paste transcript (dev)';
  const textarea = document.createElement('textarea');
  textarea.rows = 8;
  textarea.placeholder = 'Paste plain text, or fixture lines like "[00:05] Hello everyone." and "[01:00] >> skip ahead"';
  const run = document.createElement('button');
  run.type = 'button';
  run.textContent = 'Play';
  panel.append(summary, textarea, run);
  host.append(panel);

  const timers: Array<ReturnType<typeof setTimeout>> = [];
  run.addEventListener('click', () => {
    for (const t of timers.splice(0)) clearTimeout(t);
    const events = parseFixture(textarea.value);
    for (const event of events) {
      timers.push(
        setTimeout(() => {
          if (event.kind === 'steer') session.steer(event.text);
          else session.addSegment({ text: event.text, isFinal: true, at: Date.now() });
        }, event.at / speed),
      );
    }
    session.start();
    panel.open = false;
  });
}
