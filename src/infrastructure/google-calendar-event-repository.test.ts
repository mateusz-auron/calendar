import { describe, expect, it, vi } from 'vitest';
import { dateRange, plainDate } from '../domain';
import {
  EventSourceError,
  GoogleCalendarEventRepository,
  type FetchFn,
} from './google-calendar-event-repository';

const NOV = dateRange(plainDate(2026, 10, 26), plainDate(2026, 12, 6));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function repoWith(fetch: FetchFn, timeZone = 'Europe/Warsaw') {
  return new GoogleCalendarEventRepository({
    calendarId: 'team@group.calendar.google.com',
    apiKey: 'test-key',
    timeZone,
    fallbackUrl: 'https://fallback.example/',
    fetch,
  });
}

describe('GoogleCalendarEventRepository', () => {
  it('requests the padded range with expanded recurrences and an encoded calendar id', async () => {
    const fetch = vi.fn<FetchFn>(() => Promise.resolve(json({ items: [] })));
    await repoWith(fetch).findInRange(NOV);

    const url = new URL(fetch.mock.calls[0]?.[0] ?? '');
    expect(url.pathname).toBe('/calendar/v3/calendars/team%40group.calendar.google.com/events');
    expect(url.searchParams.get('key')).toBe('test-key');
    expect(url.searchParams.get('singleEvents')).toBe('true');
    expect(url.searchParams.get('timeMin')).toBe('2026-10-25T00:00:00Z');
    expect(url.searchParams.get('timeMax')).toBe('2026-12-08T00:00:00Z');
  });

  it('maps all-day, multi-day and timed events', async () => {
    const fetch: FetchFn = () =>
      Promise.resolve(
        json({
          items: [
            {
              id: 'a',
              summary: 'All day',
              htmlLink: 'https://www.google.com/calendar/event?eid=a',
              start: { date: '2026-11-10' },
              end: { date: '2026-11-11' },
            },
            {
              id: 'b',
              summary: 'Trip',
              start: { date: '2026-11-12' },
              end: { date: '2026-11-15' },
            },
            {
              id: 'c',
              summary: 'Standup',
              description: '<b>Daily</b> sync &amp; plan',
              start: { dateTime: '2026-11-20T08:30:00Z' },
              end: { dateTime: '2026-11-20T09:00:00Z' },
            },
            {
              id: 'd',
              summary: 'Late show',
              start: { dateTime: '2026-11-21T22:00:00Z' }, // 23:00 Warsaw
              end: { dateTime: '2026-11-21T23:00:00Z' }, // ends exactly at 00:00 Warsaw
            },
          ],
        }),
      );

    const events = await repoWith(fetch).findInRange(NOV);

    expect(events).toEqual([
      {
        id: 'a',
        title: 'All day',
        date: plainDate(2026, 11, 10),
        url: 'https://www.google.com/calendar/event?eid=a',
      },
      {
        id: 'b',
        title: 'Trip',
        date: plainDate(2026, 11, 12),
        endDate: plainDate(2026, 11, 14),
        url: 'https://fallback.example/',
      },
      {
        id: 'c',
        title: 'Standup',
        date: plainDate(2026, 11, 20),
        startTime: { hour: 9, minute: 30 },
        url: 'https://fallback.example/',
        description: 'Daily sync & plan',
      },
      {
        id: 'd',
        title: 'Late show',
        date: plainDate(2026, 11, 21),
        startTime: { hour: 23, minute: 0 },
        url: 'https://fallback.example/',
      },
    ]);
  });

  it('skips cancelled, malformed and out-of-range events and unsafe links', async () => {
    const fetch: FetchFn = () =>
      Promise.resolve(
        json({
          items: [
            { id: 'x', status: 'cancelled', start: { date: '2026-11-10' } },
            { summary: 'no id', start: { date: '2026-11-10' } },
            { id: 'y', start: { date: 'not-a-date' } },
            { id: 'z', start: { date: '2026-12-07' }, end: { date: '2026-12-08' } },
            {
              id: 'js',
              htmlLink: 'javascript:alert(1)',
              start: { date: '2026-11-10' },
              end: { date: '2026-11-11' },
            },
          ],
        }),
      );

    const events = await repoWith(fetch).findInRange(NOV);
    expect(events.map((e) => [e.id, e.title, e.url])).toEqual([
      ['js', '(No title)', 'https://fallback.example/'],
    ]);
  });

  it('follows nextPageToken', async () => {
    const fetch = vi
      .fn<FetchFn>()
      .mockResolvedValueOnce(
        json({ items: [{ id: '1', start: { date: '2026-11-01' } }], nextPageToken: 'p2' }),
      )
      .mockResolvedValueOnce(json({ items: [{ id: '2', start: { date: '2026-11-02' } }] }));

    const events = await repoWith(fetch).findInRange(NOV);
    expect(events.map((e) => e.id)).toEqual(['1', '2']);
    expect(new URL(fetch.mock.calls[1]?.[0] ?? '').searchParams.get('pageToken')).toBe('p2');
  });

  it('turns HTTP and network failures into EventSourceError', async () => {
    const notFound: FetchFn = () =>
      Promise.resolve(json({ error: { code: 404, message: 'Not Found' } }, 404));
    await expect(repoWith(notFound).findInRange(NOV)).rejects.toMatchObject({
      name: 'EventSourceError',
      status: 404,
      message: 'Calendar not found or not public. Not Found',
    });

    const offline: FetchFn = () => Promise.reject(new TypeError('Failed to fetch'));
    await expect(repoWith(offline).findInRange(NOV)).rejects.toBeInstanceOf(EventSourceError);
  });
});
