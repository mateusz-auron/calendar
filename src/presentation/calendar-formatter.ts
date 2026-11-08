import type { PlainDate, TimeOfDay, Weekday, YearMonth } from '../domain';

const utcMs = (d: PlainDate) => Date.UTC(d.year, d.month - 1, d.day);
const capitalise = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** Locale-aware labels, isolated so the views only deal with layout. */
export class CalendarFormatter {
  private readonly monthTitle: Intl.DateTimeFormat;
  private readonly monthOnly: Intl.DateTimeFormat;
  private readonly weekdayShort: Intl.DateTimeFormat;
  private readonly weekdayLong: Intl.DateTimeFormat;
  private readonly fullDate: Intl.DateTimeFormat;
  private readonly dayMonthFormat: Intl.DateTimeFormat;
  private readonly weekdayDayMonth: Intl.DateTimeFormat;
  private readonly shortDayFormat: Intl.DateTimeFormat;
  private readonly timeOfDay: Intl.DateTimeFormat;
  private readonly currency: Intl.NumberFormat;
  private readonly currencyCents: Intl.NumberFormat;

  constructor(readonly locale: string) {
    const utc = { timeZone: 'UTC' } as const;
    this.monthTitle = new Intl.DateTimeFormat(locale, { ...utc, month: 'long', year: 'numeric' });
    this.monthOnly = new Intl.DateTimeFormat(locale, { ...utc, month: 'long' });
    this.weekdayShort = new Intl.DateTimeFormat(locale, { ...utc, weekday: 'short' });
    this.weekdayLong = new Intl.DateTimeFormat(locale, { ...utc, weekday: 'long' });
    this.fullDate = new Intl.DateTimeFormat(locale, { ...utc, dateStyle: 'full' });
    this.dayMonthFormat = new Intl.DateTimeFormat(locale, {
      ...utc,
      day: 'numeric',
      month: 'long',
    });
    this.weekdayDayMonth = new Intl.DateTimeFormat(locale, {
      ...utc,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    this.shortDayFormat = new Intl.DateTimeFormat(locale, {
      ...utc,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    this.timeOfDay = new Intl.DateTimeFormat(locale, { ...utc, timeStyle: 'short' });
    const money = { style: 'currency', currency: 'PLN' } as const;
    this.currency = new Intl.NumberFormat(locale, { ...money, minimumFractionDigits: 0 });
    this.currencyCents = new Intl.NumberFormat(locale, { ...money, minimumFractionDigits: 2 });
  }

  /** "listopad 2026" */
  month(ym: YearMonth): string {
    return this.monthTitle.format(Date.UTC(ym.year, ym.month - 1, 1));
  }

  /** "Listopad" (stand-alone month name, capitalised). */
  monthName(ym: YearMonth): string {
    return capitalise(this.monthOnly.format(Date.UTC(ym.year, ym.month - 1, 1)));
  }

  /** "sobota, 7 listopada 2026" */
  date(date: PlainDate): string {
    return this.fullDate.format(utcMs(date));
  }

  /** "7 listopada" */
  dayMonth(date: PlainDate): string {
    return this.dayMonthFormat.format(utcMs(date));
  }

  /** "Sobota, 7 listopada" */
  weekdayDate(date: PlainDate): string {
    return capitalise(this.weekdayDayMonth.format(utcMs(date)));
  }

  /** "sob., 7 lis" */
  shortDate(date: PlainDate): string {
    return this.shortDayFormat.format(utcMs(date));
  }

  time(time: TimeOfDay): string {
    return this.timeOfDay.format(Date.UTC(2000, 0, 1, time.hour, time.minute));
  }

  /** "20 zł", "20,50 zł" */
  price(grosze: number): string {
    return (grosze % 100 === 0 ? this.currency : this.currencyCents).format(grosze / 100);
  }

  /** Weekday headers ordered from `weekStartsOn` ("Pon" … "Niedz"). */
  weekdays(weekStartsOn: Weekday): { short: string; long: string }[] {
    // 2023-01-01 was a Sunday (weekday 0).
    return Array.from({ length: 7 }, (_, i) => {
      const ms = Date.UTC(2023, 0, 1 + ((weekStartsOn + i) % 7));
      return {
        short: capitalise(this.weekdayShort.format(ms).replace(/\.$/, '')),
        long: this.weekdayLong.format(ms),
      };
    });
  }
}
