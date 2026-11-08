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

/** What an "add to calendar" link describes. */
export interface CalendarEntry {
  readonly event: CalendarEvent;
  readonly title: string;
  readonly location?: string;
  readonly details?: string;
}

/** A link to show as an anchor. */
export interface ExternalLink {
  readonly href: string;
  /** File name when the link saves a file (an `.ics`) instead of opening a page. */
  readonly download?: string;
}

/**
 * Port: links to external services (calendar apps, maps), so views hold no URLs.
 * On phones they open the native apps; elsewhere they open web pages.
 */
export interface EventLinks {
  addToCalendar(entry: CalendarEntry): ExternalLink;
  directions(location: string): ExternalLink;
}
