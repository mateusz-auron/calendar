import {
  addMonths,
  yearMonthOf,
  type CalendarEvent,
  type Clock,
  type EventRepository,
  type GameFilter,
  type Weekday,
  type YearMonth,
} from '../domain';
import {
  buildEventCard,
  CARD_DEFAULTS,
  matchesFilter,
  type CardDefaults,
  type EventCard,
} from './event-card';
import { buildMonthGrid, compareEvents, gridRange, type MonthView } from './month-grid';

export interface CalendarServiceOptions {
  readonly weekStartsOn: Weekday;
  readonly cardDefaults?: CardDefaults;
}

/** How many months prev/next looks ahead before giving up (the API source has no end). */
export const ADJACENT_SEARCH_MONTHS = 3;

/**
 * Application use-cases: "show me a month with its events" and "which event
 * comes before/after this one". Depends only on domain ports.
 */
export class CalendarService {
  constructor(
    private readonly repository: EventRepository,
    private readonly clock: Clock,
    private readonly options: CalendarServiceOptions,
  ) {}

  async getMonthView(month: YearMonth, filter: GameFilter = 'all'): Promise<MonthView> {
    // One query for the whole 6-week grid, so leading/trailing days show their events too.
    const events = await this.repository.findInRange(this.rangeOf(month));
    return buildMonthGrid({
      month,
      today: this.clock.today(),
      weekStartsOn: this.options.weekStartsOn,
      events,
      filter,
      defaults: this.defaults,
    });
  }

  /**
   * The event just before/after `event` (by start) that matches `filter`.
   * Searches the event's own month, then up to {@link ADJACENT_SEARCH_MONTHS}
   * further months, reusing the grid ranges so cached results are hit.
   */
  async findAdjacentEvent(
    event: CalendarEvent,
    direction: 1 | -1,
    filter: GameFilter = 'all',
  ): Promise<EventCard | undefined> {
    const today = this.clock.today();
    const start = yearMonthOf(event.date);
    for (let step = 0; step <= ADJACENT_SEARCH_MONTHS; step++) {
      const events = await this.repository.findInRange(
        this.rangeOf(addMonths(start, step * direction)),
      );
      const candidates = events
        .filter((e) => compareEvents(e, event) * direction > 0)
        .sort((a, b) => compareEvents(a, b) * direction)
        .map((e) => buildEventCard(e, today, this.defaults))
        .filter((card) => matchesFilter(card, filter));
      if (candidates[0]) return candidates[0];
    }
    return undefined;
  }

  private get defaults(): CardDefaults {
    return this.options.cardDefaults ?? CARD_DEFAULTS;
  }

  private rangeOf(month: YearMonth) {
    return gridRange(month, this.options.weekStartsOn);
  }
}
