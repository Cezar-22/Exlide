// Landing page (the user's "web interface v1" design): logo, tagline, wave,
// Start / Info / Settings. Start launches the live presentation. Only static
// markup goes through innerHTML; settings values are set as properties.

import logoUrl from '../assets/exlide-logo.png';
import { LANGUAGES, SPEEDS, type UserSettings } from '../settings.ts';
import './landing.css';

// Lucide icons (ISC licence), inlined so the page needs no icon package.
const ICON_PLAY =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>';
const ICON_INFO =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
const ICON_SETTINGS =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';

const INFO_HTML = `
  <h2>How Exlide works</h2>
  <p>Exlide listens while you teach and builds the slides for you. You never prepare a deck.</p>
  <ol>
    <li>Press <strong>Start</strong> and allow the microphone.</li>
    <li>Teach normally. Your words appear at the bottom; slides follow within a few seconds.</li>
    <li>Type a short note in the box at the bottom to steer, e.g. <em>"add a slide with an exercise"</em> or <em>"skip the history"</em>.</li>
    <li>Press <strong>Stop</strong> to pause listening.</li>
  </ol>
  <p class="hint">Needs Chrome or Edge and an internet connection for speech recognition (the browser sends the audio to Google or Microsoft). Slides are made by an AI model running on this computer (Ollama), so lesson content stays local.</p>
  <div class="actions"><button type="button" class="primary" data-close>Got it</button></div>
`;

export interface LandingOptions {
  settings: UserSettings;
  version: string;
  onSaveSettings: (settings: UserSettings) => void;
  /** Called on Start. The landing fades out once it resolves. */
  onStart: () => Promise<void>;
}

export interface Landing {
  hide(): void;
}

function settingsDialogHtml(): string {
  const langs = LANGUAGES.map((l) => `<option value="${l.code}">${l.label}</option>`).join('');
  const speeds = SPEEDS.map((s) => `<option value="${s.ms}">${s.label}</option>`).join('');
  return `
    <form method="dialog">
      <h2>Settings</h2>
      <label>Speech language
        <select name="lang">${langs}</select>
        <span class="hint">The language you teach in.</span>
      </label>
      <label>Slide updates
        <select name="speed">${speeds}</select>
        <span class="hint">How often Exlide checks what you said. Calm = fewer slide changes.</span>
      </label>
      <label>AI model (Ollama)
        <input name="model" type="text" spellcheck="false" autocomplete="off" placeholder="llama3.1:8b" />
        <span class="hint">Leave empty for the default. It must be downloaded with "ollama pull".</span>
      </label>
      <div class="actions">
        <button type="submit" value="cancel">Cancel</button>
        <button type="submit" value="save" class="primary">Save</button>
      </div>
    </form>
  `;
}

function requireChild<T extends Element>(parent: ParentNode, selector: string, type: new () => T): T {
  const el = parent.querySelector(selector);
  if (!(el instanceof type)) throw new Error(`landing: ${selector} missing`);
  return el;
}

export function mountLanding(options: LandingOptions): Landing {
  let settings = options.settings;
  const root = document.createElement('div');
  root.className = 'landing';
  root.innerHTML = `
    <main class="hero">
      <h1 style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Exlide</h1>
      <img class="logo" alt="Exlide logo" width="816" height="816" />
      <p class="tagline">Speak. Your slides follow.</p>
      <div class="wave" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
      <button id="start-btn" class="btn btn-primary" type="button">${ICON_PLAY} Start</button>
      <div class="secondary">
        <button id="info-btn" class="btn btn-ghost" type="button">${ICON_INFO} Info</button>
        <button id="settings-btn" class="btn btn-ghost" type="button">${ICON_SETTINGS} Settings</button>
      </div>
    </main>
    <footer class="version"></footer>
    <dialog class="landing-dialog info-dialog">${INFO_HTML}</dialog>
    <dialog class="landing-dialog settings-dialog">${settingsDialogHtml()}</dialog>
  `;
  requireChild(root, '.logo', HTMLImageElement).src = logoUrl;
  requireChild(root, '.version', HTMLElement).textContent = `v${options.version} · Exlide`;
  document.body.append(root);

  const infoDialog = requireChild(root, '.info-dialog', HTMLDialogElement);
  const settingsDialog = requireChild(root, '.settings-dialog', HTMLDialogElement);
  const startBtn = requireChild(root, '#start-btn', HTMLButtonElement);
  const form = requireChild(settingsDialog, 'form', HTMLFormElement);
  const langSelect = requireChild(form, 'select[name="lang"]', HTMLSelectElement);
  const speedSelect = requireChild(form, 'select[name="speed"]', HTMLSelectElement);
  const modelInput = requireChild(form, 'input[name="model"]', HTMLInputElement);

  requireChild(root, '#info-btn', HTMLButtonElement).addEventListener('click', () => infoDialog.showModal());
  requireChild(infoDialog, '[data-close]', HTMLButtonElement).addEventListener('click', () => infoDialog.close());

  requireChild(root, '#settings-btn', HTMLButtonElement).addEventListener('click', () => {
    langSelect.value = settings.sttLang;
    if (langSelect.value !== settings.sttLang) {
      // A language set in .env that is not in the list: show it anyway.
      langSelect.add(new Option(settings.sttLang, settings.sttLang), 0);
      langSelect.value = settings.sttLang;
    }
    speedSelect.value = String(settings.directorIntervalMs);
    if (speedSelect.value !== String(settings.directorIntervalMs)) {
      speedSelect.add(new Option(`Custom (${settings.directorIntervalMs / 1000} s)`, String(settings.directorIntervalMs)));
      speedSelect.value = String(settings.directorIntervalMs);
    }
    modelInput.value = settings.llmModel;
    settingsDialog.showModal();
  });

  settingsDialog.addEventListener('close', () => {
    if (settingsDialog.returnValue !== 'save') return;
    settings = {
      sttLang: langSelect.value,
      directorIntervalMs: Number(speedSelect.value),
      llmModel: modelInput.value.trim(),
    };
    options.onSaveSettings(settings);
  });

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    try {
      await options.onStart();
    } finally {
      startBtn.disabled = false;
    }
  });

  return {
    hide() {
      root.classList.add('leaving');
      setTimeout(() => {
        root.hidden = true;
      }, 350);
    },
  };
}
