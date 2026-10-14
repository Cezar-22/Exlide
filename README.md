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

Still missing: director and LLM providers (step 3), speech input (step 4), live loop and proxy (step 5), Tauri packaging (step 6).

## Run

Requires Node.js 22.18+ (developed on 24.20).

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

Double-click that file to open it in Chrome or Edge, and add `?demo` to the URL to see the demo. Caveats for later steps: on `file://` the browser asks for mic permission more often, and a local Ollama only accepts requests from `file://` if you set `OLLAMA_ORIGINS` (see Providers once step 3 lands).

Tauri build: not set up yet (step 6).

## Test

```
cd Exlide
npm run typecheck   # tsc against three configs: core (no DOM), app (DOM), node (tests/scripts/server)
npm test            # Vitest, no network calls
```

Replay mode (`npm run replay`) arrives with the director in step 3.

## Modify

- Provider interfaces: `Exlide/src/core/providers.ts`.
- Add or change an operation: the type in `Exlide/src/core/operations.ts`, then its validation in `schema.ts` and its effect in `reducer.ts`. TypeScript's exhaustive switches point to every place that needs updating.
- Slide limits (bullets, lengths): `LIMITS` in `Exlide/src/core/deck.ts`.
- Which env vars the browser can see: `PUBLIC_ENV` in `Exlide/vite.config.ts`. Never add a key there.
- App config defaults: `Exlide/src/config.ts`.
- UI look: `Exlide/src/ui/styles.css`. reveal.js theme: the `reveal.js/theme/*.css` import in `Exlide/src/ui/deck-view.ts`.
- How decks render and animate: `Exlide/src/ui/deck-view.ts`. Demo script: `Exlide/src/ui/demo.ts`.
- Single-file build: the `inlineIntoHtml` plugin in `Exlide/vite.config.ts`.

`tsconfig.core.json` has no DOM or Node types, so any browser or Node API used in `src/core` fails typecheck. That is deliberate: it keeps the core portable.

## Providers

Not chosen yet. The research step for the LLM (step 3) and STT (step 4) providers decides this. The defaults are free providers: the browser Web Speech API for speech and a local Ollama model for the director.
