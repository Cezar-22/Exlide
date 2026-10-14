// Server-side client for OpenAI-compatible chat APIs (Groq's free tier).
// Needs an API key, so it only ever runs in Node: the proxy server and the
// replay script. Never import this from src/.

import { pick } from '../../src/core/json.ts';
import type { LlmProvider, LlmRequest } from '../../src/core/providers.ts';

export interface OpenAiCompatibleOptions {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Use strict `json_schema` output. When false, falls back to `json_object` mode. */
  strictSchema: boolean;
}

export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name: string;
  private readonly options: OpenAiCompatibleOptions;

  constructor(options: OpenAiCompatibleOptions) {
    this.options = { ...options, baseUrl: options.baseUrl.replace(/\/+$/, '') };
    this.name = `${options.name}:${options.model}`;
  }

  async complete(request: LlmRequest): Promise<string> {
    const { baseUrl, apiKey, model, strictSchema } = this.options;
    let responseFormat: Record<string, unknown> | undefined;
    if (request.jsonSchema) {
      responseFormat = strictSchema
        ? { type: 'json_schema', json_schema: { name: 'director_reply', strict: true, schema: request.jsonSchema } }
        : { type: 'json_object' };
    }
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(request.timeoutMs),
      body: JSON.stringify({
        model,
        temperature: request.temperature,
        max_completion_tokens: request.maxTokens,
        response_format: responseFormat,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.user },
        ],
      }),
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      throw new Error(`${this.name} HTTP ${response.status}: ${String(pick(body, 'error', 'message') ?? 'unknown error')}`);
    }
    const content = pick(body, 'choices', 0, 'message', 'content');
    if (typeof content !== 'string') throw new Error(`${this.name} reply had no message content`);
    return content;
  }
}

export const GROQ_DEFAULTS = {
  name: 'groq',
  baseUrl: 'https://api.groq.com/openai/v1',
  model: 'openai/gpt-oss-20b',
  strictSchema: true,
} as const;
