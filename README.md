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

Still missing: deck model and reducer (step 1), reveal.js renderer (step 2), director and LLM providers (step 3), speech input (step 4), live loop and proxy (step 5), Tauri packaging (step 6).

## Run

Requires Node.js 22.18+ (developed on 24.20).

```
cd Exlide
npm install
cp .env.example .env     # optional, the defaults work without it
npm run dev              # http://localhost:5173
```

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
- Which env vars the browser can see: `PUBLIC_ENV` in `Exlide/vite.config.ts`. Never add a key there.
- App config defaults: `Exlide/src/config.ts`.
- UI look: `Exlide/src/ui/styles.css`.

`tsconfig.core.json` has no DOM or Node types, so any browser or Node API used in `src/core` fails typecheck. That is deliberate: it keeps the core portable.

## Providers

Not chosen yet. The research step for the LLM (step 3) and STT (step 4) providers decides this. The defaults are free providers: the browser Web Speech API for speech and a local Ollama model for the director.
