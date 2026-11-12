import { describe, expect, it } from 'vitest';

import { buildMonthGrid } from '../../application';
import { plainDate, yearMonth, type CalendarEvent } from '../../domain';
import { CalendarFormatter } from '../calendar-formatter';
import { EventText } from '../event-text';
import { PL } from '../messages';
import { buildPosterContent } from './poster-content';

const NOW = { date: plainDate(2026, 11, 12), time: { hour: 12, minute: 0 } };
const formatter = new CalendarFormatter('pl-PL');
const deps = {
  formatter,
  text: new EventText(formatter, PL),
  weekStartsOn: 1,
  site: 'booster-ziomki.pl',
} as const;

const events: CalendarEvent[] = [
  {
    id: 'league',
    title: 'Pokémon League Challenge',
    date: plainDate(2026, 12, 4),
    startTime: { hour: 18, minute: 0 },
    endTime: { hour: 21, minute: 0 },
    url: 'https://calendar.example/',
    info: {
      game: { kind: 'known', id: 'pokemon' },
      shortTitle: 'League Challenge',
      fullFormat: 'Standard · Swiss',
    },
  },
  {
    id: 'open-day',
    title: 'Dzień otwarty',
    date: plainDate(2026, 12, 6),
    url: 'https://calendar.example/',
  },
  {
    id: 'january',
    title: 'Styczniowy',
    date: plainDate(2027, 1, 2),
    url: 'https://calendar.example/',
  },
];

const content = buildPosterContent(
  buildMonthGrid({ month: yearMonth(2026, 12), now: NOW, weekStartsOn: 1, events }),
  deps,
);
const day = (number: string) => content.weeks.flat().find((d) => d.number === number && !d.outside);

describe('buildPosterContent', () => {
  it('names the month, the year, the site and the weekdays', () => {
    expect(content.title).toBe('Grudzień');
    expect(content.year).toBe('2026');
    expect(content.site).toBe('booster-ziomki.pl');
    expect(content.weekdays).toEqual(['PON', 'WT', 'ŚR', 'CZW', 'PT', 'SOB', 'NIEDZ']);
    expect(content.weeks).toHaveLength(5);
  });

  it('describes a tournament like its tile on the calendar page', () => {
    const [event] = day('4')?.events ?? [];
    expect(event).toMatchObject({
      title: 'League Challenge',
      time: '18:00–21:00',
      format: 'Standard',
      logoBg: '#E3ECFD',
    });
    expect(event?.logo).toMatch(/pokemon/);
  });

  it('gives events without a game the generic logo and no format', () => {
    const [event] = day('6')?.events ?? [];
    expect(event?.title).toBe('Dzień otwarty');
    expect(event?.time).toBe('Cały dzień');
    expect(event?.format).toBeUndefined();
    expect(event?.logo).toMatch(/^data:image\/svg\+xml/);
  });

  it('keeps the neighbouring months free of events', () => {
    const outside = content.weeks.flat().filter((d) => d.outside);
    expect(outside.map((d) => d.number)).toEqual(['30', '1', '2', '3']);
    expect(outside.every((d) => d.events.length === 0)).toBe(true);
    expect(day('6')?.weekend).toBe(true);
  });

  it('omits the site when none is configured', () => {
    const view = buildMonthGrid({
      month: yearMonth(2026, 12),
      now: NOW,
      weekStartsOn: 1,
      events: [],
    });
    expect('site' in buildPosterContent(view, { ...deps, site: undefined })).toBe(false);
  });
});
