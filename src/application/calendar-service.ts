import {
  addMonths,
  type Clock,
  type EventRepository,
  type Weekday,
  type YearMonth,
} from '../domain';
import { buildMonthGrid, type MonthView } from './month-grid';

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
    // Fetch neighbours too, so events on leading/trailing days of the grid are visible.
    const months = [addMonths(month, -1), month, addMonths(month, 1)];
    const events = (await Promise.all(months.map((m) => this.repository.findByMonth(m)))).flat();

    return buildMonthGrid({
      month,
      today: this.clock.today(),
      weekStartsOn: this.options.weekStartsOn,
      events,
    });
  }
}
