import './presentation/fonts.css';
import './presentation/styles.css';

import { CalendarService } from './application';
import { parseConfig, type AppConfig, type EventSourceKind } from './config/app-config';
import type { EventRepository } from './domain';
import { IframeHeightReporter } from './embed/iframe-height-reporter';
import {
  CachingEventRepository,
  DemoEventRepository,
  FallbackEventRepository,
  GoogleCalendarEventRepository,
  GoogleEventLinks,
  SnapshotEventRepository,
  SystemClock,
} from './infrastructure';
import { CalendarFormatter, CalendarView, messagesFor } from './presentation';

const browserFetch = (input: string, init?: RequestInit) => fetch(input, init);

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
function createRepository(config: AppConfig): EventRepository {
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

/**
 * Composition root — the only place that knows concrete implementations.
 */
function bootstrap(): void {
  const root = document.getElementById('app');
  if (!root) throw new Error('Missing #app root element');

  const config = parseConfig(window.location.search, {
    // The store's language and time zone, not the viewer's (override with ?lang= / ?tz=).
    locale: import.meta.env.VITE_LOCALE,
    timeZone: import.meta.env.VITE_TIME_ZONE,
    calendarId: import.meta.env.VITE_GOOGLE_CALENDAR_ID,
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
    eventSource: import.meta.env.VITE_EVENT_SOURCE,
    icalSnapshot: import.meta.env.VITE_ICAL_SNAPSHOT === 'true',
    defaultSeats: import.meta.env.VITE_DEFAULT_SEATS,
    defaultLocation: import.meta.env.VITE_DEFAULT_LOCATION,
  });
  if (config.theme !== 'auto') document.documentElement.dataset.theme = config.theme;
  document.documentElement.lang = config.locale;

  const clock = new SystemClock(config.timeZone);
  const service = new CalendarService(createRepository(config), clock, {
    weekStartsOn: config.weekStartsOn,
    cardDefaults: {
      seats: config.defaultSeats,
      ...(config.defaultLocation ? { location: config.defaultLocation } : {}),
    },
  });
  const reporter = new IframeHeightReporter(window, config.parentOrigin);
  if (reporter.isEmbedded) document.documentElement.classList.add('is-embedded');

  const view = new CalendarView(
    {
      root,
      service,
      formatter: new CalendarFormatter(config.locale),
      messages: messagesFor(config.locale),
      links: new GoogleEventLinks(config.timeZone),
      clock,
      weekStartsOn: config.weekStartsOn,
      initialFilter: config.initialFilter,
      onRender: () => {
        reporter.report();
      },
    },
    config.initialMonth,
  );

  reporter.start();
  void view.show(view.month);
}

bootstrap();
