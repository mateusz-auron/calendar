import type { PlainDate } from './plain-date';

/** An all-day event shown in the calendar. Clicking it opens `url` in a new tab. */
export interface CalendarEvent {
  readonly id: string;
  readonly title: string;
  readonly date: PlainDate;
  readonly url: string;
  readonly description?: string;
}
