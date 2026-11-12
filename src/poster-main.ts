import './presentation/fonts.css';
import './presentation/styles.css';
import './presentation/poster/poster.css';

import { SystemClock } from './infrastructure';
import { CalendarFormatter, messagesFor } from './presentation';
// Not part of the presentation barrel: the calendar page must not load the poster code.
import { CanvasPosterSurface, PosterPage } from './presentation/poster';
import { createService, readConfig } from './wiring';

/**
 * Composition root of the poster page: an unlisted staff page that makes the
 * monthly PNG for Facebook. It reads the same events as the calendar (wiring.ts)
 * and is only built when `POSTER_SLUG` is set (vite.config.ts).
 */
function bootstrap(): void {
  const root = document.getElementById('app');
  if (!root) throw new Error('Missing #app root element');

  const config = readConfig(window.location.search);
  const messages = messagesFor(config.locale);
  document.documentElement.lang = config.locale;

  // A staff tool, never part of an embed: refuse to run inside a frame.
  if (window.self !== window.top) {
    root.textContent = messages.poster.framed;
    return;
  }

  const clock = new SystemClock(config.timeZone);
  const page = new PosterPage({
    root,
    service: createService(config, clock),
    formatter: new CalendarFormatter(config.locale),
    messages,
    clock,
    weekStartsOn: config.weekStartsOn,
    surface: new CanvasPosterSurface(document),
    site: config.posterSite,
    initialMonth: config.initialMonth,
  });
  void page.show();
}

bootstrap();
