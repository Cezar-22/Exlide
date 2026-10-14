// Landing page (the user's "web interface v1" design): logo, tagline, wave,
// Start / Info / Settings. Start launches the live presentation. Text comes
// from i18n.ts and switches with the language setting. Only static markup
// goes through innerHTML; settings values are set as properties.

import logoUrl from '../assets/exlide-logo.png';
import { langOf, LANGUAGE_OPTIONS } from '../core/language.ts';
import { strings, type Strings } from '../i18n.ts';
import { SPEEDS, type UserSettings } from '../settings.ts';
import './landing.css';

// Lucide icons (ISC licence), inlined so the page needs no icon package.
const ICON_PLAY =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>';
const ICON_INFO =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
const ICON_SETTINGS =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';

/** Elements whose text comes straight from a Strings key. */
type TextKey =
  | 'tagline'
  | 'start'
  | 'info'
  | 'settings'
  | 'settingsTitle'
  | 'languageLabel'
  | 'languageHint'
  | 'speedLabel'
  | 'speedHint'
  | 'modelLabel'
  | 'modelHint'
  | 'cancel'
  | 'save';

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

const MARKUP = `
  <main class="hero">
    <h1 style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Exlide</h1>
    <img class="logo" alt="Exlide logo" width="816" height="816" />
    <p class="tagline" data-text="tagline"></p>
    <div class="wave" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
    <button id="start-btn" class="btn btn-primary" type="button">${ICON_PLAY}<span data-text="start"></span></button>
    <div class="secondary">
      <button id="info-btn" class="btn btn-ghost" type="button">${ICON_INFO}<span data-text="info"></span></button>
      <button id="settings-btn" class="btn btn-ghost" type="button">${ICON_SETTINGS}<span data-text="settings"></span></button>
    </div>
  </main>
  <footer class="version"></footer>
  <dialog class="landing-dialog info-dialog"></dialog>
  <dialog class="landing-dialog settings-dialog">
    <form method="dialog">
      <h2 data-text="settingsTitle"></h2>
      <label><span data-text="languageLabel"></span>
        <select name="lang"></select>
        <span class="hint" data-text="languageHint"></span>
      </label>
      <label><span data-text="speedLabel"></span>
        <select name="speed"></select>
        <span class="hint" data-text="speedHint"></span>
      </label>
      <label><span data-text="modelLabel"></span>
        <input name="model" type="text" spellcheck="false" autocomplete="off" placeholder="llama3.1:8b" />
        <span class="hint" data-text="modelHint"></span>
      </label>
      <div class="actions">
        <button type="submit" value="cancel" data-text="cancel"></button>
        <button type="submit" value="save" class="primary" data-text="save"></button>
      </div>
    </form>
  </dialog>
`;

function requireChild<T extends Element>(parent: ParentNode, selector: string, type: new () => T): T {
  const el = parent.querySelector(selector);
  if (!(el instanceof type)) throw new Error(`landing: ${selector} missing`);
  return el;
}

function isTextKey(value: string | undefined): value is TextKey {
  return (
    value !== undefined &&
    [
      'tagline', 'start', 'info', 'settings', 'settingsTitle', 'languageLabel', 'languageHint',
      'speedLabel', 'speedHint', 'modelLabel', 'modelHint', 'cancel', 'save',
    ].includes(value)
  );
}

export function mountLanding(options: LandingOptions): Landing {
  let settings = options.settings;
  const root = document.createElement('div');
  root.className = 'landing';
  root.innerHTML = MARKUP;
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

  /** Puts every text on the page into the current language. */
  const applyLanguage = () => {
    const lang = langOf(settings.sttLang);
    const t: Strings = strings(lang);
    document.documentElement.lang = lang;
    for (const el of root.querySelectorAll<HTMLElement>('[data-text]')) {
      const key = el.dataset['text'];
      if (isTextKey(key)) el.textContent = t[key];
    }
    infoDialog.innerHTML = t.infoHtml; // static, trusted markup from i18n.ts
    requireChild(infoDialog, '[data-close]', HTMLButtonElement).addEventListener('click', () => infoDialog.close());
  };

  /** Fills the Settings form from the current settings, in the current language. */
  const fillSettingsForm = () => {
    const t = strings(langOf(settings.sttLang));
    langSelect.replaceChildren(...LANGUAGE_OPTIONS.map((o) => new Option(o.label, o.code)));
    langSelect.value = settings.sttLang;
    speedSelect.replaceChildren(...SPEEDS.map((s) => new Option(t[s.key], String(s.ms))));
    if (!SPEEDS.some((s) => s.ms === settings.directorIntervalMs)) {
      speedSelect.add(new Option(t.speedCustom(settings.directorIntervalMs / 1000), String(settings.directorIntervalMs)));
    }
    speedSelect.value = String(settings.directorIntervalMs);
    modelInput.value = settings.llmModel;
  };

  applyLanguage();

  requireChild(root, '#info-btn', HTMLButtonElement).addEventListener('click', () => infoDialog.showModal());
  requireChild(root, '#settings-btn', HTMLButtonElement).addEventListener('click', () => {
    fillSettingsForm();
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
    applyLanguage();
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
