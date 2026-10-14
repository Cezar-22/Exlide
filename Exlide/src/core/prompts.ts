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
- Default to no_change. Change the deck only when the speaker said something new worth showing.
- Add a slide only when the topic has clearly moved on. Otherwise add a bullet to the current slide.
- When updating, keep the existing bullets and append. Do not reword them.
- At most ${LIMITS.maxBullets} bullets per slide, each under 10 words. Titles under 7 words.
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
  transcript: string;
  summary: string;
  steering: string | null;
}

/** Compact deck description the model can reference slide ids from. */
export function describeDeck(deck: DeckState): string {
  return JSON.stringify({
    current: deck.currentId,
    slides: deck.slides.map((s) => ({ id: s.id, title: s.title, bullets: s.bullets })),
  });
}

export function buildDirectorUserPrompt(input: DirectorPromptInput): string {
  const lines = [`DECK: ${describeDeck(input.deck)}`];
  if (input.summary !== '') lines.push(`COVERED SO FAR: ${input.summary}`);
  lines.push(`TRANSCRIPT (latest words last): ${JSON.stringify(input.transcript)}`);
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
