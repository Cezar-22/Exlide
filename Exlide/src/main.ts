import { readConfig } from './config.ts';
import './ui/styles.css';

// Step 0 shell: the three UI parts exist but are not wired up yet.
const config = readConfig(__EXLIDE_ENV__);
const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('#app element missing from index.html');

root.innerHTML = `
  <main class="stage" aria-live="polite"><p class="empty">Slides appear here.</p></main>
  <footer class="controls">
    <button class="mic" type="button" aria-pressed="false" disabled>Mic</button>
    <input class="steer" type="text" placeholder="Steer: e.g. skip the history" disabled />
  </footer>
`;
root.dataset['providers'] = `${config.sttProvider}/${config.llmProvider}`;
