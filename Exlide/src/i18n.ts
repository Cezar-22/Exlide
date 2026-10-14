// Interface text in every supported language. The Strings interface makes
// TypeScript reject a language that is missing any text.

import type { SttErrorCode } from './adapters/stt/webspeech.ts';
import type { Lang } from './core/language.ts';
import type { MicHint } from './core/mic-check.ts';

export interface Strings {
  /** Value for <html lang>. */
  htmlLang: Lang;
  // landing
  tagline: string;
  start: string;
  info: string;
  settings: string;
  /** Static, trusted markup for the Info dialog. */
  infoHtml: string;
  // settings dialog
  settingsTitle: string;
  languageLabel: string;
  languageHint: string;
  speedLabel: string;
  speedHint: string;
  speedFast: string;
  speedNormal: string;
  speedCalm: string;
  speedCustom: (seconds: number) => string;
  modelLabel: string;
  modelHint: string;
  cancel: string;
  save: string;
  // presentation
  mic: string;
  stop: string;
  steerPlaceholder: string;
  emptyDeck: string;
  listeningOn: (device: string) => string;
  micOff: string;
  micOffRetry: string;
  steering: (note: string) => string;
  noSlidesLocal: string;
  noSlidesRemote: (provider: string) => string;
  stats: (provider: string, calls: number, changes: number) => string;
  micUnavailable: (reason: string) => string;
  micHints: Record<MicHint, string>;
  sttErrors: Record<SttErrorCode, string>;
}

const en: Strings = {
  htmlLang: 'en',
  tagline: 'Speak. Your slides follow.',
  start: 'Start',
  info: 'Info',
  settings: 'Settings',
  infoHtml: `
    <h2>How Exlide works</h2>
    <p>Exlide listens while you teach and builds the slides for you. You never prepare a deck.</p>
    <ol>
      <li>Press <strong>Start</strong> and allow the microphone.</li>
      <li>Teach normally. Your words appear at the bottom; slides follow within a few seconds.</li>
      <li>Type a short note in the box at the bottom to steer, e.g. <em>"add a slide with an exercise"</em> or <em>"skip the history"</em>.</li>
      <li>Press <strong>Stop</strong> to pause listening.</li>
    </ol>
    <p class="hint">Needs Chrome or Edge and an internet connection for speech recognition (the browser sends the audio to Google or Microsoft). Slides are made by an AI model running on this computer (Ollama), so lesson content stays local.</p>
    <div class="actions"><button type="button" class="primary" data-close>Got it</button></div>`,
  settingsTitle: 'Settings',
  languageLabel: 'Language / Limba',
  languageHint: 'The language you teach in. It sets speech recognition, the slides and the app text.',
  speedLabel: 'Slide updates',
  speedHint: 'How often Exlide checks what you said. Calm = fewer slide changes.',
  speedFast: 'Fast (4 s)',
  speedNormal: 'Normal (6 s)',
  speedCalm: 'Calm (8 s)',
  speedCustom: (s) => `Custom (${s} s)`,
  modelLabel: 'AI model (Ollama)',
  modelHint: 'Leave empty for the default. It must be downloaded with "ollama pull".',
  cancel: 'Cancel',
  save: 'Save',
  mic: 'Mic',
  stop: 'Stop',
  steerPlaceholder: 'Steer: e.g. skip the history',
  emptyDeck: 'Start talking. Slides will appear here.',
  listeningOn: (device) => `Listening on: ${device}`,
  micOff: 'Mic off',
  micOffRetry: 'Mic off. Press Mic to try again.',
  steering: (note) => `Steering: "${note}"`,
  noSlidesLocal: 'No slides yet: the AI model (Ollama) is not running. See README, "Providers".',
  noSlidesRemote: (p) => `No slides yet: ${p} is not reachable. Retrying.`,
  stats: (p, calls, changes) => `${p}: ${calls} calls, ${changes} changes`,
  micUnavailable: (reason) => `Microphone unavailable: ${reason}`,
  micHints: {
    network: 'The speech service cannot be reached. Speech recognition in Chrome/Edge needs an internet connection.',
    'no-mic-access':
      'The speech engine did not get the microphone. Close other apps using the mic (Teams, Discord, Zoom), check that the right mic is the Windows default input, then press Mic again.',
    'sound-no-words':
      'The mic picks up sound but no words come back. Speak a full sentence close to the mic, check the language in Settings, or try another mic.',
  },
  sttErrors: {
    unsupported: 'Speech recognition needs Chrome or Edge.',
    'not-allowed': 'Microphone permission denied. Allow it in the browser address bar.',
    'service-not-allowed': 'Speech recognition is blocked in this browser. Use Chrome or Edge.',
    'audio-capture': 'No microphone found. Check that one is connected and set as the default input.',
    'language-not-supported': 'This language is not supported for speech recognition.',
    network: 'Speech service unreachable. Check the internet connection.',
    'start-failed': 'Speech recognition did not start. Press Mic again.',
  },
};

const ro: Strings = {
  htmlLang: 'ro',
  tagline: 'Vorbește. Slide-urile te urmează.',
  start: 'Începe',
  info: 'Info',
  settings: 'Setări',
  infoHtml: `
    <h2>Cum funcționează Exlide</h2>
    <p>Exlide ascultă în timp ce predai și construiește slide-urile pentru tine. Nu trebuie să pregătești nimic dinainte.</p>
    <ol>
      <li>Apasă <strong>Începe</strong> și permite accesul la microfon.</li>
      <li>Predă normal. Cuvintele tale apar jos, iar slide-urile urmează în câteva secunde.</li>
      <li>Scrie o notă scurtă în căsuța de jos ca să ghidezi prezentarea, de exemplu <em>„adaugă un slide cu un exercițiu”</em> sau <em>„sari peste istorie”</em>.</li>
      <li>Apasă <strong>Stop</strong> ca să oprești ascultarea.</li>
    </ol>
    <p class="hint">Funcționează în Chrome sau Edge și are nevoie de internet pentru recunoașterea vocii (browserul trimite sunetul la Google sau Microsoft). Slide-urile sunt create de un model AI care rulează pe acest calculator (Ollama), deci conținutul lecției rămâne local.</p>
    <div class="actions"><button type="button" class="primary" data-close>Am înțeles</button></div>`,
  settingsTitle: 'Setări',
  languageLabel: 'Language / Limba',
  languageHint: 'Limba în care predai. Schimbă recunoașterea vocii, slide-urile și textul aplicației.',
  speedLabel: 'Actualizarea slide-urilor',
  speedHint: 'Cât de des verifică Exlide ce ai spus. Calm = mai puține schimbări de slide.',
  speedFast: 'Rapid (4 s)',
  speedNormal: 'Normal (6 s)',
  speedCalm: 'Calm (8 s)',
  speedCustom: (s) => `Personalizat (${s} s)`,
  modelLabel: 'Model AI (Ollama)',
  modelHint: 'Lasă gol pentru modelul implicit. Trebuie descărcat cu „ollama pull”.',
  cancel: 'Anulează',
  save: 'Salvează',
  mic: 'Mic',
  stop: 'Stop',
  steerPlaceholder: 'Ghidează: de ex. sari peste istorie',
  emptyDeck: 'Începe să vorbești. Slide-urile vor apărea aici.',
  listeningOn: (device) => `Ascult pe: ${device}`,
  micOff: 'Microfon oprit',
  micOffRetry: 'Microfon oprit. Apasă Mic ca să încerci din nou.',
  steering: (note) => `Notă: „${note}”`,
  noSlidesLocal: 'Încă nu apar slide-uri: modelul AI (Ollama) nu rulează. Vezi README, „Providers”.',
  noSlidesRemote: (p) => `Încă nu apar slide-uri: ${p} nu răspunde. Reîncerc.`,
  stats: (p, calls, changes) => `${p}: ${calls} cereri, ${changes} modificări`,
  micUnavailable: (reason) => `Microfon indisponibil: ${reason}`,
  micHints: {
    network: 'Serviciul de recunoaștere a vocii nu poate fi accesat. Chrome și Edge au nevoie de internet pentru asta.',
    'no-mic-access':
      'Recunoașterea vocii nu a primit microfonul. Închide alte aplicații care folosesc microfonul (Teams, Discord, Zoom), verifică în Windows că microfonul corect este cel implicit, apoi apasă din nou Mic.',
    'sound-no-words':
      'Microfonul aude sunet, dar nu se recunosc cuvinte. Spune o propoziție întreagă aproape de microfon, verifică limba din Setări sau încearcă alt microfon.',
  },
  sttErrors: {
    unsupported: 'Recunoașterea vocii funcționează doar în Chrome sau Edge.',
    'not-allowed': 'Accesul la microfon a fost refuzat. Permite-l din bara de adrese a browserului.',
    'service-not-allowed': 'Recunoașterea vocii este blocată în acest browser. Folosește Chrome sau Edge.',
    'audio-capture': 'Nu am găsit niciun microfon. Verifică dacă este conectat și setat ca intrare implicită.',
    'language-not-supported': 'Limba aleasă nu este suportată pentru recunoașterea vocii.',
    network: 'Serviciul de recunoaștere a vocii nu răspunde. Verifică conexiunea la internet.',
    'start-failed': 'Recunoașterea vocii nu a pornit. Apasă din nou Mic.',
  },
};

export const STRINGS: Record<Lang, Strings> = { en, ro };

export function strings(lang: Lang): Strings {
  return STRINGS[lang];
}
