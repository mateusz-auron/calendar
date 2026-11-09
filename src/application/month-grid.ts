import {
  addDays,
  compareDates,
  dateRange,
  daysOfOverlap,
  firstDayOf,
  GAME_IDS,
  isSameDate,
  lastDayOf,
  toIsoString,
  weekdayOf,
  yearMonthOf,
  isSameYearMonth,
  type CalendarEvent,
  type DateRange,
  type DateTime,
  type GameFilter,
  type GameId,
  type PlainDate,
  type Weekday,
  type YearMonth,
} from '../domain';
import {
  buildEventCard,
  CARD_DEFAULTS,
  filterKeyOf,
  matchesFilter,
  type CardDefaults,
  type EventCard,
} from './event-card';

export interface DayCell {
  readonly date: PlainDate;
  readonly isCurrentMonth: boolean;
  readonly isToday: boolean;
  readonly isPast: boolean;
  readonly isWeekend: boolean;
  /** Events on this day that match the filter, ordered for display. */
  readonly events: readonly EventCard[];
}

export interface WeekRow {
  readonly days: readonly DayCell[];
  /** No (filtered) events this week: the design renders a low row. */
  readonly isCompact: boolean;
}

export interface FilterCounts {
  readonly all: number;
  readonly other: number;
  readonly games: Readonly<Record<GameId, number>>;
}

export interface MonthView {
  readonly month: YearMonth;
  readonly filter: GameFilter;
  /** 4–6 rows: weeks without a day of the month are left out. */
  readonly weeks: readonly WeekRow[];
  /** Filtered events starting in this month, in display order (for "n / N"). */
  readonly monthEvents: readonly EventCard[];
  /** Events starting in this month per filter chip (ignoring the active filter). */
  readonly counts: FilterCounts;
}

export interface MonthGridInput {
  readonly month: YearMonth;
  /** Current date and time; ended events are marked past from their end time. */
  readonly now: DateTime;
  readonly weekStartsOn: Weekday;
  readonly events: readonly CalendarEvent[];
  readonly filter?: GameFilter;
  readonly defaults?: CardDefaults;
}

const WEEKS = 6;
const DAYS_PER_WEEK = 7;

/**
 * The 6×7 days around `month`, including leading/trailing days. Events are
 * always fetched for this whole range, so ranges stay stable for caching.
 */
export function gridRange(month: YearMonth, weekStartsOn: Weekday): DateRange {
  const first = firstDayOf(month);
  const leading = (weekdayOf(first) - weekStartsOn + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const start = addDays(first, -leading);
  return dateRange(start, addDays(start, WEEKS * DAYS_PER_WEEK - 1));
}

/** Pure function: builds the month view-model. No I/O, fully unit-testable. */
export function buildMonthGrid(input: MonthGridInput): MonthView {
  const { month, now, weekStartsOn } = input;
  const today = now.date;
  const filter = input.filter ?? 'all';
  const range = gridRange(month, weekStartsOn);
  const cards = [...input.events]
    .sort(compareEvents)
    .map((event) => buildEventCard(event, now, input.defaults ?? CARD_DEFAULTS));
  const visible = cards.filter((card) => matchesFilter(card, filter));
  const eventsByDay = groupByDay(range, visible);
  const inMonth = (date: PlainDate) => isSameYearMonth(yearMonthOf(date), month);

  const weeks: WeekRow[] = [];
  for (let w = 0; w < WEEKS; w++) {
    const days = Array.from({ length: DAYS_PER_WEEK }, (_, d): DayCell => {
      const date = addDays(range.start, w * DAYS_PER_WEEK + d);
      const weekday = weekdayOf(date);
      return {
        date,
        isCurrentMonth: inMonth(date),
        isToday: isSameDate(date, today),
        isPast: compareDates(date, today) < 0,
        isWeekend: weekday === 0 || weekday === 6,
        events: eventsByDay.get(toIsoString(date)) ?? [],
      };
    });
    if (!days.some((day) => day.isCurrentMonth)) continue;
    weeks.push({ days, isCompact: days.every((day) => day.events.length === 0) });
  }

  const startingInMonth = cards.filter((card) => inMonth(card.event.date));
  return {
    month,
    filter,
    weeks,
    monthEvents: startingInMonth.filter((card) => matchesFilter(card, filter)),
    counts: countByFilter(startingInMonth),
  };
}

function countByFilter(cards: readonly EventCard[]): FilterCounts {
  const games = Object.fromEntries(GAME_IDS.map((id) => [id, 0])) as Record<GameId, number>;
  let other = 0;
  for (const card of cards) {
    const key = filterKeyOf(card);
    if (key === 'other') other++;
    else games[key]++;
  }
  return { all: cards.length, other, games };
}

/**
 * Display and navigation order: by start day, all-day events first, then by
 * start time, title and id (a total order, so prev/next is well defined).
 */
export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  const minutes = (e: CalendarEvent) =>
    e.startTime ? e.startTime.hour * 60 + e.startTime.minute : -1;
  return (
    compareDates(a.date, b.date) ||
    minutes(a) - minutes(b) ||
    a.title.localeCompare(b.title) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** Places every event on each grid day it occupies (multi-day events span several cells). */
function groupByDay(range: DateRange, cards: readonly EventCard[]): Map<string, EventCard[]> {
  const map = new Map<string, EventCard[]>();
  for (const card of cards) {
    for (const day of daysOfOverlap(range, card.event.date, lastDayOf(card.event))) {
      const key = toIsoString(day);
      const bucket = map.get(key);
      if (bucket) bucket.push(card);
      else map.set(key, [card]);
    }
  }
  return map;
}
