import { describe, expect, it } from 'vitest';
import { calendarIdFromIcalUrl, icalToSnapshot } from './ical-to-snapshot';

const WARSAW = `BEGIN:VTIMEZONE
TZID:Europe/Warsaw
BEGIN:STANDARD
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
END:DAYLIGHT
END:VTIMEZONE`;

const calendar = (...events: string[]) =>
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
    'X-WR-TIMEZONE:Europe/Warsaw',
    WARSAW,
    ...events.map((e) => `BEGIN:VEVENT\n${e.trim()}\nEND:VEVENT`),
    'END:VCALENDAR',
  ]
    .join('\n')
    .replace(/\n/g, '\r\n');

const options = { now: new Date('2026-11-08T12:00:00Z'), pastMonths: 1, futureMonths: 2 };

describe('icalToSnapshot', () => {
  it('produces a versioned snapshot covering whole months around "now"', () => {
    const snapshot = icalToSnapshot(calendar(), options);
    expect(snapshot).toMatchObject({
      version: 1,
      source: 'ical',
      generatedAt: '2026-11-08T12:00:00.000Z',
      range: { start: '2026-10-01', end: '2027-01-31' },
      events: [],
    });
  });

  it('maps single timed and all-day events', () => {
    const { events } = icalToSnapshot(
      calendar(
        `UID:talk@example.com
DTSTART;TZID=Europe/Warsaw:20261112T180000
DTEND;TZID=Europe/Warsaw:20261112T193000
SUMMARY:Tech talk
DESCRIPTION:Bring a laptop
LOCATION:Sklep Planszówki\\, ul. Długa 1\\, Kraków
URL:https://example.com/talk`,
        `UID:fair@example.com
DTSTART;VALUE=DATE:20261120
DTEND;VALUE=DATE:20261123
SUMMARY:Book fair`,
      ),
      options,
    );
    expect(events).toEqual([
      {
        id: 'talk@example.com',
        title: 'Tech talk',
        description: 'Bring a laptop',
        location: 'Sklep Planszówki, ul. Długa 1, Kraków',
        url: 'https://example.com/talk',
        start: { dateTime: '2026-11-12T17:00:00.000Z' },
        end: { dateTime: '2026-11-12T18:30:00.000Z' },
      },
      {
        id: 'fair@example.com',
        title: 'Book fair',
        start: { date: '2026-11-20' },
        end: { date: '2026-11-23' },
      },
    ]);
  });

  it('expands recurrences, honours EXDATE and RECURRENCE-ID overrides', () => {
    const { events } = icalToSnapshot(
      calendar(
        `UID:standup@example.com
DTSTART;TZID=Europe/Warsaw:20261102T090000
DTEND;TZID=Europe/Warsaw:20261102T093000
RRULE:FREQ=WEEKLY;COUNT=4
EXDATE;TZID=Europe/Warsaw:20261109T090000
SUMMARY:Standup`,
        `UID:standup@example.com
RECURRENCE-ID;TZID=Europe/Warsaw:20261116T090000
DTSTART;TZID=Europe/Warsaw:20261116T120000
DTEND;TZID=Europe/Warsaw:20261116T123000
SUMMARY:Standup (moved)`,
      ),
      options,
    );
    expect(events.map((e) => [e.id, e.title, e.start?.dateTime])).toEqual([
      ['standup@example.com_20261102T080000Z', 'Standup', '2026-11-02T08:00:00.000Z'],
      ['standup@example.com_20261116T080000Z', 'Standup (moved)', '2026-11-16T11:00:00.000Z'],
      ['standup@example.com_20261123T080000Z', 'Standup', '2026-11-23T08:00:00.000Z'],
    ]);
  });

  it('cuts endless series at the end of the window and skips past ones', () => {
    const { events } = icalToSnapshot(
      calendar(
        `UID:monthly@example.com
DTSTART;VALUE=DATE:20200115
DTEND;VALUE=DATE:20200116
RRULE:FREQ=MONTHLY
SUMMARY:Payday`,
      ),
      options,
    );
    expect(events.map((e) => e.start?.date)).toEqual([
      '2026-10-15',
      '2026-11-15',
      '2026-12-15',
      '2027-01-15',
    ]);
    expect(events[0]?.id).toBe('monthly@example.com_20261015');
  });

  it('drops cancelled events and reads floating times in X-WR-TIMEZONE', () => {
    const { events } = icalToSnapshot(
      calendar(
        `UID:gone@example.com
DTSTART;VALUE=DATE:20261110
STATUS:CANCELLED
SUMMARY:Cancelled`,
        `UID:floating@example.com
DTSTART:20261110T100000
DTEND:20261110T110000
SUMMARY:Floating`,
      ),
      options,
    );
    expect(events).toEqual([
      expect.objectContaining({
        id: 'floating@example.com',
        start: { dateTime: '2026-11-10T09:00:00.000Z' },
      }),
    ]);
  });

  it('links Google events to their Google Calendar page', () => {
    const { events } = icalToSnapshot(
      calendar(
        `UID:abc123@google.com
DTSTART;VALUE=DATE:20261110
DTEND;VALUE=DATE:20261111
SUMMARY:Google event`,
      ),
      { ...options, calendarId: 'team@group.calendar.google.com' },
    );
    const eid = new URL(events[0]?.url ?? '').searchParams.get('eid') ?? '';
    expect(Buffer.from(eid, 'base64').toString()).toBe('abc123 team@g');
  });

  it('rejects responses that are not calendars', () => {
    expect(() => icalToSnapshot('<html>Sign in</html>', options)).toThrow(/Not an iCalendar/);
  });
});

describe('calendarIdFromIcalUrl', () => {
  it('extracts the id from Google public iCal URLs only', () => {
    expect(
      calendarIdFromIcalUrl(
        'https://calendar.google.com/calendar/ical/team%40group.calendar.google.com/public/basic.ics',
      ),
    ).toBe('team@group.calendar.google.com');
    expect(calendarIdFromIcalUrl('https://example.com/calendar/ical/x/public/basic.ics')).toBe(
      undefined,
    );
  });
});
