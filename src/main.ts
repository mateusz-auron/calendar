import './presentation/fonts.css';
import './presentation/styles.css';

import type { EventLinks } from './domain';
import {
  DetailsBridge,
  DetailsPageClient,
  DialogFocusRequester,
  IframeHeightReporter,
  VisibleAreaTracker,
} from './embed';
import { detectPlatform, GoogleEventLinks, NativeEventLinks, SystemClock } from './infrastructure';
import {
  CalendarFormatter,
  CalendarView,
  messagesFor,
  type CalendarViewDeps,
} from './presentation';
import { createService, readConfig } from './wiring';

/** Google Calendar everywhere; on phones, directions open the native maps app. */
function createLinks(timeZone: string): EventLinks {
  const google = new GoogleEventLinks(timeZone);
  const platform = detectPlatform(navigator);
  return platform === 'other' ? google : new NativeEventLinks(platform, google);
}

/**
 * Composition root of the calendar page (the poster page has its own: poster-main.ts).
 */
function bootstrap(): void {
  const root = document.getElementById('app');
  if (!root) throw new Error('Missing #app root element');

  const config = readConfig(window.location.search);
  document.documentElement.lang = config.locale;

  const clock = new SystemClock(config.timeZone);
  const service = createService(config, clock);
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
