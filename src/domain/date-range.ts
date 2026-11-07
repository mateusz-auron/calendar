import { addDays, compareDates, type PlainDate } from './plain-date';

/** Inclusive range of calendar days. */
export interface DateRange {
  readonly start: PlainDate;
  readonly end: PlainDate;
}

export function dateRange(start: PlainDate, end: PlainDate): DateRange {
  if (compareDates(start, end) > 0) throw new RangeError('DateRange start must not be after end');
  return Object.freeze({ start, end });
}

export function contains(range: DateRange, date: PlainDate): boolean {
  return compareDates(range.start, date) <= 0 && compareDates(date, range.end) <= 0;
}

/** True when [start, end] shares at least one day with `range`. */
export function overlaps(range: DateRange, start: PlainDate, end: PlainDate): boolean {
  return compareDates(start, range.end) <= 0 && compareDates(range.start, end) <= 0;
}

/** Days of `range` ∩ [start, end], in order. */
export function daysOfOverlap(range: DateRange, start: PlainDate, end: PlainDate): PlainDate[] {
  if (!overlaps(range, start, end)) return [];
  const from = compareDates(start, range.start) > 0 ? start : range.start;
  const to = compareDates(end, range.end) < 0 ? end : range.end;
  const days: PlainDate[] = [];
  for (let d = from; compareDates(d, to) <= 0; d = addDays(d, 1)) days.push(d);
  return days;
}
