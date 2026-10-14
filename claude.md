# Exlide

Exlide is a live presentation tool. It listens to a speaker through the microphone, transcribes the speech in real time, and uses an AI model to build and update a slide deck on screen while the speaker talks. The speaker never prepares slides in advance. They can also type short steering notes (e.g. "skip the history, go to examples"), which the AI treats as high-priority instructions.

The UI is minimal: a microphone button, a steering text input, and the slide view. Keep it that way. Before the presentation there is a landing page (the user's own design: logo, Start / Info / Settings, in `src/ui/landing.ts`); Start opens the presentation and turns the mic on. Do not restyle the landing page: the user owns its design.

Exlide must run as a standalone browser app and as a Windows `.exe` (Tauri) from one codebase.

**Cost goal:** the whole app must work with free providers by default. Paid providers are optional upgrades behind a config switch, never a requirement.

## How you work (read this first)

### 1. Keep `logs.txt`
Maintain an append-only plain-text file `logs.txt` in the repo root. This is your own work log, separate from anything the app prints. Never use `console.log` for it, and the app code must never write to it.

Add a line for every important step, in this format (get the time from `date`):

```
[2026-10-14 18:30] [step 1] CREATED src/core/operations.ts - operation types + validator
[2026-10-14 18:42] [step 1] VERIFIED typecheck OK, 14 tests pass
```

Log these: modules/files created, decisions and why, providers chosen (with the research behind it), dependencies added, every typecheck/test run result (pass or fail), failures and how you fixed them, deviations from this plan, anything you could not verify, and a one-line summary plus the next step at the end of each session.

Do not log routine file reads, small edits, or every command. If a future session needs it to understand what happened, log it. Keep each line short and factual.

### 2. Keep `README.md` useful
After the first working scaffold, write `README.md` with these sections, and update it whenever things change:
- **What the initial commit contains:** a plain summary of what was built and what is still missing.
- **Run:** exact commands to install and start the browser app, and to run the Tauri build.
- **Test:** how to run typecheck and tests, and how to use replay mode.
- **Modify:** where to change things (e.g. "change director behavior: `src/core/director.ts` and the prompt in `src/core/prompts.ts`", "add an STT provider: implement `SttProvider` in `src/adapters/stt/`").
- **Providers:** which providers are used, why, and how to switch them.

Write it for a person who did not watch you work.

### 3. Use git
Initialize the repo in the first session. Make an initial commit once the scaffold, tests and README exist, and commit after each build step with a clear message. Commit `logs.txt` too. Never commit `.env`.

## Stack

- **TypeScript, strict mode**, for all source code. No plain `.js` files in `src/`.
- **Vite** for build and dev server. **Vitest** for tests.
- **Tauri** for the Windows `.exe`. The same web app also runs in a browser.
- **reveal.js** for slide rendering, wrapped in a small TypeScript deck component.
- All of the above are pre-approved. Ask before adding any other dependency, and log it when you do.

## Providers (free-first)

The app talks to speech and AI services only through two interfaces, `SttProvider` and `LlmProvider`, selected by env vars (`STT_PROVIDER`, `LLM_PROVIDER`). Core code never imports a vendor SDK directly.

**Speech-to-text, in order of preference for development:**
1. **Browser Web Speech API.** Free and easiest. Chrome and Edge only. It stops after pauses, so add restart logic. Whether it works inside the Tauri window on Windows is unverified: test this early and log the result.
2. **Local Whisper** (whisper.cpp as a Tauri sidecar, or an in-browser build using WebGPU). Free and private, but chunked, so expect about 1-3 s of lag and heavy hardware use.
3. **Deepgram streaming** (optional, paid after the free credit). About 300 ms latency and the best accuracy.

**Slide-director LLM, in order of preference for development:**
1. **Local model via Ollama.** Free and unlimited. Use a current small instruct model that supports JSON output. Expect weaker judgment and more malformed output.
2. **Free tier of a hosted API** (for example Google Gemini or Groq). Better quality and speed than local, but rate limits and terms change often.
3. **Anthropic `claude-haiku-5-5`** (optional, paid). Fast and cheap, the best quality of the three. Never use Opus in the live loop.

### Research step (required before locking in providers)
Free tiers and limits change often, so do not trust this list blindly. Before choosing the STT provider (step 4) and the LLM provider (step 3), run a time-boxed web search (about 10 searches each) for current free options, including anything better than the above. Check each candidate for:
- free for this use case, and the current rate limits
- whether your audio or text is used for training
- works from a browser and from Tauri
- streaming support (STT) and reliable JSON output (LLM)

Do not use anything whose free terms you cannot confirm. Log your findings and choice in `logs.txt` and the README **Providers** section. If your pick differs from the lists above, tell the user and wait for confirmation before locking it in.

## Commands

Run these inside `Exlide/` (the app folder).

```
npm install            # install dependencies
npm run dev            # Vite dev server (browser app)
npm run typecheck      # tsc --noEmit
npm test               # Vitest
npm run replay         # run a fixture transcript through the director
npm run build          # browser production build
npm run tauri build    # Windows .exe build
```

If a script does not exist yet, create it with this name.

## Verification (after every change)

1. `npm run typecheck` passes with zero errors.
2. `npm test` passes.

Do not report a task as done until both pass, and log the result. Do not silence type errors with `any`, `@ts-ignore` or casts unless unavoidable, and explain the reason in a comment.

## Architecture

1. **Audio capture:** browser `getUserMedia` or the Web Speech API, through the `SttProvider` interface.
2. **Transcript buffer:** the last few minutes of final text plus a running summary of what has been covered.
3. **Slide director:** every few seconds, or when a sentence completes, send the buffer, the current deck state and any pending steering note to the `LlmProvider`. The model returns **only operations**, never a full deck, as `{"operations": [...]}` (an object wrapper, because providers' JSON-schema modes need an object at the top level; the parser also accepts a bare array): `add_slide`, `update_bullets`, `set_title`, `remove_slide`, `reorder`, `no_change`.
4. **Operation validation:** every model output is validated against a typed schema before it touches the deck. Invalid operations are dropped and logged by the app's debug logger, never applied. Treat model output as untrusted input.
5. **Renderer:** applies validated operations to the reveal.js deck with a short animation.
6. **Shared core:** transcript buffer, director, operations and deck state live in a platform-independent module with **no DOM or Tauri imports**. Only the UI and the adapters are platform-specific.

Layout (the app lives in `Exlide/`; the repo root holds only claude.md, logs.txt, README.md, .gitignore):

```
Exlide/
  src/
    core/      # transcript, director, prompts, operations, schema, deck reducer, stability, replay (pure TS)
    adapters/  # stt/ and llm/ providers, browser + Tauri implementations
    ui/        # mic button, steering input, deck component
  server/      # small proxy + keyed providers (Node only), only for hosted providers that use API keys
  scripts/     # replay CLI
  fixtures/    # recorded transcripts for replay mode
  tests/       # Vitest
logs.txt       # your work log, repo root (not written by the app)
```

`tsconfig.core.json` has no DOM or Node types, so typecheck fails if `src/core` touches a platform API.

## Director rules

- **Stability:** a slide stays on screen at least 8 seconds before the director may change it, unless a typed steering note asks for a change.
- Change a slide only when the topic has clearly moved on. **Default to `no_change`.**
- Bullets come from the speaker's words or a supplied source. Do not invent facts.
- Keep slides to 3 to 5 short bullets.
- Typed steering notes are high-priority instructions and override the stability default.
- A slide that rewrites itself every few seconds is a bug. Prefer stability over responsiveness.

## Making free providers work well

Free and local models are weaker, so design for it:
- Ask for JSON only, use the provider's JSON or structured-output mode when it exists, and keep the prompt short with one or two example outputs.
- If the output fails validation, retry once with the error message, then fall back to `no_change`.
- Make the director interval configurable (about 4 s for fast providers, 6-8 s for slow ones). Never queue overlapping calls: skip a tick if one is still running.
- Keep the transcript window small to save tokens and latency.
- Provide a quality check in replay mode that reports how many operations were valid, dropped, or `no_change`, so providers can be compared on the same fixture.

## Security

- API keys must never appear in client code or the repo. Providers that need keys (hosted LLMs, Deepgram) are called through the small backend proxy. Local and in-browser providers need no keys.
- Keys live in environment variables. Provide `.env.example` with placeholder names only, and keep `.env` in `.gitignore`.

## Latency

Targets: STT about 300 ms (paid) or 1-3 s (free), director call 1-2 s (hosted) or a few seconds (local), render under 100 ms. The display may lag the speaker. Design the UI to tolerate this with no flicker, no half-applied states and smooth transitions.

## Testing

- Unit test the operation validator, the transcript buffer and the deck reducer.
- **Replay mode** feeds a recorded transcript from `fixtures/` through the director with no microphone. Use it to tune stability and the "topic has moved on" logic.
- Mock the STT and LLM providers in tests. Tests must not make network calls.

## Build order

Work through these in order. At the start of each session, read `logs.txt`, state which step you are on, and at the end log the next step.

0. Scaffold: tooling, provider interfaces, `logs.txt`, README, initial commit.
1. Deck model, operation schema and reducer, with tests.
2. Renderer with reveal.js, driven by a fixed operation list.
3. Director with a pasted transcript, no audio. Run the LLM provider research step here.
4. Speech input and mic UI. Run the STT provider research step here, and test the Web Speech API inside Tauri.
5. Live loop, stability rules, typed steering input, and the proxy for hosted providers.
6. Tauri `.exe` packaging, and a final README pass.

Do not start a step before the previous one is verified, unless asked.

## Conventions

- Make small, verified changes. Keep functions small and typed.
- Define operation types once in `src/core` and reuse them everywhere.
- The app's own diagnostics (dropped operations with the raw model output and validation error) go through a debug logger that can be turned off. They are separate from `logs.txt`.
- Update this file when an architecture decision changes. Keep it under about 200 lines.