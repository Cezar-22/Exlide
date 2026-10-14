import type { LlmProvider, LlmRequest } from '../../core/providers.ts';

/**
 * Scripted LLM for tests and offline replay. Returns the queued responses in
 * order; once the script runs out it keeps answering with `fallback`.
 */
export class MockLlmProvider implements LlmProvider {
  readonly name = 'mock';
  readonly requests: LlmRequest[] = [];
  private readonly script: Array<string | Error>;
  private readonly fallback: string;

  constructor(script: Array<string | Error> = [], fallback = '[{"op":"no_change"}]') {
    this.script = [...script];
    this.fallback = fallback;
  }

  complete(request: LlmRequest): Promise<string> {
    this.requests.push(request);
    const next = this.script.shift();
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next ?? this.fallback);
  }
}
