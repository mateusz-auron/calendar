import type { MonthView } from '../../application';
import type { Weekday } from '../../domain';
import type { CalendarFormatter } from '../calendar-formatter';
import type { EventText } from '../event-text';
import { themeOf } from '../game-theme';
import { genericLogo } from '../icons';
import type { PosterContent, PosterEvent } from './poster-layout';

export interface PosterContentDeps {
  readonly formatter: CalendarFormatter;
  readonly text: EventText;
  readonly weekStartsOn: Weekday;
  /** Text of the header pill (the store's website). */
  readonly site?: string | undefined;
}

let genericLogoUrl: string | undefined;

/** The inline generic logo as an image URL, so the canvas can draw it like the game logos. */
function genericLogoSrc(): string {
  if (!genericLogoUrl) {
    const svg = genericLogo('');
    svg.setAttribute('width', '96');
    svg.setAttribute('height', '64');
    const xml = new XMLSerializer().serializeToString(svg);
    genericLogoUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  }
  return genericLogoUrl;
}

/**
 * The strings and images of a month's poster. Days of the neighbouring months
 * keep their number but not their events: the poster is about one month.
 */
export function buildPosterContent(view: MonthView, deps: PosterContentDeps): PosterContent {
  const { formatter, text } = deps;
  return {
    title: formatter.monthName(view.month),
    year: String(view.month.year),
    ...(deps.site ? { site: deps.site } : {}),
    weekdays: formatter
      .weekdays(deps.weekStartsOn)
      .map((weekday) => weekday.short.toLocaleUpperCase(formatter.locale)),
    weeks: view.weeks.map((week) =>
      week.days.map((day) => ({
        number: String(day.date.day),
        outside: !day.isCurrentMonth,
        weekend: day.isWeekend,
        events: day.isCurrentMonth
          ? day.events.map((card): PosterEvent => {
              const theme = themeOf(card.gameId);
              return {
                title: text.tileTitle(card),
                time: text.time(card.event, day.date),
                ...(card.tileFormat ? { format: text.text(card.tileFormat) } : {}),
                logo: theme.logoUrl ?? genericLogoSrc(),
                logoBg: theme.logoBg,
              };
            })
          : [],
      })),
    ),
  };
}
