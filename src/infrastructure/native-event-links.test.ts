import { describe, expect, it } from 'vitest';
import { plainDate, type CalendarEntry, type EventLinks } from '../domain';
import { NativeEventLinks } from './native-event-links';

const calendar: EventLinks = {
  addToCalendarUrl: ({ title }) => `https://calendar.example/?text=${title}`,
  directionsUrl: () => 'https://maps.example/',
};
const entry: CalendarEntry = {
  event: { id: 'e1', title: 'T', date: plainDate(2026, 11, 7), url: 'u' },
  title: 'League',
};

describe('NativeEventLinks', () => {
  it.each(['ios', 'android'] as const)('keeps the Google Calendar link on %s', (platform) => {
    expect(new NativeEventLinks(platform, calendar).addToCalendarUrl(entry)).toBe(
      'https://calendar.example/?text=League',
    );
  });

  it('opens Apple Maps with directions on iOS', () => {
    expect(new NativeEventLinks('ios', calendar).directionsUrl('Sklep, ul. Długa 1 & 2')).toBe(
      'https://maps.apple.com/?daddr=Sklep%2C%20ul.%20D%C5%82uga%201%20%26%202',
    );
  });

  it('opens the maps app with a geo: link on Android', () => {
    expect(new NativeEventLinks('android', calendar).directionsUrl('Sklep, ul. Długa 1')).toBe(
      'geo:0,0?q=Sklep%2C%20ul.%20D%C5%82uga%201',
    );
  });
});
