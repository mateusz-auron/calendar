import type { CalendarEntry, PlainDate } from '../domain';
import { entryTimes } from './entry-times';
import { zonedToEpochMs } from './zoned-time';

const MAX_DETAILS = 1500;
const MAX_LINE_BYTES = 75;

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: PlainDate) => `${String(d.year)}${pad(d.month)}${pad(d.day)}`;
/** `YYYYMMDDTHHMMSSZ`, the UTC form every calendar app reads (no VTIMEZONE needed). */
const utc = (epochMs: number) =>
  new Date(epochMs)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/** TEXT values (RFC 5545, 3.3.11). */
const escapeText = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Fold content lines longer than 75 octets (RFC 5545, 3.1) without splitting a character. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // Continuation lines start with a space, which counts towards their 75 octets.
    const limit = parts.length === 0 ? MAX_LINE_BYTES : MAX_LINE_BYTES - 1;
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/**
 * A one-event iCalendar file (`text/calendar`) that calendar apps offer to add.
 * @param timeZone The calendar's zone; event times are wall-clock times in it.
 * @param now The DTSTAMP (when the file was made).
 */
export function toIcs(
  { event, title, location, details }: CalendarEntry,
  timeZone: string,
  now: Date,
): string {
  const times = entryTimes(event);
  const when = times.allDay
    ? [`DTSTART;VALUE=DATE:${ymd(times.start)}`, `DTEND;VALUE=DATE:${ymd(times.endExclusive)}`]
    : [
        `DTSTART:${utc(zonedToEpochMs(times.start, times.startTime, timeZone))}`,
        `DTEND:${utc(zonedToEpochMs(times.end, times.endTime, timeZone))}`,
      ];
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//tournament-calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeText(event.id)}@tournament-calendar`,
    `DTSTAMP:${utc(now.getTime())}`,
    ...when,
    `SUMMARY:${escapeText(title)}`,
    ...(location ? [`LOCATION:${escapeText(location)}`] : []),
    ...(details ? [`DESCRIPTION:${escapeText(details.slice(0, MAX_DETAILS))}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
