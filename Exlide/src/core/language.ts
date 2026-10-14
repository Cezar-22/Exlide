// Supported lesson languages. One choice drives speech recognition, the
// language the slides are written in, and the interface text.

export type Lang = 'en' | 'ro';

export interface LanguageOption {
  /** BCP-47 code handed to the speech recognizer. */
  readonly code: string;
  readonly lang: Lang;
  /** Name shown in the Settings list, in its own language. */
  readonly label: string;
  /** English name used in the director prompt. */
  readonly promptName: string;
}

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: 'en-US', lang: 'en', label: 'English', promptName: 'English' },
  { code: 'ro-RO', lang: 'ro', label: 'Română', promptName: 'Romanian' },
];

export function isSupportedLanguageCode(code: string): boolean {
  return LANGUAGE_OPTIONS.some((o) => o.code === code);
}

/** Maps any BCP-47 code to a supported language (English for anything unknown). */
export function langOf(code: string): Lang {
  return code.toLowerCase().startsWith('ro') ? 'ro' : 'en';
}

export function languageOption(lang: Lang): LanguageOption {
  const option = LANGUAGE_OPTIONS.find((o) => o.lang === lang);
  if (!option) throw new Error(`no language option for ${lang}`);
  return option;
}
