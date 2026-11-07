import { describe, expect, it, vi } from 'vitest';
import { dateRange, plainDate, type EventRepository } from '../domain';
import { CachingEventRepository } from './caching-event-repository';

const range = (day: number) => dateRange(plainDate(2026, 11, day), plainDate(2026, 11, day));

describe('CachingEventRepository', () => {
  it('reuses results for the same range', async () => {
    const findInRange = vi.fn<EventRepository['findInRange']>(() => Promise.resolve([]));
    const repo = new CachingEventRepository({ findInRange });
    await repo.findInRange(range(1));
    await repo.findInRange(range(1));
    await repo.findInRange(range(2));
    expect(findInRange).toHaveBeenCalledTimes(2);
  });

  it('evicts failures so the next call retries', async () => {
    const findInRange = vi
      .fn<EventRepository['findInRange']>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([]);
    const repo = new CachingEventRepository({ findInRange });
    await expect(repo.findInRange(range(1))).rejects.toThrow('boom');
    await expect(repo.findInRange(range(1))).resolves.toEqual([]);
    expect(findInRange).toHaveBeenCalledTimes(2);
  });

  it('bounds its size', async () => {
    const findInRange = vi.fn<EventRepository['findInRange']>(() => Promise.resolve([]));
    const repo = new CachingEventRepository({ findInRange }, 2);
    for (const day of [1, 2, 3, 1]) await repo.findInRange(range(day));
    expect(findInRange).toHaveBeenCalledTimes(4); // day 1 was evicted
  });
});
