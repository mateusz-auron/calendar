import { describe, expect, it } from 'vitest';
import { plainDate, type CalendarEvent } from '../domain';
import { GoogleEventLinks } from './google-event-links';

const links = new GoogleEventLinks('Europe/Warsaw');
const base: CalendarEvent = { id: 'e', title: 'T', date: plainDate(2026, 11, 7), url: 'u' };
const dates = (event: Partial<CalendarEvent>) =>
  new URL(links.addToCalendar({ event: { ...base, ...event }, title: 'T' }).href).searchParams.get(
    'dates',
  );

describe('GoogleEventLinks.addToCalendar', () => {
  it('builds a template link with title, wall-clock times, zone, details and location', () => {
    const url = new URL(
      links.addToCalendar({
        event: { ...base, startTime: { hour: 11, minute: 0 }, endTime: { hour: 16, minute: 0 } },
        title: 'League Challenge & więcej',
        location: 'Sklep, ul. Długa 1',
        details: 'Format: Standard',
      }).href,
    );
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      action: 'TEMPLATE',
      text: 'League Challenge & więcej',
      dates: '20261107T110000/20261107T160000',
      ctz: 'Europe/Warsaw',
      details: 'Format: Standard',
      location: 'Sklep, ul. Długa 1',
    });
  });

  it.each([
    ['all-day', {}, '20261107/20261108'],
    ['multi-day all-day', { endDate: plainDate(2026, 11, 9) }, '20261107/20261110'],
    [
      'until midnight',
      { startTime: { hour: 20, minute: 0 }, endTime: { hour: 0, minute: 0 } },
      '20261107T200000/20261108T000000',
    ],
    [
      'overnight',
      { startTime: { hour: 18, minute: 0 }, endTime: { hour: 1, minute: 0 } },
      '20261107T180000/20261108T010000',
    ],
    [
      'multi-day timed',
      {
        startTime: { hour: 17, minute: 0 },
        endTime: { hour: 16, minute: 0 },
        endDate: plainDate(2026, 11, 8),
      },
      '20261107T170000/20261108T160000',
    ],
    ['no end', { startTime: { hour: 23, minute: 30 } }, '20261107T233000/20261108T003000'],
  ])('%s', (_, event, expected) => {
    expect(dates(event)).toBe(expected);
  });

  it('has no time zone for all-day events', () => {
    expect(
      new URL(links.addToCalendar({ event: base, title: 'T' }).href).searchParams.has('ctz'),
    ).toBe(false);
  });
});

describe('GoogleEventLinks.directions', () => {
  it('encodes the destination', () => {
    expect(links.directions('Sklep, ul. Długa 1 & 2').href).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Sklep%2C+ul.+D%C5%82uga+1+%26+2',
    );
  });
});
