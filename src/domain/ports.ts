import type { CalendarEvent } from './calendar-event';
import type { PlainDate } from './plain-date';
import type { YearMonth } from './year-month';

/**
 * Port: source of calendar events (Dependency Inversion).
 * Implementations may be static, generated, or fetched from an API —
 * the rest of the app depends only on this abstraction.
 */
export interface EventRepository {
  findByMonth(month: YearMonth): Promise<readonly CalendarEvent[]>;
}

/** Port: current date provider, injected to keep logic deterministic and testable. */
export interface Clock {
  today(): PlainDate;
}
