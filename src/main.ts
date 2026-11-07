import './presentation/styles.css';

import { CalendarService } from './application';
import { parseConfig, type AppConfig } from './config/app-config';
import type { EventRepository } from './domain';
import { IframeHeightReporter } from './embed/iframe-height-reporter';
import {
  CachingEventRepository,
  DemoEventRepository,
  GoogleCalendarEventRepository,
  SystemClock,
} from './infrastructure';
import { CalendarFormatter, CalendarView } from './presentation';

/** Chooses the event source: Google Calendar when configured, demo data otherwise. */
function createRepository(config: AppConfig): EventRepository {
  if (!config.google) return new DemoEventRepository({ eventUrl: config.eventUrl });
  return new CachingEventRepository(
    new GoogleCalendarEventRepository({
      ...config.google,
      timeZone: config.timeZone,
      fallbackUrl: config.eventUrl,
      fetch: (input, init) => fetch(input, init),
    }),
  );
}

/**
 * Composition root — the only place that knows concrete implementations.
 */
function bootstrap(): void {
  const root = document.getElementById('app');
  if (!root) throw new Error('Missing #app root element');

  const config = parseConfig(window.location.search, {
    locale: navigator.language,
    timeZone: import.meta.env.VITE_TIME_ZONE || Intl.DateTimeFormat().resolvedOptions().timeZone,
    calendarId: import.meta.env.VITE_GOOGLE_CALENDAR_ID,
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
  });
  if (config.theme !== 'auto') document.documentElement.dataset.theme = config.theme;
  document.documentElement.lang = config.locale;

  const clock = new SystemClock();
  const service = new CalendarService(createRepository(config), clock, {
    weekStartsOn: config.weekStartsOn,
  });
  const reporter = new IframeHeightReporter(window, config.parentOrigin);
  if (reporter.isEmbedded) document.documentElement.classList.add('is-embedded');

  const view = new CalendarView(
    {
      root,
      service,
      formatter: new CalendarFormatter(config.locale),
      clock,
      weekStartsOn: config.weekStartsOn,
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
