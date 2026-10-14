import type { AppConfig } from '../../config.ts';
import type { SttProvider } from '../../core/providers.ts';
import { MockSttProvider } from './mock.ts';
import { findRecognitionCtor, WebSpeechProvider } from './webspeech.ts';

/** Picks the speech provider from STT_PROVIDER. */
export function createSttProvider(config: AppConfig): SttProvider {
  switch (config.sttProvider) {
    case 'webspeech':
      return new WebSpeechProvider({ ctor: findRecognitionCtor(window), lang: config.sttLang });
    case 'mock':
      return new MockSttProvider();
  }
}
