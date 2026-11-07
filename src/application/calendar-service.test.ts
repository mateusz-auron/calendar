import { describe, expect, it, vi } from 'vitest';
import { dateRange, plainDate, yearMonth, type DateRange, type EventRepository } from '../domain';
import { CalendarService } from './calendar-service';

describe('CalendarService', () => {
  it('queries the whole visible grid once and returns its events', async () => {
    const findInRange = vi.fn((range: DateRange) =>
      Promise.resolve([
        { id: 'edge', title: 't', date: range.start, url: 'u' },
        { id: 'outside', title: 't', date: plainDate(2027, 1, 1), url: 'u' },
      ]),
    );
    const repository: EventRepository = { findInRange };
    const service = new CalendarService(
      repository,
      { today: () => plainDate(2026, 11, 7) },
      { weekStartsOn: 1 },
    );

    const view = await service.getMonthView(yearMonth(2026, 11));

    expect(findInRange).toHaveBeenCalledOnce();
    expect(findInRange).toHaveBeenCalledWith(
      dateRange(plainDate(2026, 10, 26), plainDate(2026, 12, 6)),
    );
    const ids = view.weeks.flat().flatMap((c) => c.events.map((e) => e.id));
    expect(ids).toEqual(['edge']);
  });
});
