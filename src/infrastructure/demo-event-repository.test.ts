import { describe, expect, it } from 'vitest';
import { addMonths, daysInMonth, yearMonth } from '../domain';
import { DemoEventRepository } from './demo-event-repository';

describe('DemoEventRepository', () => {
  const repo = new DemoEventRepository({ eventUrl: 'https://www.google.com/' });

  it('returns exactly one event per month, inside that month', async () => {
    let month = yearMonth(2025, 1);
    for (let i = 0; i < 36; i++, month = addMonths(month, 1)) {
      const events = await repo.findByMonth(month);
      expect(events).toHaveLength(1);
      const [e] = events;
      expect(e?.date.year).toBe(month.year);
      expect(e?.date.month).toBe(month.month);
      expect(e?.date.day).toBeGreaterThanOrEqual(1);
      expect(e?.date.day).toBeLessThanOrEqual(daysInMonth(month));
      expect(e?.url).toBe('https://www.google.com/');
    }
  });

  it('is deterministic for the same seed', async () => {
    const other = new DemoEventRepository({ eventUrl: 'x' });
    expect((await repo.findByMonth(yearMonth(2026, 5)))[0]?.date).toEqual(
      (await other.findByMonth(yearMonth(2026, 5)))[0]?.date,
    );
  });

  it('spreads events over different days', async () => {
    const days = new Set<number>();
    for (let m = 1; m <= 12; m++) {
      days.add((await repo.findByMonth(yearMonth(2026, m)))[0]?.date.day ?? 0);
    }
    expect(days.size).toBeGreaterThan(3);
  });
});
