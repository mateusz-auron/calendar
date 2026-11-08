import {
  addDays,
  type CalendarEntry,
  type EventLinks,
  type PlainDate,
  type TimeOfDay,
} from '../domain';

const CALENDAR_URL = 'https://calendar.google.com/calendar/render';
const MAPS_URL = 'https://www.google.com/maps/dir/';
const MAX_DETAILS = 1500;

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: PlainDate) => `${String(d.year)}${pad(d.month)}${pad(d.day)}`;
const hms = (t: TimeOfDay) => `T${pad(t.hour)}${pad(t.minute)}00`;
const minutes = (t: TimeOfDay) => t.hour * 60 + t.minute;

/** Google Calendar "add event" template links and Google Maps directions. */
export class GoogleEventLinks implements EventLinks {
  /** @param timeZone The calendar's zone; event times are wall-clock times in it. */
  constructor(private readonly timeZone: string) {}

  addToCalendarUrl({ event, title, location, details }: CalendarEntry): string {
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: datesOf(entryTimes(event)),
    });
    if (event.startTime) params.set('ctz', this.timeZone);
    if (details) params.set('details', details.slice(0, MAX_DETAILS));
    if (location) params.set('location', location);
    return `${CALENDAR_URL}?${params.toString()}`;
  }

  directionsUrl(location: string): string {
    return `${MAPS_URL}?${new URLSearchParams({ api: '1', destination: location }).toString()}`;
  }
}

type Times =
  | { allDay: true; start: PlainDate; endExclusive: PlainDate }
  | { allDay: false; start: PlainDate; startTime: TimeOfDay; end: PlainDate; endTime: TimeOfDay };

function entryTimes(event: CalendarEntry['event']): Times {
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

function datesOf(times: Times): string {
  return times.allDay
    ? `${ymd(times.start)}/${ymd(times.endExclusive)}`
    : `${ymd(times.start)}${hms(times.startTime)}/${ymd(times.end)}${hms(times.endTime)}`;
}
