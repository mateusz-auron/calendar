import type { CalendarEntry, EventLinks, ExternalLink } from '../domain';
import { toIcs } from './ics';

const APPLE_MAPS_URL = 'https://maps.apple.com/';
const ICS_FILE = 'wydarzenie.ics';

/**
 * Links that open the phone's own apps:
 *
 * - iOS: the event as an `.ics` file, which Safari hands to the Calendar app ("Add to
 *   Calendar"), and an Apple Maps universal link, which opens Maps with directions.
 * - Android: the event as an `.ics` download, which opens in the calendar app (Chrome cannot
 *   start a calendar's "new event" screen from a web page), and a `geo:` link, which opens the
 *   chosen maps app.
 */
export class NativeEventLinks implements EventLinks {
  /**
   * @param timeZone The calendar's zone; event times are wall-clock times in it.
   * @param now Current time, for the file's DTSTAMP.
   */
  constructor(
    private readonly platform: 'ios' | 'android',
    private readonly timeZone: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  addToCalendar(entry: CalendarEntry): ExternalLink {
    const href = `data:text/calendar;charset=utf-8,${encodeURIComponent(
      toIcs(entry, this.timeZone, this.now()),
    )}`;
    // iOS Safari shows "Add to Calendar" when it opens the file; a download would only save it.
    return this.platform === 'ios' ? { href } : { href, download: ICS_FILE };
  }

  directions(location: string): ExternalLink {
    const destination = encodeURIComponent(location);
    return this.platform === 'ios'
      ? { href: `${APPLE_MAPS_URL}?daddr=${destination}` }
      : { href: `geo:0,0?q=${destination}` };
  }
}
