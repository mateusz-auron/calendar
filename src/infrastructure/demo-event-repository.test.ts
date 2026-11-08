import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  contains,
  dateRange,
  firstDayOf,
  weekdayOf,
  yearMonth,
  type YearMonth,
} from '../domain';
import { DemoEventRepository } from './demo-event-repository';

const monthRange = (m: YearMonth) =>
  dateRange(firstDayOf(m), addDays(firstDayOf(addMonths(m, 1)), -1));

describe('DemoEventRepository', () => {
  const repo = new DemoEventRepository({ eventUrl: 'https://example.com/' });

  it('follows the weekly rhythm: Mon Lorcana, Tue Riftbound, Fri One Piece, Sat Pokémon', async () => {
    const events = await repo.findInRange(monthRange(yearMonth(2026, 11)));
    const tournaments = events.filter((e) => e.id.startsWith('demo-2026-11-') && e.info?.price);
    const byWeekday = new Map(
      tournaments.map((e) => [
        weekdayOf(e.date),
        e.info?.game?.kind === 'known' ? e.info.game.id : '',
      ]),
    );
    expect(Object.fromEntries(byWeekday)).toEqual({
      1: 'lorcana',
      2: 'riftbound',
      5: 'onepiece',
      6: 'pokemon',
    });
  });

  it('adds one generic event and one bare tournament to every month', async () => {
    let month = yearMonth(2025, 1);
    for (let i = 0; i < 24; i++, month = addMonths(month, 1)) {
      const events = await repo.findInRange(monthRange(month));
      const generic = events.filter((e) => !e.info?.game);
      const bare = events.filter(
        (e) => e.info?.game && Object.keys(e.info).length === 1 && !e.notes,
      );
      expect(generic).toHaveLength(1);
      expect(bare).toHaveLength(1);
      expect(generic[0]?.notes).toBeTruthy();
    }
  });

  it('returns only events inside the range, with times and a location', async () => {
    const range = dateRange(
      firstDayOf(yearMonth(2026, 11)),
      addDays(firstDayOf(yearMonth(2026, 11)), 9),
    );
    const events = await repo.findInRange(range);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(contains(range, e.date)).toBe(true);
      expect(e.startTime).toBeDefined();
      expect(e.endTime).toBeDefined();
      expect(e.location).toBeTruthy();
    }
  });

  it('exercises the defaults: some tournaments have no results link', async () => {
    const events = await repo.findInRange(monthRange(yearMonth(2026, 11)));
    const tournaments = events.filter((e) => e.info?.registrationUrl);
    expect(tournaments.some((e) => e.info?.resultsUrl)).toBe(true);
    expect(tournaments.some((e) => !e.info?.resultsUrl)).toBe(true);
  });

  it('is deterministic for the same seed', async () => {
    const other = new DemoEventRepository({ eventUrl: 'https://example.com/' });
    const range = monthRange(yearMonth(2026, 5));
    expect(await other.findInRange(range)).toEqual(await repo.findInRange(range));
  });
});
