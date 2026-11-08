import { describe, expect, it, vi } from 'vitest';
import { dateRange, plainDate } from '../domain';
import type { FetchFn } from './google-calendar-event-repository';
import { SnapshotEventRepository } from './snapshot-event-repository';

const NOV = dateRange(plainDate(2026, 10, 26), plainDate(2026, 12, 6));

const snapshot = {
  version: 1,
  source: 'ical',
  generatedAt: '2026-11-08T10:00:00.000Z',
  range: { start: '2025-11-01', end: '2028-10-31' },
  events: [
    {
      id: 'a',
      title: 'Workshop',
      start: { dateTime: '2026-11-12T08:00:00.000Z' },
      end: { dateTime: '2026-11-12T10:00:00.000Z' },
      url: 'https://www.google.com/calendar/event?eid=abc',
    },
    { id: 'b', title: 'Fair', start: { date: '2026-11-30' }, end: { date: '2026-12-03' } },
    { id: 'old', title: 'Old', start: { date: '2025-12-01' }, end: { date: '2025-12-02' } },
    { id: 'bad', start: { date: 'nope' } },
    { title: 'no id', start: { date: '2026-11-01' } },
  ],
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function repoWith(fetch: FetchFn) {
  return new SnapshotEventRepository({
    url: './events.json',
    timeZone: 'Europe/Warsaw',
    fallbackUrl: 'https://fallback.example/',
    fetch,
  });
}

describe('SnapshotEventRepository', () => {
  it('maps snapshot events and filters them to the range', async () => {
    const repo = repoWith(() => Promise.resolve(json(snapshot)));
    const events = await repo.findInRange(NOV);
    expect(events).toEqual([
      {
        id: 'a',
        title: 'Workshop',
        date: plainDate(2026, 11, 12),
        startTime: { hour: 9, minute: 0 },
        endTime: { hour: 11, minute: 0 },
        url: 'https://www.google.com/calendar/event?eid=abc',
      },
      {
        id: 'b',
        title: 'Fair',
        date: plainDate(2026, 11, 30),
        endDate: plainDate(2026, 12, 2),
        url: 'https://fallback.example/',
      },
    ]);
  });

  it('downloads the file once and revalidates with the server', async () => {
    const fetch = vi.fn<FetchFn>(() => Promise.resolve(json(snapshot)));
    const repo = repoWith(fetch);
    await repo.findInRange(NOV);
    await repo.findInRange(dateRange(plainDate(2026, 12, 1), plainDate(2027, 1, 10)));
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[1]?.cache).toBe('no-cache');
  });

  it('reports a missing or corrupt file and allows retry', async () => {
    const fetch = vi
      .fn<FetchFn>()
      .mockResolvedValueOnce(json({}, 404))
      .mockResolvedValueOnce(json({ version: 99 }))
      .mockResolvedValueOnce(json(snapshot));
    const repo = repoWith(fetch);
    await expect(repo.findInRange(NOV)).rejects.toThrow('No synced events yet');
    await expect(repo.findInRange(NOV)).rejects.toThrow('Unsupported or corrupt');
    await expect(repo.findInRange(NOV)).resolves.toHaveLength(2);
  });
});
