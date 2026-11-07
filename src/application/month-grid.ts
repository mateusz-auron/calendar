import {
  addDays,
  compareDates,
  dateRange,
  daysOfOverlap,
  firstDayOf,
  isSameDate,
  lastDayOf,
  toIsoString,
  weekdayOf,
  type CalendarEvent,
  type DateRange,
  type PlainDate,
  type Weekday,
  type YearMonth,
} from '../domain';

export interface DayCell {
  readonly date: PlainDate;
  readonly isCurrentMonth: boolean;
  readonly isToday: boolean;
  readonly events: readonly CalendarEvent[];
}

export interface MonthView {
  readonly month: YearMonth;
  /** Always 6 rows × 7 columns so the widget height is stable when navigating. */
  readonly weeks: readonly (readonly DayCell[])[];
}

export interface MonthGridInput {
  readonly month: YearMonth;
  readonly today: PlainDate;
  readonly weekStartsOn: Weekday;
  readonly events: readonly CalendarEvent[];
}

const WEEKS = 6;
const DAYS_PER_WEEK = 7;

/** The days covered by the 6×7 grid of `month`, including leading/trailing days. */
export function gridRange(month: YearMonth, weekStartsOn: Weekday): DateRange {
  const first = firstDayOf(month);
  const leading = (weekdayOf(first) - weekStartsOn + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const start = addDays(first, -leading);
  return dateRange(start, addDays(start, WEEKS * DAYS_PER_WEEK - 1));
}

/** Pure function: builds the month grid view-model. No I/O, fully unit-testable. */
export function buildMonthGrid({ month, today, weekStartsOn, events }: MonthGridInput): MonthView {
  const range = gridRange(month, weekStartsOn);
  const eventsByDay = groupByDay(range, events);

  const weeks = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: DAYS_PER_WEEK }, (_, d): DayCell => {
      const date = addDays(range.start, w * DAYS_PER_WEEK + d);
      return {
        date,
        isCurrentMonth: date.year === month.year && date.month === month.month,
        isToday: isSameDate(date, today),
        events: eventsByDay.get(toIsoString(date)) ?? [],
      };
    }),
  );

  return { month, weeks };
}

/** All-day events first, then timed events by start time, then by title. */
function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  const minutes = (e: CalendarEvent) =>
    e.startTime ? e.startTime.hour * 60 + e.startTime.minute : -1;
  return compareDates(a.date, b.date) || minutes(a) - minutes(b) || a.title.localeCompare(b.title);
}

/** Places every event on each grid day it occupies (multi-day events span several cells). */
function groupByDay(
  range: DateRange,
  events: readonly CalendarEvent[],
): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of [...events].sort(compareEvents)) {
    for (const day of daysOfOverlap(range, event.date, lastDayOf(event))) {
      const key = toIsoString(day);
      const bucket = map.get(key);
      if (bucket) bucket.push(event);
      else map.set(key, [event]);
    }
  }
  return map;
}
