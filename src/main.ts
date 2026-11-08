import './presentation/fonts.css';
import './presentation/styles.css';

import { CalendarService } from './application';
import { parseConfig, type AppConfig, type EventSourceKind } from './config/app-config';
import type { EventLinks, EventRepository } from './domain';
import {
  DetailsBridge,
  DetailsPageClient,
  DialogFocusRequester,
  IframeHeightReporter,
  VisibleAreaTracker,
} from './embed';
import {
  CachingEventRepository,
  DemoEventRepository,
  detectPlatform,
  FallbackEventRepository,
  GoogleCalendarEventRepository,
  GoogleEventLinks,
  NativeEventLinks,
  SnapshotEventRepository,
  SystemClock,
} from './infrastructure';
import {
  CalendarFormatter,
  CalendarView,
  messagesFor,
  type CalendarViewDeps,
} from './presentation';

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

/** Phones open their own calendar and maps apps; other devices get Google's web pages. */
function createLinks(timeZone: string): EventLinks {
  const platform = detectPlatform(navigator);
  return platform === 'other'
    ? new GoogleEventLinks(timeZone)
    : new NativeEventLinks(platform, timeZone);
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
  const viewDeps = {
    service,
    formatter: new CalendarFormatter(config.locale),
    messages: messagesFor(config.locale),
    links: createLinks(config.timeZone),
    clock,
    weekStartsOn: config.weekStartsOn,
    initialFilter: config.initialFilter,
  };

  if (config.mode === 'details') {
    startDetailsLayer(viewDeps, config.parentOrigin);
    return;
  }

  const reporter = new IframeHeightReporter(window, config.parentOrigin);
  if (reporter.isEmbedded) document.documentElement.classList.add('is-embedded');
  // With embed.js on the host page, details open in its full-screen details layer.
  const bridge = reporter.isEmbedded
    ? new DetailsBridge(window, config.parentOrigin, {
        onClosed: (eventId) => {
          view.restoreFocus(eventId);
        },
        onMonth: (month) => void view.show(month),
        onFallback: (request) => void view.openRequest(request),
      })
    : undefined;

  const view = new CalendarView(
    {
      ...viewDeps,
      root,
      ...(bridge ? { detailsDelegate: (request) => bridge.open(request) } : {}),
      onMonthShown: (month, filter) => bridge?.monthShown(month, filter),
      onRender: () => {
        reporter.report();
      },
    },
    config.initialMonth,
  );

  reporter.start();
  bridge?.start();
  if (reporter.isEmbedded) {
    // Without a details layer: keep the dialog inside the part of the iframe that is on screen.
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

/**
 * The details layer (`?mode=details`): a transparent, full-screen iframe that
 * public/embed.js keeps ready over the host page. It renders no grid, only the
 * event dialog with its backdrop, and opens whatever the main calendar asks for.
 */
function startDetailsLayer(deps: Omit<CalendarViewDeps, 'root'>, parentOrigin: string): void {
  document.documentElement.classList.add('is-embedded', 'is-details-layer');
  const client: DetailsPageClient = new DetailsPageClient(window, parentOrigin, {
    onRequest: (request) => {
      void view.openRequest(request).then((found) => {
        if (!found) client.closed(undefined);
      });
    },
    onPrefetch: (month, filter) => void view.prefetch(month, filter),
    onShown: () => {
      view.focusDetails();
    },
    onCancel: () => {
      view.closeDetails();
    },
  });
  const view = new CalendarView({
    ...deps,
    // The grid is rendered but never shown; it keeps the month data for prev/next and "n / N".
    root: document.createElement('div'),
    onEventNavigated: (month) => {
      client.navigated(month);
    },
    onDetailsShown: () => {
      client.ready();
    },
    onDetailsClosed: (eventId) => {
      client.closed(eventId);
    },
  });
  client.start();
  void view.show(view.month);
}

bootstrap();
