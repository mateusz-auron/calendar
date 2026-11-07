import type { CalendarEvent } from './calendar-event';
import type { DateRange } from './date-range';
import type { PlainDate } from './plain-date';

/**
 * Port: source of calendar events (Dependency Inversion).
 * Implementations may be static, generated, or fetched from an API —
 * the rest of the app depends only on this abstraction.
 */
export interface EventRepository {
  /** Every event that occupies at least one day of `range`. */
  findInRange(range: DateRange): Promise<readonly CalendarEvent[]>;
}

/** Port: current date provider, injected to keep logic deterministic and testable. */
export interface Clock {
  today(): PlainDate;
}
