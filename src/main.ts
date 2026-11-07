import './presentation/styles.css';

import { CalendarService } from './application';
import { parseConfig } from './config/app-config';
import { IframeHeightReporter } from './embed/iframe-height-reporter';
import { DemoEventRepository, SystemClock } from './infrastructure';
import { CalendarFormatter, CalendarView } from './presentation';

/**
 * Composition root — the only place that knows concrete implementations.
 * Swap `DemoEventRepository` for a real adapter here; nothing else changes.
 */
function bootstrap(): void {
  const root = document.getElementById('app');
  if (!root) throw new Error('Missing #app root element');

  const config = parseConfig(window.location.search, navigator.language);
  if (config.theme !== 'auto') document.documentElement.dataset.theme = config.theme;
  document.documentElement.lang = config.locale;

  const clock = new SystemClock();
  const repository = new DemoEventRepository({ eventUrl: config.eventUrl });
  const service = new CalendarService(repository, clock, { weekStartsOn: config.weekStartsOn });
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
