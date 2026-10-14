import { describe, expect, it } from 'vitest';
import { emptyDeck } from '../src/core/deck.ts';
import { fixtureLanguageCode } from '../src/core/fixture.ts';
import { langOf, LANGUAGE_OPTIONS } from '../src/core/language.ts';
import { buildDirectorUserPrompt } from '../src/core/prompts.ts';
import { STRINGS } from '../src/i18n.ts';

const base = { deck: emptyDeck(0), earlier: '', latest: 'Teorema lui Pitagora.', summary: '', steering: null };

describe('lesson language', () => {
  it('asks for Romanian slides with diacritics in a Romanian lesson', () => {
    const prompt = buildDirectorUserPrompt({ ...base, language: 'ro' });
    expect(prompt.split('\n')[0]).toMatch(/^LANGUAGE: The lesson is in Romanian/);
    expect(prompt).toContain('ă, â, î, ș, ț');
  });

  it('adds nothing for English (keeps the prompt short)', () => {
    expect(buildDirectorUserPrompt({ ...base, language: 'en' })).not.toContain('LANGUAGE:');
  });

  it('maps codes to supported languages', () => {
    expect(langOf('ro-RO')).toBe('ro');
    expect(langOf('ro')).toBe('ro');
    expect(langOf('en-GB')).toBe('en');
    expect(langOf('de-DE')).toBe('en');
    expect(LANGUAGE_OPTIONS.map((o) => o.code)).toEqual(['en-US', 'ro-RO']);
  });

  it('reads the fixture language header', () => {
    expect(fixtureLanguageCode('# Lecție\n# lang: ro-RO\n[00:00] Bună ziua.')).toBe('ro-RO');
    expect(fixtureLanguageCode('[00:00] Hello.')).toBe('en-US');
  });

  it('has Romanian interface text for every hint and error', () => {
    const ro = STRINGS.ro;
    expect(ro.start).toBe('Începe');
    expect(ro.htmlLang).toBe('ro');
    expect(Object.values(ro.micHints).every((h) => h.length > 20)).toBe(true);
    expect(Object.keys(ro.sttErrors).sort()).toEqual(Object.keys(STRINGS.en.sttErrors).sort());
    expect(ro.infoHtml).toContain('Cum funcționează Exlide');
  });
});
