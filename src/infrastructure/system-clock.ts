import type { Clock, PlainDate } from '../domain';
import { toZonedParts } from './zoned-time';

/**
 * Clock adapter for the real date, read in the calendar's time zone (not the
 * viewer's), so "today" and past/upcoming match the store's calendar.
 */
export class SystemClock implements Clock {
  constructor(
    private readonly timeZone: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  today(): PlainDate {
    return toZonedParts(this.now(), this.timeZone).date;
  }
}
