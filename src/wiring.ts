import { CalendarService } from './application';
import { parseConfig, type AppConfig, type EventSourceKind } from './config/app-config';
import type { Clock, EventRepository } from './domain';
import {
  CachingEventRepository,
  DemoEventRepository,
  FallbackEventRepository,
  GoogleCalendarEventRepository,
  SnapshotEventRepository,
} from './infrastructure';

/**
 * Wiring shared by the composition roots (main.ts and poster-main.ts), so the
 * calendar and the poster read the same events from the same sources.
 */

const browserFetch = (input: string, init?: RequestInit) => fetch(input, init);

/** The page's configuration: URL parameters on top of the build-time variables. */
export function readConfig(search: string): AppConfig {
  return parseConfig(search, {
    // The store's language and time zone, not the viewer's (override with ?lang= / ?tz=).
    locale: import.meta.env.VITE_LOCALE,
    timeZone: import.meta.env.VITE_TIME_ZONE,
    calendarId: import.meta.env.VITE_GOOGLE_CALENDAR_ID,
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
    eventSource: import.meta.env.VITE_EVENT_SOURCE,
    icalSnapshot: import.meta.env.VITE_ICAL_SNAPSHOT === 'true',
    defaultSeats: import.meta.env.VITE_DEFAULT_SEATS,
    defaultLocation: import.meta.env.VITE_DEFAULT_LOCATION,
    posterSite: import.meta.env.VITE_POSTER_SITE,
  });
}

function createSource(kind: EventSourceKind, config: AppConfig): EventRepository {
  const mapping = { timeZone: config.timeZone, fallbackUrl: config.eventUrl, fetch: browserFetch };
  switch (kind) {
    case 'google-api':
      if (!config.google) throw new Error('google-api source selected without credentials');
      return new GoogleCalendarEventRepository({ ...config.google, ...mapping });
    case 'ical':
      // Relative URL: works under any GitHub Pages sub-path.
      return new SnapshotEventRepository({ url: './events.json', ...mapping });
    case 'demo':
      return new DemoEventRepository({ eventUrl: config.eventUrl });
  }
}

/**
 * Builds the event source chain, e.g. Google API → (on failure) iCal snapshot,
 * wrapped in a cache so month navigation doesn't re-fetch.
 */
export function createRepository(config: AppConfig): EventRepository {
  const [firstKind, ...fallbackKinds] = config.eventSources;
  const chain = fallbackKinds.reduce<EventRepository>(
    (primary, kind) =>
      new FallbackEventRepository(primary, createSource(kind, config), (error) => {
        console.warn('[calendar] primary event source failed, using fallback', error);
      }),
    createSource(firstKind, config),
  );
  return new CachingEventRepository(chain);
}

export function createService(config: AppConfig, clock: Clock): CalendarService {
  return new CalendarService(createRepository(config), clock, {
    weekStartsOn: config.weekStartsOn,
    cardDefaults: {
      seats: config.defaultSeats,
      ...(config.defaultLocation ? { location: config.defaultLocation } : {}),
    },
  });
}
