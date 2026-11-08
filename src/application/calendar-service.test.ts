import { describe, expect, it, vi } from 'vitest';
import {
  dateRange,
  overlaps,
  plainDate,
  yearMonth,
  type CalendarEvent,
  type DateRange,
  type EventRepository,
  type GameId,
  type PlainDate,
} from '../domain';
import { ADJACENT_SEARCH_MONTHS, CalendarService } from './calendar-service';

const event = (id: string, date: PlainDate, game?: GameId): CalendarEvent => ({
  id,
  title: id,
  date,
  url: 'u',
  ...(game ? { info: { game: { kind: 'known', id: game } } } : {}),
});

function serviceWith(events: readonly CalendarEvent[]) {
  const findInRange = vi.fn((range: DateRange) =>
    Promise.resolve(events.filter((e) => overlaps(range, e.date, e.endDate ?? e.date))),
  );
  const repository: EventRepository = { findInRange };
  const service = new CalendarService(
    repository,
    { today: () => plainDate(2026, 11, 7) },
    { weekStartsOn: 1, cardDefaults: { seats: 16 } },
  );
  return { service, findInRange };
}

describe('CalendarService.getMonthView', () => {
  it('queries the whole visible grid once and applies the filter and defaults', async () => {
    const { service, findInRange } = serviceWith([
      event('edge', plainDate(2026, 10, 26), 'pokemon'),
      event('lorcana', plainDate(2026, 11, 9), 'lorcana'),
      event('outside', plainDate(2027, 1, 1), 'pokemon'),
    ]);

    const view = await service.getMonthView(yearMonth(2026, 11), 'pokemon');

    expect(findInRange).toHaveBeenCalledOnce();
    expect(findInRange).toHaveBeenCalledWith(
      dateRange(plainDate(2026, 10, 26), plainDate(2026, 12, 6)),
    );
    const cards = view.weeks.flatMap((w) => w.days).flatMap((c) => c.events);
    expect(cards.map((c) => c.event.id)).toEqual(['edge']);
    expect(cards[0]?.seats).toEqual({ kind: 'count', value: 16 });
  });
});

describe('CalendarService.findAdjacentEvent', () => {
  const nov7 = event('nov7', plainDate(2026, 11, 7), 'pokemon');

  it('finds the next and previous event, honouring the filter', async () => {
    const { service } = serviceWith([
      event('nov5', plainDate(2026, 11, 5), 'pokemon'),
      event('nov6-lorcana', plainDate(2026, 11, 6), 'lorcana'),
      nov7,
      event('nov8-lorcana', plainDate(2026, 11, 8), 'lorcana'),
      event('nov9', plainDate(2026, 11, 9), 'pokemon'),
    ]);
    expect((await service.findAdjacentEvent(nov7, 1))?.event.id).toBe('nov8-lorcana');
    expect((await service.findAdjacentEvent(nov7, 1, 'pokemon'))?.event.id).toBe('nov9');
    expect((await service.findAdjacentEvent(nov7, -1, 'pokemon'))?.event.id).toBe('nov5');
  });

  it('orders events on the same day by time and id', async () => {
    const at = (id: string, hour: number) => ({
      ...event(id, plainDate(2026, 11, 7)),
      startTime: { hour, minute: 0 },
    });
    const { service } = serviceWith([at('b', 10), at('a', 10), at('c', 12)]);
    expect((await service.findAdjacentEvent(at('a', 10), 1))?.event.id).toBe('b');
    expect((await service.findAdjacentEvent(at('b', 10), 1))?.event.id).toBe('c');
    expect((await service.findAdjacentEvent(at('b', 10), -1))?.event.id).toBe('a');
  });

  it('crosses month boundaries', async () => {
    const { service } = serviceWith([nov7, event('jan20', plainDate(2027, 1, 20))]);
    expect((await service.findAdjacentEvent(nov7, 1))?.event.id).toBe('jan20');
  });

  it(`gives up after ${String(ADJACENT_SEARCH_MONTHS)} empty months`, async () => {
    const { service, findInRange } = serviceWith([nov7, event('far', plainDate(2027, 5, 1))]);
    expect(await service.findAdjacentEvent(nov7, 1)).toBeUndefined();
    expect(findInRange).toHaveBeenCalledTimes(ADJACENT_SEARCH_MONTHS + 1);
  });

  it('queries the same ranges as the month grid, so a cache is reused', async () => {
    const { service, findInRange } = serviceWith([nov7, event('nov9', plainDate(2026, 11, 9))]);
    await service.getMonthView(yearMonth(2026, 11));
    await service.findAdjacentEvent(nov7, 1);
    expect(findInRange.mock.calls[0]).toEqual(findInRange.mock.calls[1]);
  });
});
