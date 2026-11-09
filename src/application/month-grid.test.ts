import { describe, expect, it } from 'vitest';
import { dateRange, plainDate, yearMonth, type CalendarEvent, type GameId } from '../domain';
import { buildMonthGrid, gridRange } from './month-grid';

const event = (id: string, date = plainDate(2026, 11, 15), game?: GameId): CalendarEvent => ({
  id,
  title: id,
  date,
  url: 'https://example.com',
  ...(game ? { info: { game: { kind: 'known', id: game } } } : {}),
});

const days = (view: ReturnType<typeof buildMonthGrid>) => view.weeks.flatMap((w) => w.days);

describe('buildMonthGrid', () => {
  const base = {
    month: yearMonth(2026, 11),
    now: { date: plainDate(2026, 11, 7), time: { hour: 12, minute: 0 } },
    weekStartsOn: 1 as const,
    events: [],
  };

  it('keeps only weeks that contain a day of the month (4–6 rows)', () => {
    expect(buildMonthGrid(base).weeks).toHaveLength(6); // Nov 2026 starts on a Sunday
    expect(buildMonthGrid({ ...base, month: yearMonth(2026, 12) }).weeks).toHaveLength(5);
    expect(buildMonthGrid({ ...base, month: yearMonth(2027, 2) }).weeks).toHaveLength(4);
    expect(buildMonthGrid(base).weeks.every((w) => w.days.length === 7)).toBe(true);
  });

  it('starts the grid on the configured weekday', () => {
    // 1 Nov 2026 is a Sunday.
    expect(buildMonthGrid(base).weeks[0]?.days[0]?.date).toEqual(plainDate(2026, 10, 26));
    const sunday = buildMonthGrid({ ...base, weekStartsOn: 0 });
    expect(sunday.weeks[0]?.days[0]?.date).toEqual(plainDate(2026, 11, 1));
  });

  it('flags today, past days, weekends and days outside the month', () => {
    const cells = days(buildMonthGrid(base));
    expect(cells.filter((c) => c.isToday).map((c) => c.date)).toEqual([plainDate(2026, 11, 7)]);
    expect(cells[0]?.isCurrentMonth).toBe(false);
    expect(cells.find((c) => c.date.day === 6 && c.isCurrentMonth)?.isPast).toBe(true);
    expect(cells.find((c) => c.date.day === 7 && c.isCurrentMonth)?.isPast).toBe(false);
    expect(cells.slice(0, 7).map((c) => c.isWeekend)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      true,
    ]);
  });

  it('attaches event cards to their day and marks weeks without events as compact', () => {
    const view = buildMonthGrid({
      ...base,
      events: [event('a'), event('b'), event('c', plainDate(2026, 11, 20))],
    });
    const day15 = days(view).find((c) => c.isCurrentMonth && c.date.day === 15);
    expect(day15?.events.map((e) => e.event.id)).toEqual(['a', 'b']);
    expect(view.weeks.map((w) => w.isCompact)).toEqual([true, true, false, false, true, true]);
  });

  it('filters events and counts every chip regardless of the active filter', () => {
    const view = buildMonthGrid({
      ...base,
      filter: 'pokemon',
      events: [
        event('p1', plainDate(2026, 11, 7), 'pokemon'),
        event('p2', plainDate(2026, 11, 14), 'pokemon'),
        event('l1', plainDate(2026, 11, 9), 'lorcana'),
        event('generic', plainDate(2026, 11, 11)),
        event('previous-month', plainDate(2026, 10, 31), 'pokemon'),
      ],
    });
    expect(days(view).flatMap((c) => c.events.map((e) => e.event.id))).toEqual([
      'previous-month',
      'p1',
      'p2',
    ]);
    expect(view.monthEvents.map((e) => e.event.id)).toEqual(['p1', 'p2']);
    expect(view.counts).toEqual({
      all: 4,
      other: 1,
      games: { lorcana: 1, riftbound: 0, onepiece: 0, pokemon: 2 },
    });
  });

  it('counts a multi-day event once', () => {
    const view = buildMonthGrid({
      ...base,
      events: [
        { ...event('cup', plainDate(2026, 11, 13), 'pokemon'), endDate: plainDate(2026, 11, 15) },
      ],
    });
    expect(view.counts.all).toBe(1);
    expect(days(view).filter((c) => c.events.length > 0)).toHaveLength(3);
  });
});

describe('buildMonthGrid – multi-day and ordering', () => {
  const base = {
    month: yearMonth(2026, 11),
    now: { date: plainDate(2026, 11, 7), time: { hour: 12, minute: 0 } },
    weekStartsOn: 1 as const,
  };

  it('shows a multi-day event on every day it spans, clamped to the grid', () => {
    const cells = days(
      buildMonthGrid({
        ...base,
        events: [{ ...event('trip', plainDate(2026, 10, 20)), endDate: plainDate(2026, 10, 27) }],
      }),
    );
    const withTrip = cells.filter((c) => c.events.some((e) => e.event.id === 'trip'));
    expect(withTrip.map((c) => c.date)).toEqual([plainDate(2026, 10, 26), plainDate(2026, 10, 27)]);
  });

  it('orders all-day events before timed ones, timed ones by start', () => {
    const day = plainDate(2026, 11, 15);
    const cells = days(
      buildMonthGrid({
        ...base,
        events: [
          { ...event('late', day), startTime: { hour: 18, minute: 0 } },
          { ...event('early', day), startTime: { hour: 9, minute: 30 } },
          event('allday', day),
        ],
      }),
    );
    const ids = cells
      .find((c) => c.isCurrentMonth && c.date.day === 15)
      ?.events.map((e) => e.event.id);
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
