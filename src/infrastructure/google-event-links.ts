import type { CalendarEntry, EventLinks, ExternalLink, PlainDate, TimeOfDay } from '../domain';
import { entryTimes, type EntryTimes } from './entry-times';

const CALENDAR_URL = 'https://calendar.google.com/calendar/render';
const MAPS_URL = 'https://www.google.com/maps/dir/';
const MAX_DETAILS = 1500;

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: PlainDate) => `${String(d.year)}${pad(d.month)}${pad(d.day)}`;
const hms = (t: TimeOfDay) => `T${pad(t.hour)}${pad(t.minute)}00`;

/** Google Calendar "add event" template links and Google Maps directions (web pages). */
export class GoogleEventLinks implements EventLinks {
  /** @param timeZone The calendar's zone; event times are wall-clock times in it. */
  constructor(private readonly timeZone: string) {}

  addToCalendar({ event, title, location, details }: CalendarEntry): ExternalLink {
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: datesOf(entryTimes(event)),
    });
    if (event.startTime) params.set('ctz', this.timeZone);
    if (details) params.set('details', details.slice(0, MAX_DETAILS));
    if (location) params.set('location', location);
    return { href: `${CALENDAR_URL}?${params.toString()}` };
  }

  directions(location: string): ExternalLink {
    const params = new URLSearchParams({ api: '1', destination: location });
    return { href: `${MAPS_URL}?${params.toString()}` };
  }
}

function datesOf(times: EntryTimes): string {
  return times.allDay
    ? `${ymd(times.start)}/${ymd(times.endExclusive)}`
    : `${ymd(times.start)}${hms(times.startTime)}/${ymd(times.end)}${hms(times.endTime)}`;
}
