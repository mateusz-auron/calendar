import type { PlainDate } from './plain-date';

/** Wall-clock time of day in the calendar's display time zone. */
export interface TimeOfDay {
  readonly hour: number;
  readonly minute: number;
}

/** An event shown in the calendar. Clicking it opens `url` in a new tab. */
export interface CalendarEvent {
  readonly id: string;
  readonly title: string;
  /** First day of the event. */
  readonly date: PlainDate;
  /** Last day (inclusive) for multi-day events; omitted for single-day events. */
  readonly endDate?: PlainDate;
  /** Start time for timed events; omitted for all-day events. */
  readonly startTime?: TimeOfDay;
  readonly url: string;
  readonly description?: string;
}

/** Last day (inclusive) the event occupies. */
export function lastDayOf(event: CalendarEvent): PlainDate {
  return event.endDate ?? event.date;
}
