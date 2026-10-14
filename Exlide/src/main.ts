import { createLlmProvider } from './adapters/llm/index.ts';
import { createSttProvider } from './adapters/stt/index.ts';
import { readConfig } from './config.ts';
import { emptyDeck, type DeckState } from './core/deck.ts';
import { applyOperations } from './core/reducer.ts';
import { validateOperations } from './core/schema.ts';
import { micCheckEvent, micCheckHint, micCheckLevel, micCheckResult, newMicCheck } from './core/mic-check.ts';
import { CaptionBar } from './ui/caption.ts';
import { createConsoleDebugLogger } from './ui/debug-console.ts';
import { DeckView } from './ui/deck-view.ts';
import { DEMO_OPERATIONS } from './ui/demo.ts';
import { startMicLevel, type MicLevel } from './ui/mic-level.ts';
import { mountPastePanel } from './ui/paste-panel.ts';
import { Session } from './ui/session.ts';
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
    <form class="steer-form"><input class="steer" type="text" placeholder="Steer: e.g. skip the history" disabled /></form>
    <span class="status" role="status"></span>
  </footer>
`;
const stage = requireElement('.stage', HTMLElement);
const steerForm = requireElement('.steer-form', HTMLFormElement);
const steerInput = requireElement('.steer', HTMLInputElement);
const status = requireElement('.status', HTMLSpanElement);
const setStatus = (text: string) => {
  status.textContent = text;
};

const view = new DeckView(stage); // clears the stage, so create it first
await view.init();
const caption = new CaptionBar(stage);

/** Step 2 demo: a fixed op list through the real validator and reducer. */
async function playDemo(stepMs: number): Promise<void> {
  let deck: DeckState = emptyDeck(Date.now());
  for (const batch of DEMO_OPERATIONS) {
    const report = validateOperations(batch, deck);
    for (const dropped of report.dropped) debug.log('op.dropped', { ...dropped });
    deck = applyOperations(deck, report.valid, Date.now());
    view.render(deck);
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
}

function startSession(): Session | null {
  try {
    const session = new Session({
      llm: createLlmProvider(config),
      view,
      logger: debug,
      intervalMs: config.directorIntervalMs,
      onStatus: setStatus,
    });
    steerInput.disabled = false;
    steerForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const note = steerInput.value.trim();
      if (note === '') return;
      session.steer(note);
      steerInput.value = '';
      setStatus(`Steering: "${note}"`);
    });
    return session;
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
    return null;
  }
}

/** Live mode: the mic button starts speech recognition and the director. */
function mountMic(session: Session): void {
  const mic = requireElement('.mic', HTMLButtonElement);
  let check = newMicCheck(Date.now());
  let checkTimer: ReturnType<typeof setInterval> | null = null;
  const stt = createSttProvider(config, (event) => {
    debug.log('stt.state', { event });
    check = micCheckEvent(check, event);
  });
  let level: MicLevel | null = null;
  let on = false;

  const setLevel = (value: number) => {
    mic.style.setProperty('--level', value.toFixed(3));
    check = micCheckLevel(check, value, Date.now());
  };
  const setOn = (value: boolean) => {
    on = value;
    mic.setAttribute('aria-pressed', String(value));
    mic.textContent = value ? 'Stop' : 'Mic';
    if (checkTimer !== null) clearInterval(checkTimer);
    checkTimer = null;
    if (value) {
      check = newMicCheck(Date.now());
      checkTimer = setInterval(() => {
        const hint = micCheckHint(check, Date.now());
        if (hint !== null) caption.hint(hint);
      }, 1000);
    } else {
      level?.stop();
      level = null;
      session.stop();
    }
  };

  stt.onSegment((segment) => {
    session.addSegment(segment);
    check = micCheckResult(check);
    caption.speech(segment.text, segment.isFinal);
  });
  stt.onStateChange((state, detail) => {
    debug.log('stt.state', { state, detail });
    if (state === 'error') {
      caption.hint(detail ?? 'Speech recognition error');
      stt.stop();
      setOn(false);
    }
  });

  mic.disabled = false;
  if (!stt.isSupported()) {
    mic.disabled = true;
    setStatus('Speech recognition needs Chrome or Edge.');
    return;
  }

  mic.addEventListener('click', async () => {
    if (on) {
      stt.stop();
      setOn(false);
      caption.clear();
      setStatus('Mic off');
      return;
    }
    try {
      level = await startMicLevel(setLevel); // also triggers the permission prompt
      setStatus(`Listening on: ${level.deviceLabel}`);
    } catch (error) {
      setStatus(`Microphone unavailable: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    setOn(true);
    session.start();
    await stt.start();
  });
}

const params = new URLSearchParams(location.search);
if (params.has('demo')) {
  void playDemo(Number(params.get('demo')) || 2000);
} else if (params.has('paste')) {
  const session = startSession();
  if (session) mountPastePanel(stage, session, Number(params.get('paste')) || 1);
} else {
  const session = startSession();
  if (session) mountMic(session);
}
