import { describe, expect, it } from 'vitest';
import { plainDate, yearMonth, type CalendarEvent } from '../domain';
import { buildMonthGrid } from './month-grid';

const event = (id: string, date = plainDate(2026, 11, 15)): CalendarEvent => ({
  id,
  title: id,
  date,
  url: 'https://example.com',
});

describe('buildMonthGrid', () => {
  const base = { month: yearMonth(2026, 11), today: plainDate(2026, 11, 7), events: [] };

  it('always returns a 6x7 grid', () => {
    const view = buildMonthGrid({ ...base, weekStartsOn: 1 });
    expect(view.weeks).toHaveLength(6);
    expect(view.weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('starts the grid on the configured weekday', () => {
    // 1 Nov 2026 is a Sunday.
    const monday = buildMonthGrid({ ...base, weekStartsOn: 1 });
    expect(monday.weeks[0]?.[0]?.date).toEqual(plainDate(2026, 10, 26));
    const sunday = buildMonthGrid({ ...base, weekStartsOn: 0 });
    expect(sunday.weeks[0]?.[0]?.date).toEqual(plainDate(2026, 11, 1));
  });

  it('flags today and days outside the month', () => {
    const cells = buildMonthGrid({ ...base, weekStartsOn: 1 }).weeks.flat();
    expect(cells.filter((c) => c.isToday).map((c) => c.date)).toEqual([plainDate(2026, 11, 7)]);
    expect(cells[0]?.isCurrentMonth).toBe(false);
  });

  it('attaches events to their day', () => {
    const cells = buildMonthGrid({
      ...base,
      weekStartsOn: 1,
      events: [event('a'), event('b'), event('c', plainDate(2026, 11, 20))],
    }).weeks.flat();
    const day15 = cells.find((c) => c.isCurrentMonth && c.date.day === 15);
    expect(day15?.events.map((e) => e.id)).toEqual(['a', 'b']);
  });
});
