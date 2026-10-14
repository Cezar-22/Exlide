// Local Ollama server (free, no key, nothing leaves the machine). Works from
// the browser dev server and Node: Ollama's default CORS list allows
// localhost / 127.0.0.1 origins. Uses the JSON-schema `format` field, so
// Ollama constrains decoding to the director's reply shape.

import { pick } from '../../core/json.ts';
import type { LlmProvider, LlmRequest } from '../../core/providers.ts';

export const DEFAULT_OLLAMA_MODEL = 'llama3.2:3b';

export interface OllamaOptions {
  baseUrl: string;
  model: string;
  /** How long Ollama keeps the model loaded between calls. */
  keepAlive: string;
}

export class OllamaProvider implements LlmProvider {
  readonly name: string;
  private readonly options: OllamaOptions;

  constructor(options: Partial<OllamaOptions> = {}) {
    this.options = {
      baseUrl: (options.baseUrl ?? 'http://127.0.0.1:11434').replace(/\/+$/, ''),
      model: options.model || DEFAULT_OLLAMA_MODEL,
      keepAlive: options.keepAlive ?? '30m',
    };
    this.name = `ollama:${this.options.model}`;
  }

  async complete(request: LlmRequest): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs);
    try {
      const response = await fetch(`${this.options.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.options.model,
          stream: false,
          keep_alive: this.options.keepAlive,
          format: request.jsonSchema ?? undefined,
          options: { temperature: request.temperature, num_predict: request.maxTokens },
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        throw new Error(`Ollama HTTP ${response.status}: ${String(pick(body, 'error') ?? 'unknown error')}`);
      }
      const content = pick(body, 'message', 'content');
      if (typeof content !== 'string') throw new Error('Ollama reply had no message content');
      return content;
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`Ollama timed out after ${request.timeoutMs} ms`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
