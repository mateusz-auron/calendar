import { describe, expect, it } from 'vitest';
import { yearMonth } from '../domain';
import { DEFAULT_CONFIG, parseConfig } from './app-config';

describe('parseConfig', () => {
  it('falls back to defaults', () => {
    expect(parseConfig('')).toEqual(DEFAULT_CONFIG);
  });

  it('reads supported query parameters', () => {
    const config = parseConfig(
      '?month=2026-03&lang=pl-PL&weekStart=0&tz=Europe/Warsaw&parentOrigin=https://example.com/path',
    );
    expect(config).toMatchObject({
      initialMonth: yearMonth(2026, 3),
      locale: 'pl-PL',
      weekStartsOn: 0,
      timeZone: 'Europe/Warsaw',
      parentOrigin: 'https://example.com',
    });
  });

  it('ignores invalid values', () => {
    const config = parseConfig('?month=nope&lang=!!&weekStart=9&tz=Mars/Base&parentOrigin=::');
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('reads the mode (details layer for embed.js)', () => {
    expect(parseConfig('').mode).toBe('calendar');
    expect(parseConfig('?mode=details').mode).toBe('details');
    expect(parseConfig('?mode=other').mode).toBe('calendar');
  });

  it('reads the initial game filter', () => {
    expect(parseConfig('?game=Pokemon').initialFilter).toBe('pokemon');
    expect(parseConfig('?game=other').initialFilter).toBe('other');
    expect(parseConfig('?game=magic').initialFilter).toBe('all');
  });

  it('reads the default seats and location from the build', () => {
    expect(parseConfig('', { defaultSeats: '16', defaultLocation: ' Sklep ' })).toMatchObject({
      defaultSeats: 16,
      defaultLocation: 'Sklep',
    });
    for (const bad of ['', '0', '1000', '2.5', 'x']) {
      expect(parseConfig('', { defaultSeats: bad }).defaultSeats).toBe(12);
    }
    expect(parseConfig('', { defaultLocation: '  ' }).defaultLocation).toBeUndefined();
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

  describe('event sources', () => {
    const google = { calendarId: 'cal@x', apiKey: 'k' };

    it('uses demo data when nothing is configured', () => {
      expect(parseConfig('').eventSources).toEqual(['demo']);
    });

    it('auto-selects configured sources, live API first with iCal as fallback', () => {
      expect(parseConfig('', { icalSnapshot: true }).eventSources).toEqual(['ical']);
      expect(parseConfig('', google).eventSources).toEqual(['google-api']);
      expect(parseConfig('', { ...google, icalSnapshot: true }).eventSources).toEqual([
        'google-api',
        'ical',
      ]);
    });

    it('can be forced to a single source', () => {
      const both = { ...google, icalSnapshot: true };
      expect(parseConfig('', { ...both, eventSource: 'ical' }).eventSources).toEqual(['ical']);
      expect(parseConfig('', { ...both, eventSource: 'google-api' }).eventSources).toEqual([
        'google-api',
      ]);
      expect(parseConfig('', { ...both, eventSource: 'demo' }).eventSources).toEqual(['demo']);
    });

    it('falls back to demo when a forced source is not configured', () => {
      expect(parseConfig('', { eventSource: 'ical' }).eventSources).toEqual(['demo']);
    });
  });
});
