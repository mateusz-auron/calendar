import type { Clock, DateTime, PlainDate } from '../domain';
import { toZonedParts } from './zoned-time';

/**
 * Clock adapter for the real date, read in the calendar's time zone (not the
 * viewer's), so "today" and past/upcoming match the store's calendar.
 */
export class SystemClock implements Clock {
  constructor(
    private readonly timeZone: string,
    private readonly instant: () => Date = () => new Date(),
  ) {}

  today(): PlainDate {
    return this.now().date;
  }

  now(): DateTime {
    return toZonedParts(this.instant(), this.timeZone);
  }
}
