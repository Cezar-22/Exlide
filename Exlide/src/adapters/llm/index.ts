import type { AppConfig } from '../../config.ts';
import type { LlmProvider } from '../../core/providers.ts';
import { MockLlmProvider } from './mock.ts';
import { OllamaProvider } from './ollama.ts';

/** Picks the browser-side LLM provider from LLM_PROVIDER. */
export function createLlmProvider(config: AppConfig): LlmProvider {
  switch (config.llmProvider) {
    case 'ollama':
      return new OllamaProvider({ baseUrl: config.ollamaUrl, model: config.llmModel });
    case 'mock':
      return new MockLlmProvider();
    case 'proxy':
      // Hosted providers (Groq, Anthropic) go through server/ so keys stay off the client. Built in step 5.
      throw new Error('LLM_PROVIDER=proxy is not available yet (the proxy arrives in build step 5)');
  }
}
