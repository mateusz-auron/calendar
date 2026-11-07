import { describe, expect, it, vi } from 'vitest';
import { plainDate, yearMonth, type EventRepository, type YearMonth } from '../domain';
import { CalendarService } from './calendar-service';

describe('CalendarService', () => {
  it('loads the month and its neighbours so edge days show events', async () => {
    const findByMonth = vi.fn((m: YearMonth) =>
      Promise.resolve([
        { id: String(m.month), title: 't', date: plainDate(m.year, m.month, 1), url: 'u' },
      ]),
    );
    const repository: EventRepository = { findByMonth };
    const service = new CalendarService(
      repository,
      { today: () => plainDate(2026, 11, 7) },
      { weekStartsOn: 1 },
    );

    const view = await service.getMonthView(yearMonth(2026, 11));

    expect(findByMonth).toHaveBeenCalledTimes(3);
    const ids = view.weeks.flat().flatMap((c) => c.events.map((e) => e.id));
    expect(ids).toEqual(['11', '12']); // Oct 1 is outside the grid; Dec 1 is inside
  });
});
