import type { CalendarService } from '../../application';
import { addMonths, yearMonthOf, type Clock, type Weekday, type YearMonth } from '../../domain';
import type { CalendarFormatter } from '../calendar-formatter';
import { h } from '../dom';
import { EventText } from '../event-text';
import { icon } from '../icons';
import type { Messages } from '../messages';
import { buildPosterContent } from './poster-content';
import {
  layoutPoster,
  type PosterFormat,
  type PosterLayout,
  type TextMeasurer,
} from './poster-layout';

/** Where the poster is drawn and exported; the page only decides what to draw. */
export interface PosterSurface {
  /** The preview element shown on the page. */
  readonly element: HTMLElement;
  readonly measure: TextMeasurer;
  /** Loads what measuring needs (fonts). Safe to call repeatedly. */
  prepare(): Promise<void>;
  draw(layout: PosterLayout): Promise<void>;
  /** The drawn poster as a PNG, or `undefined` when the browser cannot export it. */
  toBlob(): Promise<Blob | undefined>;
}

export interface PosterPageDeps {
  readonly root: HTMLElement;
  readonly service: CalendarService;
  readonly formatter: CalendarFormatter;
  readonly messages: Messages;
  readonly clock: Clock;
  readonly weekStartsOn: Weekday;
  readonly surface: PosterSurface;
  /** Text of the poster's header pill (the store's website). */
  readonly site?: string | undefined;
  /** Month shown first; by default the one staff most likely want to announce. */
  readonly initialMonth?: YearMonth | undefined;
}

/** After this day of the month, the poster page opens on the next month. */
const ANNOUNCE_NEXT_MONTH_AFTER_DAY = 20;
const FORMATS: readonly PosterFormat[] = ['post', 'cover'];

/**
 * The staff page that turns a month into a PNG for Facebook: pick a month and
 * a format, look at the preview, download the image.
 */
export class PosterPage {
  private month: YearMonth;
  private format: PosterFormat = 'post';
  private sequence = 0;
  private downloadUrl: string | undefined;

  private readonly text: EventText;
  private readonly monthLabel = h('span', { class: 'poster-nav__month', 'aria-live': 'polite' });
  private readonly formatButtons = new Map<PosterFormat, HTMLButtonElement>();
  private readonly status = h('p', { class: 'poster-status', role: 'status' });
  private readonly download: HTMLAnchorElement;

  constructor(private readonly deps: PosterPageDeps) {
    const { messages, clock } = deps;
    this.text = new EventText(deps.formatter, messages);
    const today = clock.today();
    const current = yearMonthOf(today);
    this.month =
      deps.initialMonth ??
      (today.day > ANNOUNCE_NEXT_MONTH_AFTER_DAY ? addMonths(current, 1) : current);

    const arrow = (label: string, direction: 1 | -1) => {
      const button = h(
        'button',
        { type: 'button', class: 'poster-nav__arrow', 'aria-label': label },
        icon(direction === 1 ? 'chevron-right' : 'chevron-left'),
      );
      button.addEventListener('click', () => void this.show(addMonths(this.month, direction)));
      return button;
    };
    for (const format of FORMATS) {
      const button = h(
        'button',
        { type: 'button', class: 'poster-format', 'data-format': format },
        format === 'post' ? messages.poster.post : messages.poster.cover,
      );
      button.addEventListener('click', () => void this.show(this.month, format));
      this.formatButtons.set(format, button);
    }
    this.download = h('a', { class: 'poster-download', hidden: true }, messages.poster.download);

    deps.root.replaceChildren(
      h(
        'section',
        { class: 'poster' },
        h('h1', { class: 'poster__heading' }, messages.poster.heading),
        h(
          'div',
          { class: 'poster__controls' },
          h(
            'div',
            { class: 'poster-nav', role: 'group', 'aria-label': messages.monthNav },
            arrow(messages.previousMonth, -1),
            this.monthLabel,
            arrow(messages.nextMonth, 1),
          ),
          h(
            'div',
            { class: 'poster-formats', role: 'group', 'aria-label': messages.poster.format },
            ...this.formatButtons.values(),
          ),
          this.download,
        ),
        this.status,
        h('div', { class: 'poster__preview' }, deps.surface.element),
      ),
    );
  }

  get shownMonth(): YearMonth {
    return this.month;
  }

  /** Draws the poster for `month` in `format`. Never rejects: failures show a retry button. */
  async show(month: YearMonth = this.month, format: PosterFormat = this.format): Promise<void> {
    const { deps } = this;
    const { messages, surface } = deps;
    const run = ++this.sequence;
    this.month = month;
    this.format = format;
    this.monthLabel.textContent = `${deps.formatter.monthName(month)} ${String(month.year)}`;
    for (const [key, button] of this.formatButtons) {
      button.setAttribute('aria-pressed', String(key === format));
    }
    this.setDownload(undefined);
    this.status.replaceChildren(messages.poster.preparing);

    try {
      const [view] = await Promise.all([deps.service.getMonthView(month), surface.prepare()]);
      if (run !== this.sequence) return;
      const content = buildPosterContent(view, {
        formatter: deps.formatter,
        text: this.text,
        weekStartsOn: deps.weekStartsOn,
        site: deps.site,
      });
      const layout = layoutPoster(content, format, surface.measure);
      await surface.draw(layout);
      const blob = await surface.toBlob();
      if (run !== this.sequence) return;
      if (!blob) throw new Error('The browser could not export the poster');

      const name = `kalendarz-${String(month.year)}-${String(month.month).padStart(2, '0')}-${format}.png`;
      this.setDownload({ blob, name });
      const empty = content.weeks.every((week) => week.every((day) => day.events.length === 0));
      this.status.replaceChildren(
        empty
          ? messages.eventsInMonth(0)
          : layout.hiddenEvents > 0
            ? messages.poster.hidden(layout.hiddenEvents)
            : '',
      );
    } catch (error) {
      if (run !== this.sequence) return;
      console.error('[poster] could not draw the poster', error);
      const retry = h('button', { type: 'button', class: 'poster-retry' }, messages.retry);
      retry.addEventListener('click', () => void this.show());
      this.status.replaceChildren(messages.loadError, ' ', retry);
    }
  }

  /** Points the download link at a new image (or hides it) and frees the previous one. */
  private setDownload(file: { blob: Blob; name: string } | undefined): void {
    if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl);
    this.downloadUrl = file ? URL.createObjectURL(file.blob) : undefined;
    this.download.hidden = !file;
    if (file && this.downloadUrl) {
      this.download.href = this.downloadUrl;
      this.download.download = file.name;
    } else {
      this.download.removeAttribute('href');
      this.download.removeAttribute('download');
    }
  }
}
