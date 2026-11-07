import type { Clock, EventRepository, Weekday, YearMonth } from '../domain';
import { buildMonthGrid, gridRange, type MonthView } from './month-grid';

export interface CalendarServiceOptions {
  readonly weekStartsOn: Weekday;
}

/**
 * Application use-case: "show me a month with its events".
 * Depends only on domain ports, so any repository/clock can be plugged in.
 */
export class CalendarService {
  constructor(
    private readonly repository: EventRepository,
    private readonly clock: Clock,
    private readonly options: CalendarServiceOptions,
  ) {}

  async getMonthView(month: YearMonth): Promise<MonthView> {
    // One query for the whole visible grid, so leading/trailing days show their events too.
    const events = await this.repository.findInRange(gridRange(month, this.options.weekStartsOn));

    return buildMonthGrid({
      month,
      today: this.clock.today(),
      weekStartsOn: this.options.weekStartsOn,
      events,
    });
  }
}
