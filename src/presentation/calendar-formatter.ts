import type { PlainDate, TimeOfDay, Weekday, YearMonth } from '../domain';

/** Locale-aware labels, isolated so the view only deals with layout. */
export class CalendarFormatter {
  private readonly monthTitle: Intl.DateTimeFormat;
  private readonly weekdayShort: Intl.DateTimeFormat;
  private readonly weekdayLong: Intl.DateTimeFormat;
  private readonly fullDate: Intl.DateTimeFormat;
  private readonly timeOfDay: Intl.DateTimeFormat;

  constructor(locale: string) {
    const utc = { timeZone: 'UTC' } as const;
    this.monthTitle = new Intl.DateTimeFormat(locale, { ...utc, month: 'long', year: 'numeric' });
    this.weekdayShort = new Intl.DateTimeFormat(locale, { ...utc, weekday: 'short' });
    this.weekdayLong = new Intl.DateTimeFormat(locale, { ...utc, weekday: 'long' });
    this.fullDate = new Intl.DateTimeFormat(locale, { ...utc, dateStyle: 'full' });
    this.timeOfDay = new Intl.DateTimeFormat(locale, { ...utc, timeStyle: 'short' });
  }

  month(ym: YearMonth): string {
    return this.monthTitle.format(Date.UTC(ym.year, ym.month - 1, 1));
  }

  date(date: PlainDate): string {
    return this.fullDate.format(Date.UTC(date.year, date.month - 1, date.day));
  }

  time(time: TimeOfDay): string {
    return this.timeOfDay.format(Date.UTC(2000, 0, 1, time.hour, time.minute));
  }

  /** Weekday headers ordered from `weekStartsOn`. */
  weekdays(weekStartsOn: Weekday): { short: string; long: string }[] {
    // 2023-01-01 was a Sunday (weekday 0).
    return Array.from({ length: 7 }, (_, i) => {
      const ms = Date.UTC(2023, 0, 1 + ((weekStartsOn + i) % 7));
      return { short: this.weekdayShort.format(ms), long: this.weekdayLong.format(ms) };
    });
  }
}
