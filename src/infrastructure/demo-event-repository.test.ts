import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  dateRange,
  daysInMonth,
  firstDayOf,
  plainDate,
  yearMonth,
  type YearMonth,
} from '../domain';
import { DemoEventRepository } from './demo-event-repository';

const monthRange = (m: YearMonth) =>
  dateRange(firstDayOf(m), addDays(firstDayOf(addMonths(m, 1)), -1));

describe('DemoEventRepository', () => {
  const repo = new DemoEventRepository({ eventUrl: 'https://www.google.com/' });

  it('returns exactly one event per month, inside that month', async () => {
    let month = yearMonth(2025, 1);
    for (let i = 0; i < 36; i++, month = addMonths(month, 1)) {
      const events = await repo.findInRange(monthRange(month));
      expect(events).toHaveLength(1);
      const [e] = events;
      expect(e?.date.year).toBe(month.year);
      expect(e?.date.month).toBe(month.month);
      expect(e?.date.day).toBeGreaterThanOrEqual(1);
      expect(e?.date.day).toBeLessThanOrEqual(daysInMonth(month));
      expect(e?.url).toBe('https://www.google.com/');
    }
  });

  it('returns one event per month across a multi-month range', async () => {
    const events = await repo.findInRange(
      dateRange(plainDate(2026, 1, 1), plainDate(2026, 12, 31)),
    );
    expect(events.map((e) => e.date.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('is deterministic for the same seed', async () => {
    const other = new DemoEventRepository({ eventUrl: 'x' });
    const range = monthRange(yearMonth(2026, 5));
    expect((await repo.findInRange(range))[0]?.date).toEqual(
      (await other.findInRange(range))[0]?.date,
    );
  });

  it('spreads events over different days', async () => {
    const events = await repo.findInRange(
      dateRange(plainDate(2026, 1, 1), plainDate(2026, 12, 31)),
    );
    expect(new Set(events.map((e) => e.date.day)).size).toBeGreaterThan(3);
  });
});
