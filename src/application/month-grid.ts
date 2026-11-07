import {
  addDays,
  compareDates,
  firstDayOf,
  isSameDate,
  toIsoString,
  weekdayOf,
  type CalendarEvent,
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

/** Pure function: builds the month grid view-model. No I/O, fully unit-testable. */
export function buildMonthGrid({ month, today, weekStartsOn, events }: MonthGridInput): MonthView {
  const eventsByDay = groupByDay(events);
  const first = firstDayOf(month);
  const leading = (weekdayOf(first) - weekStartsOn + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const gridStart = addDays(first, -leading);

  const weeks = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: DAYS_PER_WEEK }, (_, d): DayCell => {
      const date = addDays(gridStart, w * DAYS_PER_WEEK + d);
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

function groupByDay(events: readonly CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of [...events].sort((a, b) => compareDates(a.date, b.date))) {
    const key = toIsoString(event.date);
    const bucket = map.get(key);
    if (bucket) bucket.push(event);
    else map.set(key, [event]);
  }
  return map;
}
