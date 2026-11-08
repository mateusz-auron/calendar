import { describe, expect, it } from 'vitest';
import { plainDate } from '../domain';
import { toCalendarEvent, type RawEvent } from './raw-event';

const options = { timeZone: 'Europe/Warsaw', fallbackUrl: 'https://fallback.example/' };
const map = (raw: Omit<RawEvent, 'id'>) => toCalendarEvent({ id: 'e', ...raw }, options);

/** Warsaw is UTC+1 in winter, UTC+2 in summer. */
const timed = (start: string, end?: string): Omit<RawEvent, 'id'> => ({
  start: { dateTime: start },
  ...(end ? { end: { dateTime: end } } : {}),
});

describe('toCalendarEvent – times', () => {
  it('keeps start and end times of a timed event', () => {
    const event = map(timed('2026-11-07T10:00:00Z', '2026-11-07T15:00:00Z'));
    expect(event).toMatchObject({
      date: plainDate(2026, 11, 7),
      startTime: { hour: 11, minute: 0 },
      endTime: { hour: 16, minute: 0 },
    });
    expect(event?.endDate).toBeUndefined();
  });

  it('shows an event ending at midnight as ending at 00:00 on the same day', () => {
    const event = map(timed('2026-11-07T19:00:00Z', '2026-11-07T23:00:00Z'));
    expect(event?.endTime).toEqual({ hour: 0, minute: 0 });
    expect(event?.endDate).toBeUndefined();
  });

  it('keeps a tournament running past midnight (until before 06:00) on its first day', () => {
    const event = map(timed('2026-11-07T17:00:00Z', '2026-11-08T00:00:00Z')); // 18:00–01:00
    expect(event?.date).toEqual(plainDate(2026, 11, 7));
    expect(event?.endTime).toEqual({ hour: 1, minute: 0 });
    expect(event?.endDate).toBeUndefined();
  });

  it('spans days when a timed event ends at or after 06:00 the next day', () => {
    const event = map(timed('2026-11-07T17:00:00Z', '2026-11-08T05:00:00Z')); // until 06:00
    expect(event?.endDate).toEqual(plainDate(2026, 11, 8));
  });

  it('spans days for a weekend event', () => {
    const event = map(timed('2026-12-11T17:00:00Z', '2026-12-13T15:00:00Z'));
    expect(event?.endDate).toEqual(plainDate(2026, 12, 13));
    expect(event?.endTime).toEqual({ hour: 16, minute: 0 });
  });

  it('omits the end time when there is no end or it is not after the start', () => {
    expect(map(timed('2026-11-07T10:00:00Z'))?.endTime).toBeUndefined();
    const same = map(timed('2026-11-07T10:00:00Z', '2026-11-07T10:00:00Z'));
    expect(same?.endTime).toBeUndefined();
    const reversed = map(timed('2026-11-07T10:00:00Z', '2026-11-07T09:00:00Z'));
    expect(reversed?.endTime).toBeUndefined();
    expect(reversed?.endDate).toBeUndefined();
  });

  it('uses the wall clock across daylight-saving changes', () => {
    // 2027-03-28: clocks go forward at 02:00. 2026-10-25: clocks go back at 03:00.
    expect(map(timed('2027-03-28T09:00:00Z', '2027-03-28T14:00:00Z'))).toMatchObject({
      startTime: { hour: 11, minute: 0 },
      endTime: { hour: 16, minute: 0 },
    });
    expect(map(timed('2026-10-25T10:00:00Z', '2026-10-25T15:00:00Z'))).toMatchObject({
      startTime: { hour: 11, minute: 0 },
      endTime: { hour: 16, minute: 0 },
    });
  });

  it('has no times for all-day events and treats the end date as exclusive', () => {
    const event = map({ start: { date: '2026-12-11' }, end: { date: '2026-12-14' } });
    expect(event?.startTime).toBeUndefined();
    expect(event?.endTime).toBeUndefined();
    expect(event?.endDate).toEqual(plainDate(2026, 12, 13));
  });
});

describe('toCalendarEvent – content', () => {
  it('parses the description into info and notes', () => {
    const event = map({
      start: { date: '2026-11-07' },
      title: '  League Challenge ',
      description: 'game: Pokemon<br>price: 20<br><br>Przynieś koszulki',
      location: ' Sklep,\n ul. Długa 1 ',
    });
    expect(event).toMatchObject({
      title: 'League Challenge',
      location: 'Sklep, ul. Długa 1',
      info: { game: { kind: 'known', id: 'pokemon' }, price: { kind: 'amount', grosze: 2000 } },
      notes: 'Przynieś koszulki',
    });
  });

  it('omits info, notes and location when there are none', () => {
    const event = map({ start: { date: '2026-11-07' }, location: '  ' });
    expect(event).toEqual({
      id: 'e',
      title: '',
      date: plainDate(2026, 11, 7),
      url: 'https://fallback.example/',
    });
  });

  it('skips events the organiser hid with "visible: nie"', () => {
    expect(
      map({ start: { date: '2026-11-07' }, description: 'game: Pokemon<br>visible: nie' }),
    ).toBeUndefined();
    expect(map({ start: { date: '2026-11-07' }, description: 'visible: tak' })).toMatchObject({
      info: { visible: true },
    });
    expect(map({ start: { date: '2026-11-07' }, description: 'visible: może' })).toBeDefined();
  });

  it('skips cancelled events', () => {
    expect(map({ status: 'CANCELLED', start: { date: '2026-11-07' } })).toBeUndefined();
  });
});
