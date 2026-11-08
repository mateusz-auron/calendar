import { addDays, type CalendarEntry, type PlainDate, type TimeOfDay } from '../domain';

/** Start and end of a calendar entry, as wall-clock times in the calendar's zone. */
export type EntryTimes =
  | { allDay: true; start: PlainDate; endExclusive: PlainDate }
  | { allDay: false; start: PlainDate; startTime: TimeOfDay; end: PlainDate; endTime: TimeOfDay };

const minutes = (t: TimeOfDay) => t.hour * 60 + t.minute;

export function entryTimes(event: CalendarEntry['event']): EntryTimes {
  const lastDay = event.endDate ?? event.date;
  if (!event.startTime)
    return { allDay: true, start: event.date, endExclusive: addDays(lastDay, 1) };
  const start = event.startTime;
  if (!event.endTime) {
    // No end: one hour, possibly past midnight.
    const total = minutes(start) + 60;
    return {
      allDay: false,
      start: event.date,
      startTime: start,
      end: total >= 24 * 60 ? addDays(event.date, 1) : event.date,
      endTime: { hour: Math.floor(total / 60) % 24, minute: total % 60 },
    };
  }
  const end = event.endTime;
  // Ends at 00:00 → the day after its last day; overnight single-day events end the next day.
  const nextDay = minutes(end) === 0 || (!event.endDate && minutes(end) <= minutes(start));
  return {
    allDay: false,
    start: event.date,
    startTime: start,
    end: nextDay ? addDays(lastDay, 1) : lastDay,
    endTime: end,
  };
}
