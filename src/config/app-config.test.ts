import { describe, expect, it } from 'vitest';
import { yearMonth } from '../domain';
import { DEFAULT_CONFIG, parseConfig } from './app-config';

describe('parseConfig', () => {
  it('falls back to defaults', () => {
    expect(parseConfig('')).toEqual(DEFAULT_CONFIG);
  });

  it('reads supported query parameters', () => {
    const config = parseConfig(
      '?month=2026-03&lang=pl-PL&weekStart=0&theme=dark&tz=Europe/Warsaw&parentOrigin=https://example.com/path',
    );
    expect(config).toMatchObject({
      initialMonth: yearMonth(2026, 3),
      locale: 'pl-PL',
      weekStartsOn: 0,
      theme: 'dark',
      timeZone: 'Europe/Warsaw',
      parentOrigin: 'https://example.com',
    });
  });

  it('ignores invalid values', () => {
    const config = parseConfig(
      '?month=nope&lang=!!&weekStart=9&theme=neon&tz=Mars/Base&parentOrigin=::',
    );
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('uses browser/build defaults when no parameter overrides them', () => {
    const config = parseConfig('', { locale: 'de-DE', timeZone: 'America/New_York' });
    expect(config.locale).toBe('de-DE');
    expect(config.timeZone).toBe('America/New_York');
  });

  describe('Google Calendar source', () => {
    it('is enabled only when both calendar id and api key are present', () => {
      expect(parseConfig('', { calendarId: 'cal@x' }).google).toBeUndefined();
      expect(parseConfig('', { apiKey: 'k' }).google).toBeUndefined();
      expect(parseConfig('', { calendarId: ' cal@x ', apiKey: 'k' }).google).toEqual({
        calendarId: 'cal@x',
        apiKey: 'k',
      });
    });

    it('lets the iframe URL choose the calendar but never the key', () => {
      const config = parseConfig('?calendar=other@x&key=evil', {
        calendarId: 'cal@x',
        apiKey: 'k',
      });
      expect(config.google).toEqual({ calendarId: 'other@x', apiKey: 'k' });
    });
  });
});
