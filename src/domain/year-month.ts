import { plainDate, type PlainDate } from './plain-date';

/** A calendar month value object. `month` is 1-based. */
export interface YearMonth {
  readonly year: number;
  readonly month: number;
}

export function yearMonth(year: number, month: number): YearMonth {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`Invalid year-month: ${String(year)}-${String(month)}`);
  }
  return Object.freeze({ year, month });
}

export function yearMonthOf(date: PlainDate): YearMonth {
  return yearMonth(date.year, date.month);
}

export function addMonths(ym: YearMonth, delta: number): YearMonth {
  const index = ym.year * 12 + (ym.month - 1) + delta;
  return yearMonth(Math.floor(index / 12), (((index % 12) + 12) % 12) + 1);
}

export function daysInMonth(ym: YearMonth): number {
  return new Date(Date.UTC(ym.year, ym.month, 0)).getUTCDate();
}

export function firstDayOf(ym: YearMonth): PlainDate {
  return plainDate(ym.year, ym.month, 1);
}

export function isSameYearMonth(a: YearMonth, b: YearMonth): boolean {
  return a.year === b.year && a.month === b.month;
}

/** Parses `YYYY-MM`; returns `undefined` for anything else. */
export function parseYearMonth(value: string): YearMonth | undefined {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? yearMonth(Number(match[1]), month) : undefined;
}

export function toYearMonthString(ym: YearMonth): string {
  return `${String(ym.year)}-${String(ym.month).padStart(2, '0')}`;
}
