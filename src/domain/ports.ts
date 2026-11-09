import type { CalendarEvent, DateTime } from './calendar-event';
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

/** Port: current date/time provider, injected to keep logic deterministic and testable. */
export interface Clock {
  today(): PlainDate;
  /** Current date and time of day in the calendar's time zone. */
  now(): DateTime;
}

/** What an "add to calendar" link describes. */
export interface CalendarEntry {
  readonly event: CalendarEvent;
  readonly title: string;
  readonly location?: string;
  readonly details?: string;
}

/** Port: links to external services (calendar apps, maps), so views hold no URLs. */
export interface EventLinks {
  addToCalendarUrl(entry: CalendarEntry): string;
  directionsUrl(location: string): string;
}
