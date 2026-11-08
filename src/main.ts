import './presentation/fonts.css';
import './presentation/styles.css';

import { CalendarService } from './application';
import { parseConfig, type AppConfig, type EventSourceKind } from './config/app-config';
import type { EventRepository } from './domain';
import {
  DialogFocusRequester,
  IframeHeightReporter,
  OverlayModeClient,
  VisibleAreaTracker,
} from './embed';
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
  // Opt-in full-screen overlay for the details dialog, when the host page supports it.
  const overlay = reporter.isEmbedded
    ? new OverlayModeClient(window, config.parentOrigin)
    : undefined;

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
      ...(overlay ? { dialogOverlay: overlay } : {}),
      onRender: () => {
        reporter.report();
      },
    },
    config.initialMonth,
  );

  reporter.start();
  overlay?.start();
  if (reporter.isEmbedded) {
    // Keep the details dialog inside the part of the iframe that is on screen.
    const visibleArea = new VisibleAreaTracker(window);
    visibleArea.start();
    new DialogFocusRequester(
      window,
      view.dialogElement,
      () => visibleArea.current,
      config.parentOrigin,
    ).start();
  }
  void view.show(view.month);
}

bootstrap();
