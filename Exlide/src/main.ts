import { createLlmProvider } from './adapters/llm/index.ts';
import { createSttProvider } from './adapters/stt/index.ts';
import { readConfig, type AppConfig } from './config.ts';
import { emptyDeck, type DeckState } from './core/deck.ts';
import { micCheckEvent, micCheckHint, micCheckLevel, micCheckResult, newMicCheck } from './core/mic-check.ts';
import { applyOperations } from './core/reducer.ts';
import { validateOperations } from './core/schema.ts';
import { applySettings, browserStore, defaultSettings, loadSettings, saveSettings } from './settings.ts';
import { CaptionBar } from './ui/caption.ts';
import { createConsoleDebugLogger } from './ui/debug-console.ts';
import { DeckView } from './ui/deck-view.ts';
import { DEMO_OPERATIONS } from './ui/demo.ts';
import { mountLanding } from './ui/landing.ts';
import { startMicLevel, type MicLevel } from './ui/mic-level.ts';
import { mountPastePanel } from './ui/paste-panel.ts';
import { Session } from './ui/session.ts';
import './ui/styles.css';

const baseConfig = readConfig(__EXLIDE_ENV__);
const debug = createConsoleDebugLogger(baseConfig.debug);
const store = browserStore();
let settings = loadSettings(store, defaultSettings(baseConfig));

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

/** Builds the slide view. reveal.js needs a visible container, so call this once #app is shown. */
async function createView(): Promise<{ view: DeckView; caption: CaptionBar }> {
  const view = new DeckView(stage); // clears the stage, so create it before the caption
  await view.init();
  return { view, caption: new CaptionBar(stage) };
}

/** Step 2 demo: a fixed op list through the real validator and reducer. */
async function playDemo(view: DeckView, stepMs: number): Promise<void> {
  let deck: DeckState = emptyDeck(Date.now());
  for (const batch of DEMO_OPERATIONS) {
    const report = validateOperations(batch, deck);
    for (const dropped of report.dropped) debug.log('op.dropped', { ...dropped });
    deck = applyOperations(deck, report.valid, Date.now());
    view.render(deck);
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
}

function startSession(config: AppConfig, view: DeckView): Session | null {
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

/** Live mode: the mic button toggles speech recognition and the director. Returns the toggle. */
function mountMic(config: AppConfig, session: Session, caption: CaptionBar): () => Promise<void> {
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
      setStatus('Mic off. Press Mic to try again.');
    }
  });

  const toggle = async (): Promise<void> => {
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
      caption.hint(`Microphone unavailable: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    setOn(true);
    session.start();
    await stt.start();
  };

  if (!stt.isSupported()) {
    caption.hint('Speech recognition needs Chrome or Edge.');
    return () => Promise.resolve();
  }
  mic.disabled = false;
  mic.addEventListener('click', () => void toggle());
  return toggle;
}

const params = new URLSearchParams(location.search);
if (params.has('demo')) {
  const { view } = await createView();
  void playDemo(view, Number(params.get('demo')) || 2000);
} else if (params.has('paste')) {
  const { view } = await createView();
  const session = startSession(baseConfig, view);
  if (session) mountPastePanel(stage, session, Number(params.get('paste')) || 1);
} else {
  // Normal use: landing page first; Start opens the presentation and turns the mic on.
  root.hidden = true;
  let started = false;
  const landing = mountLanding({
    settings,
    version: __EXLIDE_VERSION__,
    onSaveSettings: (next) => {
      settings = next;
      if (!saveSettings(store, next)) debug.log('stt.error', { error: 'settings could not be saved in this browser' });
    },
    onStart: async () => {
      if (started) return;
      started = true;
      const config = applySettings(baseConfig, settings);
      root.hidden = false;
      const { view, caption } = await createView();
      const session = startSession(config, view);
      landing.hide();
      if (!session) return;
      const startMic = mountMic(config, session, caption);
      await startMic(); // same click as Start, so the mic permission prompt appears right away
    },
  });
}
