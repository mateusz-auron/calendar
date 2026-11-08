import type { CalendarEntry, EventLinks } from '../domain';

const APPLE_MAPS_URL = 'https://maps.apple.com/';

/**
 * Links for phones: directions open the native maps app (Apple Maps universal link on iOS,
 * a `geo:` link on Android, which opens the chosen maps app). "Add to calendar" stays a
 * Google Calendar link from `calendar`.
 */
export class NativeEventLinks implements EventLinks {
  constructor(
    private readonly platform: 'ios' | 'android',
    private readonly calendar: EventLinks,
  ) {}

  addToCalendarUrl(entry: CalendarEntry): string {
    return this.calendar.addToCalendarUrl(entry);
  }

  directionsUrl(location: string): string {
    const destination = encodeURIComponent(location);
    return this.platform === 'ios'
      ? `${APPLE_MAPS_URL}?daddr=${destination}`
      : `geo:0,0?q=${destination}`;
  }
}
