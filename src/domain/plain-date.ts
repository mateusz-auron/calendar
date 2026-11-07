/**
 * Timezone-free calendar date. Months are 1-based (1 = January).
 * Using a plain value object avoids the classic `Date` timezone/DST pitfalls
 * for a calendar that only cares about whole days.
 */
export interface PlainDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** 0 = Sunday … 6 = Saturday (same convention as `Date#getUTCDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const MS_PER_DAY = 86_400_000;

export function plainDate(year: number, month: number, day: number): PlainDate {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    throw new RangeError(`Invalid date: ${String(year)}-${String(month)}-${String(day)}`);
  }
  return Object.freeze({ year, month, day });
}

export function fromJsDate(date: Date): PlainDate {
  return plainDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function toUtcMs(date: PlainDate): number {
  return Date.UTC(date.year, date.month - 1, date.day);
}

function fromUtcMs(ms: number): PlainDate {
  const d = new Date(ms);
  return plainDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(date: PlainDate, days: number): PlainDate {
  return fromUtcMs(toUtcMs(date) + days * MS_PER_DAY);
}

export function weekdayOf(date: PlainDate): Weekday {
  return new Date(toUtcMs(date)).getUTCDay() as Weekday;
}

export function isSameDate(a: PlainDate, b: PlainDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function compareDates(a: PlainDate, b: PlainDate): number {
  return toUtcMs(a) - toUtcMs(b);
}

/** ISO-8601 `YYYY-MM-DD`. */
export function toIsoString(date: PlainDate): string {
  const mm = String(date.month).padStart(2, '0');
  const dd = String(date.day).padStart(2, '0');
  return `${String(date.year)}-${mm}-${dd}`;
}
