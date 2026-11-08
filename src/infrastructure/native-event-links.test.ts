import { describe, expect, it } from 'vitest';
import { plainDate, type CalendarEntry } from '../domain';
import { NativeEventLinks } from './native-event-links';

const now = () => new Date('2026-11-01T12:00:00Z');
const entry: CalendarEntry = {
  event: {
    id: 'e1',
    title: 'T',
    date: plainDate(2026, 11, 7),
    startTime: { hour: 11, minute: 0 },
    url: 'u',
  },
  title: 'League Challenge',
  location: 'Sklep, ul. Długa 1',
};
const ics = (href: string) => decodeURIComponent(href.slice(href.indexOf(',') + 1));

describe('NativeEventLinks on iOS', () => {
  const links = new NativeEventLinks('ios', 'Europe/Warsaw', now);

  it('opens the event as a calendar file, which Safari hands to the Calendar app', () => {
    const link = links.addToCalendar(entry);
    expect(link.href.startsWith('data:text/calendar;charset=utf-8,')).toBe(true);
    expect(link.download).toBeUndefined();
    expect(ics(link.href)).toContain('SUMMARY:League Challenge');
    expect(ics(link.href)).toContain('DTSTART:20261107T100000Z');
  });

  it('opens Apple Maps with directions', () => {
    expect(links.directions('Sklep, ul. Długa 1 & 2').href).toBe(
      'https://maps.apple.com/?daddr=Sklep%2C%20ul.%20D%C5%82uga%201%20%26%202',
    );
  });
});

describe('NativeEventLinks on Android', () => {
  const links = new NativeEventLinks('android', 'Europe/Warsaw', now);

  it('downloads the event as a calendar file, which opens in the calendar app', () => {
    const link = links.addToCalendar(entry);
    expect(link.download).toBe('wydarzenie.ics');
    expect(ics(link.href)).toContain('LOCATION:Sklep\\, ul. Długa 1');
  });

  it('opens the maps app with a geo: link', () => {
    expect(links.directions('Sklep, ul. Długa 1').href).toBe(
      'geo:0,0?q=Sklep%2C%20ul.%20D%C5%82uga%201',
    );
  });
});
