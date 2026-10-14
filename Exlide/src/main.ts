import { readConfig } from './config.ts';
import { emptyDeck, type DeckState } from './core/deck.ts';
import { applyOperations } from './core/reducer.ts';
import { validateOperations } from './core/schema.ts';
import { createConsoleDebugLogger } from './ui/debug-console.ts';
import { DeckView } from './ui/deck-view.ts';
import { DEMO_OPERATIONS } from './ui/demo.ts';
import './ui/styles.css';

const config = readConfig(__EXLIDE_ENV__);
const debug = createConsoleDebugLogger(config.debug);

function requireElement<T extends Element>(selector: string, type: new () => T): T {
  const el = document.querySelector(selector);
  if (!(el instanceof type)) throw new Error(`${selector} missing from the page`);
  return el;
}

const root = requireElement('#app', HTMLDivElement);
root.innerHTML = `
  <main class="stage" aria-live="polite"></main>
  <footer class="controls">
    <button class="mic" type="button" aria-pressed="false" disabled>Mic</button>
    <input class="steer" type="text" placeholder="Steer: e.g. skip the history" disabled />
  </footer>
`;

const view = new DeckView(requireElement('.stage', HTMLElement));
let deck: DeckState = emptyDeck(Date.now());

/** Validates raw ops against the current deck and renders the result. */
function applyRaw(raws: readonly unknown[]): void {
  const report = validateOperations(raws, deck);
  for (const dropped of report.dropped) debug.log('op.dropped', { ...dropped });
  deck = applyOperations(deck, report.valid, Date.now());
  view.render(deck);
}

async function playDemo(stepMs: number): Promise<void> {
  for (const batch of DEMO_OPERATIONS) {
    applyRaw(batch);
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
}

await view.init();
view.render(deck);

const params = new URLSearchParams(location.search);
if (params.has('demo')) {
  void playDemo(Number(params.get('demo')) || 2000);
}
