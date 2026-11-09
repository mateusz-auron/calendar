import type { EventInfo } from './event-info';
import { addDays, compareDates, type PlainDate } from './plain-date';

/** Wall-clock time of day in the calendar's display time zone. */
export interface TimeOfDay {
  readonly hour: number;
  readonly minute: number;
}

/** An event shown in the calendar. */
export interface CalendarEvent {
  readonly id: string;
  /** Title of the calendar entry; may be empty. */
  readonly title: string;
  /** First day of the event. */
  readonly date: PlainDate;
  /** Last day (inclusive) for multi-day events; omitted for single-day events. */
  readonly endDate?: PlainDate;
  /** Start time for timed events; omitted for all-day events. */
  readonly startTime?: TimeOfDay;
  /** End time for timed events with a real duration (may be on the next day). */
  readonly endTime?: TimeOfDay;
  /** Link to the event in its source (e.g. the Google Calendar event page). */
  readonly url: string;
  /** Where the event takes place, as written in the calendar. */
  readonly location?: string;
  /** Tournament details parsed from the description; absent when none were given. */
  readonly info?: EventInfo;
  /** Free text from the description that is not a field, shown as plain text. */
  readonly notes?: string;
}

/** Last day (inclusive) the event occupies. */
export function lastDayOf(event: CalendarEvent): PlainDate {
  return event.endDate ?? event.date;
}

/** A wall-clock moment in the calendar's display time zone. */
export interface DateTime {
  readonly date: PlainDate;
  readonly time: TimeOfDay;
}

const minutesOf = (t: TimeOfDay): number => t.hour * 60 + t.minute;

/**
 * The event is over at `now`: its end time has passed, or, without an end
 * time, its last day is before `now`'s date. An end time at or before the start
 * time of a single-day event (or at midnight) belongs to the next day.
 */
export function hasEnded(event: CalendarEvent, now: DateTime): boolean {
  const lastDay = lastDayOf(event);
  const end = event.endTime;
  if (!end) return compareDates(lastDay, now.date) < 0;
  const nextDay =
    minutesOf(end) === 0 ||
    (!event.endDate &&
      event.startTime !== undefined &&
      minutesOf(end) <= minutesOf(event.startTime));
  const endDay = nextDay ? addDays(lastDay, 1) : lastDay;
  const byDay = compareDates(endDay, now.date);
  return byDay < 0 || (byDay === 0 && minutesOf(end) <= minutesOf(now.time));
}
