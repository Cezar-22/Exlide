// Director prompt. Kept short on purpose: small local models follow short
// prompts with one or two examples better than long ones, and every token
// costs latency.

import { LIMITS, type DeckState } from './deck.ts';

export const DIRECTOR_SYSTEM_PROMPT = `You direct a live slide deck while a speaker talks. Each turn you get the deck and the latest transcript. Reply with JSON only, in the form {"operations":[...]}.

Operations:
{"op":"no_change"}
{"op":"add_slide","title":"...","bullets":["..."]}  new topic, shown at once
{"op":"update_bullets","slide":"s1","bullets":["..."]}  the full new bullet list
{"op":"set_title","slide":"s1","title":"..."}
{"op":"remove_slide","slide":"s1"}
{"op":"reorder","order":["s2","s1"]}

Rules:
- Default to no_change. Change the deck only when the NEW WORDS add something worth showing. EARLIER text is already on the deck or was skipped on purpose.
- Add a slide only when the topic has clearly moved on. Otherwise add a bullet to the current slide.
- When updating, keep the existing bullets and append. Do not reword them.
- At most ${LIMITS.maxBullets} bullets per slide, each under 10 words. Titles under 7 words.
- A slide marked "full" takes no more bullets. If the speaker goes on, add a new slide with a different, more specific title.
- Never reuse an existing slide title. Never repeat a bullet that is already on the deck.
- Use remove_slide and reorder only when a STEERING note asks for it. Never delete a slide to make room.
- Use only what the speaker said. Never invent facts, numbers or names.
- A STEERING note is a direct instruction from the speaker. Follow it now.

The speaker is usually a teacher (math, physics, computer science):
- Write formulas in plain text with symbols: a² + b² = c², F = m·a, v = Δx/Δt, E = m·c², O(n log n), √2, π, ≤, ≠.
- Speech recognition mangles technical words. Fix obvious slips: "pie r squared" → π·r², "x squared" → x², "big oh of n" → O(n), "delta t" → Δt, "integral of" → ∫.
- Name a definition, law or theorem when the speaker states one (e.g. "Newton's second law: F = m·a"). Worked examples get their own bullets: given, formula, result.

Example, physics: {"operations":[{"op":"add_slide","title":"Newton's second law","bullets":["F = m·a","Force in newtons (N)","2 kg pushed at 3 m/s² → 6 N"]}]}
Example, new topic: {"operations":[{"op":"add_slide","title":"Battery storage","bullets":["Stores midday surplus","Powers the evening peak"]}]}
Example, nothing new: {"operations":[{"op":"no_change"}]}`;

export interface DirectorPromptInput {
  deck: DeckState;
  /** Transcript the director has already acted on (context only). */
  earlier: string;
  /** Words spoken since the last director call. */
  latest: string;
  summary: string;
  steering: string | null;
}

/** Compact deck description the model can reference slide ids from. */
export function describeDeck(deck: DeckState): string {
  return JSON.stringify({
    current: deck.currentId,
    slides: deck.slides.map((s) => ({
      id: s.id,
      title: s.title,
      bullets: s.bullets,
      ...(s.bullets.length >= LIMITS.maxBullets ? { full: true } : {}),
    })),
  });
}

export function buildDirectorUserPrompt(input: DirectorPromptInput): string {
  const lines = [`DECK: ${describeDeck(input.deck)}`];
  if (input.summary !== '') lines.push(`COVERED SO FAR: ${input.summary}`);
  if (input.earlier !== '') lines.push(`EARLIER (already handled, context only): ${JSON.stringify(input.earlier)}`);
  lines.push(`NEW WORDS (since your last update): ${JSON.stringify(input.latest)}`);
  if (input.steering !== null) lines.push(`STEERING: ${JSON.stringify(input.steering)}`);
  return lines.join('\n');
}

/** Follow-up after invalid output: same request plus what went wrong. */
export function buildRetryUserPrompt(original: string, badOutput: string, error: string): string {
  const shown = badOutput.length > 600 ? `${badOutput.slice(0, 600)}...` : badOutput;
  return `${original}\n\nYour previous reply was rejected: ${error}\nPrevious reply: ${shown}\nReply again with only {"operations":[...]} using the listed operations and existing slide ids.`;
}

/** One-line summary of what the deck already covers, for the transcript buffer. */
export function coveredSummary(deck: DeckState): string {
  return deck.slides.map((s) => s.title).join('; ');
}
