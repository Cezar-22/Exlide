# Exlide

Exlide is a live presentation tool. It listens to the speaker, transcribes the speech, and has an AI "slide director" build and update a reveal.js deck while they talk. The speaker can type short steering notes ("skip the history, go to examples"), and the director treats those as high-priority instructions.

The app runs in a browser and, later, as a Windows `.exe` built with Tauri, from one codebase. It works with free providers by default.

## Repository layout

```
Project/                 repo root
  claude.md              project instructions for the AI coding agent
  logs.txt               the agent's append-only work log
  README.md              this file
  Exlide/                the app (run every npm command in here)
    src/core/            platform-independent logic: deck, operations, director, transcript (no DOM / Tauri)
    src/adapters/        speech-to-text (stt/) and LLM (llm/) providers
    src/ui/              mic button, steering input, deck component, styles
    server/              small proxy for hosted providers that need API keys
    fixtures/            recorded transcripts for replay mode
    scripts/             Node scripts (replay)
    tests/               Vitest tests
```

## What the initial commit contains

Step 0 (scaffold) only:
- Vite + TypeScript (strict) + Vitest tooling and the npm scripts listed below.
- The `SttProvider` and `LlmProvider` interfaces (`Exlide/src/core/providers.ts`), plus mock implementations for tests.
- A switchable debug logger for the app's own diagnostics (`Exlide/src/core/debug.ts`).
- Config read from whitelisted env vars (`Exlide/src/config.ts`, `Exlide/vite.config.ts`). API keys never reach the client.
- A UI shell with the mic button, steering input and slide area. None of it is wired up yet.

Step 1 (deck model):
- Deck state and limits (`Exlide/src/core/deck.ts`): at most 5 bullets per slide, bullet and title length caps, 40 slides.
- Operation types, defined once (`Exlide/src/core/operations.ts`): `add_slide`, `update_bullets`, `set_title`, `remove_slide`, `reorder`, `no_change`.
- Validator for untrusted model output (`Exlide/src/core/schema.ts`). It parses JSON (bare array, `{"operations": [...]}`, code fences, surrounding chatter), checks each op's shape and slide references in sequence, and drops invalid ops with a reason.
- Pure, immutable reducer (`Exlide/src/core/reducer.ts`). Edits that change nothing return the same object, so the renderer can skip them without flicker.

Step 2 (renderer):
- `Exlide/src/ui/deck-view.ts` wraps reveal.js. It diffs each new deck snapshot against the DOM, so unchanged slides and bullets stay put and new ones fade in. Text is set with `textContent` only, because model output is untrusted.
- A fixed demo operation list (`Exlide/src/ui/demo.ts`) drives the renderer through the real validator. It includes one deliberately bad op, which gets dropped and logged.
- `npm run build:single` builds the whole browser app into a single `index.html` that opens straight from disk.

Step 3 (director, no audio yet):
- `Exlide/src/core/director.ts` runs one tick at a time. It skips the call when there are no new words, when the current slide is younger than 8 s, or when a call is already running. Otherwise it sends the transcript window, the deck and any steering note to the LLM. Invalid replies get one retry with the error message, then a fallback to `no_change`.
- `Exlide/src/core/stability.ts` enforces the 8 s dwell, at most one new slide per reply, and at most one existing bullet reworded or removed per update. Typed steering notes override all three.
- `Exlide/src/core/transcript.ts` keeps the last 3 minutes of final text and a running summary (the titles already on the deck).
- `Exlide/src/core/prompts.ts` holds a short prompt with two examples. `Exlide/src/core/json-schema.ts` is the reply schema, passed to providers' structured-output modes.
- Providers: `Exlide/src/adapters/llm/ollama.ts` (browser and Node) and `Exlide/server/llm/openai-compatible.ts` (Groq, server/Node only because it needs a key).
- Replay mode (`npm run replay`) and two recorded fixtures. In the app, `?paste` opens a dev panel to play a pasted transcript in real time, and the steering input works there.

Not yet verified against a real model: Ollama is not installed on the dev machine and there is no Groq key yet. Everything is tested with a mock LLM.

Step 4 (speech input, browser):
- Mic button: open the app with no URL parameters and press **Mic**. `Exlide/src/adapters/stt/webspeech.ts` uses the Web Speech API in continuous mode with interim results, restarts it after pauses, backs off on network errors, and shows clear messages for a denied permission or a missing mic.
- An input-level ring on the button (`Exlide/src/ui/mic-level.ts`) and "Listening on: <device>" in the status line confirm which mic is live. Recognized words appear there as a live caption.
- Teaching subjects: the director prompt (`Exlide/src/core/prompts.ts`) knows how to write math, physics and CS formulas (a² + b² = c², F = m·a, O(log n)) and fixes common recognition slips ("pie r squared" → π·r²). There are three lesson fixtures: `math-pythagoras`, `physics-newton`, `cs-binary-search`.
- A live caption bar shows the words as they're recognized. A built-in mic check (`Exlide/src/core/mic-check.ts`) explains in plain words when the mic has sound but no words come back, when the speech engine never got the mic, or when there's no internet.
- Tuned against `llama3.1:8b` on the three lesson fixtures (2026-10-14). The model sees which slides are full and which words are new. It may only delete or reorder slides when a typed steering note literally asks for that, so slides the class has seen never vanish.
- Not done yet: running this inside Tauri (needs the Rust toolchain).

Landing page (user's design, "web interface v1"):
- The app opens on the landing page: logo, tagline, wave animation, Start / Info / Settings. **Start** opens the presentation and turns the mic on in the same click, so the permission prompt appears right away.
- **Info** is a short how-to. **Settings** sets the speech language, slide-update speed and AI model. They're saved in the browser (`localStorage`) and override the `.env` defaults (`Exlide/src/settings.ts`).
- The design came from a Lovable project (React, Tailwind, TanStack Start). It was ported 1:1 to plain TypeScript + CSS (`Exlide/src/ui/landing.ts`, `landing.css`) instead of adding React and ~60 packages. The original folder `web interface v1/` is left untouched and kept out of git (`.git/info/exclude`). Logo: `Exlide/src/assets/exlide-logo.png`. Fonts: Manrope + Sora from Google Fonts.
- `?demo` and `?paste` skip the landing page.

Still missing: speech input inside Tauri (step 4), live loop and proxy (step 5), Tauri packaging (step 6).

## Run

Requires Node.js 22.18+ (developed on 24.20).

**Quick start:** type `exlide` in any new terminal (cmd, PowerShell or Git Bash). It installs dependencies on the first run, starts the dev server and opens http://localhost:5173 in Edge. Stop it with Ctrl+C. The launchers are `Exlide/bin/exlide.cmd` and `Exlide/bin/exlide`, and `Exlide/bin` was added to the user PATH. On another machine, add that folder to PATH yourself. `EXLIDE_NO_BROWSER=1` skips opening the browser.

Manual way:

```
cd Exlide
npm install
cp .env.example .env     # optional, the defaults work without it
npm run dev              # http://localhost:5173
```

Renderer demo (no AI, no mic): open http://localhost:5173/?demo. Use `?demo=800` for a faster step (milliseconds).

Single HTML file (no server needed):

```
cd Exlide
npm run build:single     # writes Exlide/dist-single/index.html (~760 kB, fonts inlined)
```

Double-click that file to open it in Chrome or Edge, and add `?demo` to the URL to see the demo. Caveats: on `file://` the browser asks for mic permission more often. Browsers also send `Origin: null` from `file://`, which Ollama's default allow-list probably rejects, so set `OLLAMA_ORIGINS=*` (untested) or use `npm run dev` instead.

Director without a mic: start Ollama (see Providers), run `npm run dev`, open http://localhost:5173/?paste, paste a transcript (or a file from `Exlide/fixtures/`) and press Play. `?paste=4` plays it 4x faster. Type steering notes in the bottom input.

Tauri build: not set up yet (step 6).

## Test

```
cd Exlide
npm run typecheck   # tsc against three configs: core (no DOM), app (DOM), node (tests/scripts/server)
npm test            # Vitest, no network calls
```

Replay mode feeds the recorded transcripts in `Exlide/fixtures/` through the director on a simulated clock (no mic, no waiting between ticks) and prints a quality report: calls, retries, fallbacks, valid / dropped / `no_change` counts, ops held by stability, latency, screen changes, the shortest time any slide stayed up, and the final deck.

```
cd Exlide
npm run replay                                   # all fixtures, provider from .env (default ollama)
npm run replay -- --provider mock --no-latency   # offline pipeline check
npm run replay -- --provider ollama --model qwen3:4b --fixture fixtures/git-basics.txt
npm run replay -- --provider groq --interval 4000   # needs HOSTED_LLM_API_KEY in .env
npm run replay -- --verbose                      # also print every prompt / reply / dropped op
npm run replay -- --json > report.json           # machine-readable, to compare providers
```

Fixture format (`Exlide/src/core/fixture.ts`): `[mm:ss] spoken text`, `[mm:ss] >> steering note`, `# comment`. Plain prose works too and is timed at a normal speaking rate.

## Modify

- Provider interfaces: `Exlide/src/core/providers.ts`.
- Add or change an operation: the type in `Exlide/src/core/operations.ts`, then its validation in `schema.ts` and its effect in `reducer.ts`. TypeScript's exhaustive switches point to every place that needs updating.
- Slide limits (bullets, lengths): `LIMITS` in `Exlide/src/core/deck.ts`.
- Which env vars the browser can see: `PUBLIC_ENV` in `Exlide/vite.config.ts`. Never add a key there.
- App config defaults: `Exlide/src/config.ts`.
- Landing page: `Exlide/src/ui/landing.ts` (markup, Info text, Settings form) and `Exlide/src/ui/landing.css` (design tokens at the top). Settings fields and their validation: `Exlide/src/settings.ts`.
- UI look: `Exlide/src/ui/styles.css`. reveal.js theme: the `reveal.js/theme/*.css` import in `Exlide/src/ui/deck-view.ts`.
- How decks render and animate: `Exlide/src/ui/deck-view.ts`. Demo script: `Exlide/src/ui/demo.ts`.
- Single-file build: the `inlineIntoHtml` plugin in `Exlide/vite.config.ts`.
- Director behavior: `Exlide/src/core/director.ts`, the prompt in `Exlide/src/core/prompts.ts`, stability thresholds in `DEFAULT_STABILITY` (`Exlide/src/core/stability.ts`), transcript window and token budget in `DEFAULT_DIRECTOR_OPTIONS` (`director.ts`). Check every change with `npm run replay`.
- Add an LLM provider: implement `LlmProvider` in `Exlide/src/adapters/llm/` (no key needed) or `Exlide/server/llm/` (needs a key), then add it to `Exlide/src/adapters/llm/index.ts` and `makeProvider` in `Exlide/scripts/replay.ts`.
- Add a fixture: drop a `.txt` into `Exlide/fixtures/`. Replay and the tests pick it up automatically.

`tsconfig.core.json` has no DOM or Node types, so any browser or Node API used in `src/core` fails typecheck. That is deliberate: it keeps the core portable.

## Providers

Switch with `LLM_PROVIDER` / `LLM_MODEL` (and later `STT_PROVIDER`) in `Exlide/.env`. Copy `.env.example` to start.

### Slide-director LLM (researched 2026-10-14; full notes in `logs.txt`)

| Order | Provider | Cost | Your text used for training? | Notes |
|---|---|---|---|---|
| 1 (default) | **Ollama**, local, model `llama3.2:3b` | free, unlimited | no, it never leaves the machine | JSON-schema `format` (constrained decoding). Needs a few GB of RAM. Try `qwen3:4b` too and compare with replay. Use `DIRECTOR_INTERVAL_MS=6000`-`8000`. |
| 2 | **Groq** free plan, `openai/gpt-oss-20b` | free, no card | no (Groq privacy page: no training, prompts not retained) | Strict `json_schema`. Docs show about 30 req/min and 1K req/day; your real free limits are in the Groq console. 1K/day is about 1-1.5 h of live talk at a 4-6 s tick. Goes through `server/` because it needs a key. |
| 3 (paid, optional) | **Anthropic `claude-haiku-5-5`** | paid | no | Best quality. Wired up in step 5 with the proxy. Never Opus in the live loop. |

Ruled out: Gemini free tier (Google no longer publishes the limits, reports say they were cut to about 20 req/day on some models, and outside the EEA/UK/CH free-tier data is used and human-reviewed), Cerebras (a 30-day $5 trial, not ongoing free), OpenRouter free models (about 50 req/day), Mistral free tier (requires opting in to training).

Setting up Ollama: `winget install Ollama.Ollama` (or https://ollama.com), then `ollama pull llama3.1:8b` on a PC with a decent GPU (about 0.7 s per update on an RTX 4070 SUPER), or `ollama pull llama3.2:3b` on a weak laptop. Set `LLM_MODEL` in `Exlide/.env` to match. Ollama starts with Windows and runs in the tray. The browser dev server (localhost) is on Ollama's default CORS allow-list. The Tauri window on Windows (`http://tauri.localhost`) is not, so step 6 handles that.

### Mic troubleshooting

Press **Mic**, then say a full sentence. The words should appear in the dark caption bar at the bottom of the slide area within about a second. If they don't:

1. **Use Chrome or Edge.** `exlide` opens Edge. Other browsers (Opera, Firefox) don't have working speech recognition.
2. **Allow the microphone** when the browser asks. If you clicked Block: click the icon at the left of the address bar, then Microphone → Allow, and reload.
3. **Pick the mic in Windows.** Settings → System → Sound → Input: choose the mic and use "Test your microphone". For the Sennheiser HD 450BT choose **"Headset (LE-HD 450BT Hands-Free)"**. The status line shows which device Exlide is listening on.
4. **Close other apps using the mic** (Teams, Discord, Zoom, OBS). They can hold on to a Bluetooth headset.
5. **Internet:** Chrome and Edge do speech recognition online. With no connection, the caption bar says so.
6. **Accent or language:** recognition copes well with accents in English. If you teach in Romanian, set `STT_LANG=ro-RO` in `Exlide/.env` and restart `exlide`.
7. Still nothing? Press F12 → Console and look for `[exlide] stt.state` lines. The event names (`audiostart`, `soundstart`, `speechstart`, `error:...`) show exactly how far the audio got.

### Speech-to-text (researched 2026-10-14)

**Web Speech API** (`STT_PROVIDER=webspeech`, language `STT_LANG`, default `en-US`; `ro-RO`, `en-GB` etc. work). Free, no key, streaming with interim results, Chrome and Edge only. **Privacy:** Chrome sends the audio to Google's servers and Edge to Microsoft's, so it needs internet. I could not confirm whether either uses that audio for training. An on-device mode (`processLocally`) exists but is still experimental (Edge Canary/Dev). Local Whisper and Deepgram stay as later options.

**Microphones:** the Web Speech API always uses the **OS default input** and cannot pick a device. To use a headset, set it as the default recording device in Windows (Settings → System → Sound → Input) before pressing Mic. Bluetooth headsets (e.g. Sennheiser Momentum/HD 450BT) switch to hands-free mode while the mic is in use: audio gets mono and lower quality, and recognition is usually a bit worse than with a wired or laptop mic.
