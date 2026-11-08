import { describe, expect, it } from 'vitest';
import { plainDate, type CalendarEvent } from '../domain';
import { toIcs } from './ics';

const base: CalendarEvent = { id: 'e1', title: 'T', date: plainDate(2026, 11, 7), url: 'u' };
const now = new Date('2026-11-01T12:00:00Z');
const lines = (ics: string) => ics.split('\r\n');

describe('toIcs', () => {
  it('describes a timed event in UTC, with escaped text', () => {
    const ics = toIcs(
      {
        event: { ...base, startTime: { hour: 11, minute: 0 }, endTime: { hour: 16, minute: 0 } },
        title: 'League Challenge; Pokémon, TCG',
        location: 'Sklep, ul. Długa 1',
        details: 'Format: Standard\nhttps://register.example',
      },
      'Europe/Warsaw',
      now,
    );
    expect(lines(ics)).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//tournament-calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:e1@tournament-calendar',
      'DTSTAMP:20261101T120000Z',
      'DTSTART:20261107T100000Z',
      'DTEND:20261107T150000Z',
      'SUMMARY:League Challenge\\; Pokémon\\, TCG',
      'LOCATION:Sklep\\, ul. Długa 1',
      'DESCRIPTION:Format: Standard\\nhttps://register.example',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ]);
  });

  it('uses the summer offset in summer', () => {
    const ics = toIcs(
      {
        event: { ...base, date: plainDate(2026, 7, 4), startTime: { hour: 11, minute: 0 } },
        title: 'T',
      },
      'Europe/Warsaw',
      now,
    );
    expect(lines(ics)).toContain('DTSTART:20260704T090000Z');
    expect(lines(ics)).toContain('DTEND:20260704T100000Z');
  });

  it('describes an all-day event with dates and an exclusive end', () => {
    const ics = lines(
      toIcs(
        { event: { ...base, endDate: plainDate(2026, 11, 8) }, title: 'T' },
        'Europe/Warsaw',
        now,
      ),
    );
    expect(ics).toContain('DTSTART;VALUE=DATE:20261107');
    expect(ics).toContain('DTEND;VALUE=DATE:20261109');
    expect(ics.some((l) => l.startsWith('LOCATION'))).toBe(false);
  });

  it('folds long lines at 75 octets without splitting characters', () => {
    const ics = toIcs({ event: base, title: 'ż'.repeat(100) }, 'UTC', now);
    const summary = ics.slice(ics.indexOf('SUMMARY:'), ics.indexOf('\r\nEND:VEVENT'));
    const parts = summary.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(parts.slice(1).every((p) => p.startsWith(' '))).toBe(true);
    expect(summary.replace(/\r\n /g, '')).toBe(`SUMMARY:${'ż'.repeat(100)}`);
  });
});
