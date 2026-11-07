import { describe, expect, it } from 'vitest';
import { dateRange, plainDate, yearMonth, type CalendarEvent } from '../domain';
import { buildMonthGrid, gridRange } from './month-grid';

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

describe('buildMonthGrid – multi-day and ordering', () => {
  const base = {
    month: yearMonth(2026, 11),
    today: plainDate(2026, 11, 7),
    weekStartsOn: 1 as const,
  };

  it('shows a multi-day event on every day it spans, clamped to the grid', () => {
    const cells = buildMonthGrid({
      ...base,
      events: [{ ...event('trip', plainDate(2026, 10, 20)), endDate: plainDate(2026, 10, 27) }],
    }).weeks.flat();
    const withTrip = cells.filter((c) => c.events.some((e) => e.id === 'trip'));
    expect(withTrip.map((c) => c.date)).toEqual([plainDate(2026, 10, 26), plainDate(2026, 10, 27)]);
  });

  it('orders all-day events before timed ones, timed ones by start', () => {
    const day = plainDate(2026, 11, 15);
    const cells = buildMonthGrid({
      ...base,
      events: [
        { ...event('late', day), startTime: { hour: 18, minute: 0 } },
        { ...event('early', day), startTime: { hour: 9, minute: 30 } },
        event('allday', day),
      ],
    }).weeks.flat();
    const ids = cells.find((c) => c.isCurrentMonth && c.date.day === 15)?.events.map((e) => e.id);
    expect(ids).toEqual(['allday', 'early', 'late']);
  });
});

describe('gridRange', () => {
  it('covers 42 days starting on the configured weekday', () => {
    expect(gridRange(yearMonth(2026, 11), 0)).toEqual(
      dateRange(plainDate(2026, 11, 1), plainDate(2026, 12, 12)),
    );
  });
});
