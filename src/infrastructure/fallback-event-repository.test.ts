import { describe, expect, it, vi } from 'vitest';
import { dateRange, plainDate, type CalendarEvent, type EventRepository } from '../domain';
import { FallbackEventRepository } from './fallback-event-repository';

const RANGE = dateRange(plainDate(2026, 11, 1), plainDate(2026, 11, 30));
const event = (id: string): CalendarEvent => ({
  id,
  title: id,
  date: plainDate(2026, 11, 5),
  url: 'https://x/',
});
const ok = (id: string): EventRepository => ({
  findInRange: () => Promise.resolve([event(id)]),
});
const failing = (message: string): EventRepository => ({
  findInRange: () => Promise.reject(new Error(message)),
});

describe('FallbackEventRepository', () => {
  it('uses the primary source when it works', async () => {
    const secondary = { findInRange: vi.fn<EventRepository['findInRange']>() };
    const repo = new FallbackEventRepository(ok('primary'), secondary);
    expect((await repo.findInRange(RANGE)).map((e) => e.id)).toEqual(['primary']);
    expect(secondary.findInRange).not.toHaveBeenCalled();
  });

  it('falls back to the secondary source and reports why', async () => {
    const onFallback = vi.fn();
    const repo = new FallbackEventRepository(failing('api down'), ok('snapshot'), onFallback);
    expect((await repo.findInRange(RANGE)).map((e) => e.id)).toEqual(['snapshot']);
    expect(onFallback).toHaveBeenCalledWith(new Error('api down'));
  });

  it("surfaces the primary's error when both fail", async () => {
    const repo = new FallbackEventRepository(failing('api down'), failing('no file'));
    await expect(repo.findInRange(RANGE)).rejects.toThrow('api down');
  });
});
