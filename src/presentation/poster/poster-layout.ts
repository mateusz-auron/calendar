/**
 * Pure layout of the monthly poster (the PNG for Facebook): turns the month's
 * content into a flat list of drawing operations. No DOM and no canvas here, so
 * every size and overflow rule is unit-testable; `paintPoster` draws the list.
 *
 * Two formats, both a 7-column month grid in the look of the calendar page:
 * - `post`: 4:5 portrait for a feed post, full event tiles;
 * - `cover`: 16:9 for the page's cover photo, one compact row per week. Facebook
 *   crops the top and bottom of a cover on desktop, so everything stays inside
 *   the middle band ({@link COVER_SAFE_BAND}).
 */
export type PosterFormat = 'post' | 'cover';

export interface PosterFont {
  readonly family: 'display' | 'body';
  readonly size: number;
  readonly weight: number;
  /** Extra space between letters, in px. */
  readonly letterSpacing?: number;
}

export interface PosterShadow {
  readonly offsetY: number;
  readonly blur: number;
  readonly color: string;
}

export type PosterOp =
  | {
      readonly kind: 'rect';
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
      readonly radius?: number;
      readonly fill?: string;
      readonly stroke?: string;
      readonly shadow?: PosterShadow;
    }
  /** `y` is the text baseline. */
  | {
      readonly kind: 'text';
      readonly x: number;
      readonly y: number;
      readonly text: string;
      readonly font: PosterFont;
      readonly color: string;
    }
  /** The image is fitted inside the box, keeping its aspect ratio. */
  | {
      readonly kind: 'image';
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
      readonly src: string;
    }
  /** Clips everything up to the matching `unclip` to a rounded box. */
  | {
      readonly kind: 'clip';
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
      readonly radius: number;
    }
  | { readonly kind: 'unclip' };

export interface PosterEvent {
  readonly title: string;
  readonly time: string;
  readonly format?: string;
  /** Logo image URL. */
  readonly logo: string;
  readonly logoBg: string;
}

export interface PosterDay {
  readonly number: string;
  /** A leading/trailing day of another month. */
  readonly outside: boolean;
  readonly weekend: boolean;
  readonly events: readonly PosterEvent[];
}

export interface PosterContent {
  /** Month name, e.g. "Grudzień". */
  readonly title: string;
  readonly year: string;
  /** Text of the pill in the header, e.g. the store's website; omitted ⇒ no pill. */
  readonly site?: string;
  /** Seven weekday labels in grid order. */
  readonly weekdays: readonly string[];
  /** 4–6 weeks of seven days. */
  readonly weeks: readonly (readonly PosterDay[])[];
}

export interface PosterLayout {
  readonly format: PosterFormat;
  /** Logical size; all operations use these units. */
  readonly width: number;
  readonly height: number;
  /** Output pixels per logical unit. */
  readonly scale: number;
  readonly ops: readonly PosterOp[];
  /** Events that did not fit and are only counted in a "+N" marker. */
  readonly hiddenEvents: number;
}

export type TextMeasurer = (text: string, font: PosterFont) => number;

/** Vertical band of the cover (logical px) that survives Facebook's desktop crop. */
export const COVER_SAFE_BAND = { top: 110, bottom: 566 } as const;

const COLOR = {
  page: '#F4F1FA',
  fg: '#171a21',
  fg2: '#3b414c',
  muted: '#5b6270',
  faint: '#9aa0aa',
  outside: '#b3b8c1',
  white: '#ffffff',
  accent: '#9A17FA',
  cardBorder: '#E3DAF3',
  line: '#eef0f3',
  headBorder: '#e6e8ec',
  head: '#f7f8fa',
  headWeekend: '#eceef2',
  weekend: '#f5f6f8',
  outsideBg: '#f9fafb',
  outsideWeekend: '#eef0f3',
  chip: '#f1f2f5',
} as const;

const DAYS = 7;
const LINE_HEIGHT = 1.4;
const ELLIPSIS = '…';

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const body = (size: number, weight: number, letterSpacing?: number): PosterFont => ({
  family: 'body',
  size,
  weight,
  ...(letterSpacing === undefined ? {} : { letterSpacing }),
});

/** Baseline of text set in a line box that starts at `top` (matches CSS line boxes closely). */
function baseline(top: number, lineHeight: number, font: PosterFont): number {
  return top + lineHeight / 2 + font.size * (font.family === 'display' ? 0.34 : 0.36);
}

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

/** `text`, or its longest prefix that fits `maxWidth` with an ellipsis. */
export function fitText(
  text: string,
  font: PosterFont,
  maxWidth: number,
  measure: TextMeasurer,
): string {
  if (measure(text, font) <= maxWidth) return text;
  let cut = text.length - 1;
  while (cut > 0 && measure(text.slice(0, cut).trimEnd() + ELLIPSIS, font) > maxWidth) cut--;
  return text.slice(0, cut).trimEnd() + ELLIPSIS;
}

/** Word-wraps `text` into at most `maxLines` lines; what does not fit ends with an ellipsis. */
export function wrapText(
  text: string,
  font: PosterFont,
  maxWidth: number,
  maxLines: number,
  measure: TextMeasurer,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const candidate = line ? `${line} ${words[i] ?? ''}` : (words[i] ?? '');
    if (!line || measure(candidate, font) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (lines.length === maxLines - 1) {
      // Last allowed line: keep filling it and cut with an ellipsis.
      line = `${line} ${words.slice(i).join(' ')}`;
      break;
    }
    lines.push(line);
    line = words[i] ?? '';
  }
  if (line) lines.push(line);
  return lines.map((l) => fitText(l, font, maxWidth, measure));
}

interface HeaderSpec {
  readonly x: number;
  readonly right: number;
  readonly top: number;
  readonly titleSize: number;
  readonly siteSize: number;
  readonly sitePad: { readonly x: number; readonly top: number; readonly bottom: number };
}

/** Month name with a grey year, and the site pill on the right. Returns the header height. */
function header(
  ops: PosterOp[],
  content: PosterContent,
  measure: TextMeasurer,
  spec: HeaderSpec,
): number {
  const titleFont: PosterFont = {
    family: 'display',
    size: spec.titleSize,
    weight: 800,
    letterSpacing: -0.02 * spec.titleSize,
  };
  const yearFont: PosterFont = { ...titleFont, weight: 700 };
  const siteFont: PosterFont = { family: 'display', size: spec.siteSize, weight: 800 };
  const siteLine = spec.siteSize * LINE_HEIGHT;
  const pillHeight = content.site ? spec.sitePad.top + siteLine + spec.sitePad.bottom : 0;
  const height = Math.max(spec.titleSize, pillHeight);

  let titleRight = spec.right;
  if (content.site) {
    const pillTop = spec.top + (height - pillHeight) / 2;
    const maxText = (spec.right - spec.x) / 2 - 2 * spec.sitePad.x;
    const site = fitText(content.site, siteFont, maxText, measure);
    const pillWidth = measure(site, siteFont) + 2 * spec.sitePad.x;
    const pillX = spec.right - pillWidth;
    titleRight = pillX - spec.titleSize * 0.4;
    ops.push(
      {
        kind: 'rect',
        x: pillX,
        y: pillTop,
        w: pillWidth,
        h: pillHeight,
        radius: pillHeight / 2,
        fill: COLOR.fg,
      },
      {
        kind: 'text',
        x: pillX + spec.sitePad.x,
        y: baseline(pillTop + spec.sitePad.top, siteLine, siteFont),
        text: site,
        font: siteFont,
        color: COLOR.white,
      },
    );
  }

  const titleY = baseline(spec.top, height, titleFont);
  const gap = spec.titleSize * 0.26;
  const yearWidth = measure(content.year, yearFont);
  const title = fitText(content.title, titleFont, titleRight - spec.x - gap - yearWidth, measure);
  ops.push(
    { kind: 'text', x: spec.x, y: titleY, text: title, font: titleFont, color: COLOR.fg },
    {
      kind: 'text',
      x: spec.x + measure(title, titleFont) + gap,
      y: titleY,
      text: content.year,
      font: yearFont,
      color: COLOR.faint,
    },
  );
  return height;
}

interface GridSpec {
  readonly box: Box;
  readonly radius: number;
  readonly shadow: PosterShadow;
  readonly headFont: PosterFont;
  readonly headPad: { readonly x: number; readonly y: number };
  readonly rowHeights: readonly number[];
}

/** Height of the weekday header row (text line + padding + bottom border). */
function headHeight(spec: Pick<GridSpec, 'headFont' | 'headPad'>): number {
  return spec.headFont.size * LINE_HEIGHT + 2 * spec.headPad.y + 1;
}

/** The white grid card: weekday header, cell backgrounds and lines. Calls `cell` for each day. */
function grid(
  ops: PosterOp[],
  content: PosterContent,
  spec: GridSpec,
  cell: (day: PosterDay, box: Box) => void,
): void {
  const { box } = spec;
  const colWidth = box.w / DAYS;
  const headH = headHeight(spec);
  const weekendColumns = Array.from({ length: DAYS }, (_, i) =>
    content.weeks.some((week) => week[i]?.weekend === true),
  );

  ops.push(
    { kind: 'rect', ...box, radius: spec.radius, fill: COLOR.white, shadow: spec.shadow },
    { kind: 'clip', ...box, radius: spec.radius },
  );
  for (let i = 0; i < DAYS; i++) {
    const x = box.x + i * colWidth;
    ops.push(
      {
        kind: 'rect',
        x,
        y: box.y,
        w: colWidth,
        h: headH - 1,
        fill: weekendColumns[i] ? COLOR.headWeekend : COLOR.head,
      },
      {
        kind: 'text',
        x: x + spec.headPad.x,
        y: baseline(box.y + spec.headPad.y, spec.headFont.size * LINE_HEIGHT, spec.headFont),
        text: content.weekdays[i] ?? '',
        font: spec.headFont,
        color: weekendColumns[i] ? COLOR.fg2 : COLOR.muted,
      },
    );
  }
  ops.push({
    kind: 'rect',
    x: box.x,
    y: box.y + headH - 1,
    w: box.w,
    h: 1,
    fill: COLOR.headBorder,
  });

  let y = box.y + headH;
  content.weeks.forEach((week, w) => {
    const rowH = spec.rowHeights[w] ?? 0;
    week.forEach((day, i) => {
      const cellBox = { x: box.x + i * colWidth, y, w: colWidth, h: rowH };
      const fill = day.outside
        ? day.weekend
          ? COLOR.outsideWeekend
          : COLOR.outsideBg
        : day.weekend
          ? COLOR.weekend
          : undefined;
      if (fill) ops.push({ kind: 'rect', ...cellBox, fill });
      if (i < DAYS - 1) {
        ops.push({ kind: 'rect', x: cellBox.x + colWidth - 1, y, w: 1, h: rowH, fill: COLOR.line });
      }
      cell(day, cellBox);
    });
    if (w < content.weeks.length - 1) {
      ops.push({ kind: 'rect', x: box.x, y: y + rowH - 1, w: box.w, h: 1, fill: COLOR.line });
    }
    y += rowH;
  });
  ops.push(
    { kind: 'unclip' },
    { kind: 'rect', ...box, radius: spec.radius, stroke: COLOR.cardBorder },
  );
}

interface NumberSpec {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly height: number;
  readonly radius: number;
}

/** The day number (a purple badge on event days) and a "+N" marker for events that did not fit. */
function dayNumber(
  ops: PosterOp[],
  day: PosterDay,
  hidden: number,
  measure: TextMeasurer,
  spec: NumberSpec,
): void {
  const hasEvents = day.events.length > 0;
  const font = body(spec.size, hasEvents ? 700 : 600);
  const width = Math.max(spec.height, measure(day.number, font) + 10);
  if (hasEvents) {
    ops.push({
      kind: 'rect',
      x: spec.x,
      y: spec.y,
      w: width,
      h: spec.height,
      radius: spec.radius,
      fill: COLOR.accent,
    });
  }
  ops.push({
    kind: 'text',
    x: spec.x + (width - measure(day.number, font)) / 2,
    y: baseline(spec.y, spec.height, font),
    text: day.number,
    font,
    color: hasEvents ? COLOR.white : day.outside ? COLOR.outside : COLOR.fg,
  });
  if (hidden > 0) {
    const more = body(spec.size - 1, 700);
    ops.push({
      kind: 'text',
      x: spec.x + width + 5,
      y: baseline(spec.y, spec.height, more),
      text: `+${String(hidden)}`,
      font: more,
      color: COLOR.accent,
    });
  }
}

// ---- Post (4:5) ----

const POST = { width: 960, height: 1200, scale: 2.25, padding: 34, gap: 20 } as const;
const POST_CELL = {
  padX: 6,
  padY: 5,
  numHeight: 22,
  numGap: 4,
  tileGap: 6,
  compactRow: 44,
} as const;
const POST_TITLE = body(13.5, 700);
const POST_TIME = body(12.5, 600);
const POST_FORMAT = body(11, 700);
const POST_TITLE_LINE = POST_TITLE.size * 1.2;
const POST_TIME_LINE = POST_TIME.size * LINE_HEIGHT;
const POST_FORMAT_HEIGHT = POST_FORMAT.size * 1.2 + 8;

/** How much of a tile is shown; later levels are used when the month does not fit. */
interface Density {
  readonly logoHeight: number;
  readonly titleLines: number;
  readonly showFormat: boolean;
}

const DENSITIES: readonly Density[] = [
  { logoHeight: 44, titleLines: 2, showFormat: true },
  { logoHeight: 44, titleLines: 2, showFormat: false },
  { logoHeight: 34, titleLines: 1, showFormat: false },
  { logoHeight: 26, titleLines: 1, showFormat: false },
];
const LAST_DENSITY: Density = { logoHeight: 26, titleLines: 1, showFormat: false };
const MAX_TILES_WHEN_TIGHT = 4;

function postTileHeight(
  event: PosterEvent,
  density: Density,
  textWidth: number,
  measure: TextMeasurer,
): number {
  const lines = wrapText(event.title, POST_TITLE, textWidth, density.titleLines, measure).length;
  const format = density.showFormat && event.format ? 3 + POST_FORMAT_HEIGHT : 0;
  return 2 + density.logoHeight + 6 + lines * POST_TITLE_LINE + 3 + POST_TIME_LINE + format + 7;
}

/**
 * Row heights that fill `available`: weeks without events stay low, the others
 * share the rest equally unless one needs more than its share.
 */
function distribute(
  needs: readonly number[],
  flexible: readonly boolean[],
  available: number,
): number[] {
  const heights = [...needs];
  let open = needs.map((_, i) => i).filter((i) => flexible[i] === true);
  if (open.length === 0) open = needs.map((_, i) => i);
  let room = available - sum(needs.filter((_, i) => !open.includes(i)));
  for (;;) {
    const share = room / open.length;
    const tall = open.filter((i) => (needs[i] ?? 0) > share);
    if (tall.length === 0 || tall.length === open.length) {
      const leftover = tall.length === 0 ? share : undefined;
      for (const i of open) heights[i] = leftover ?? needs[i] ?? 0;
      return heights;
    }
    room -= sum(tall.map((i) => needs[i] ?? 0));
    open = open.filter((i) => !tall.includes(i));
  }
}

function layoutPost(content: PosterContent, measure: TextMeasurer): PosterLayout {
  const ops: PosterOp[] = [
    { kind: 'rect', x: 0, y: 0, w: POST.width, h: POST.height, fill: COLOR.page },
  ];
  const headerHeight = header(ops, content, measure, {
    x: POST.padding + 4,
    right: POST.width - POST.padding - 4,
    top: POST.padding,
    titleSize: 64,
    siteSize: 24,
    sitePad: { x: 22, top: 9, bottom: 11 },
  });
  const top = POST.padding + headerHeight + POST.gap;
  const box = {
    x: POST.padding,
    y: top,
    w: POST.width - 2 * POST.padding,
    h: POST.height - POST.padding - top,
  };
  const head = { headFont: body(13, 700, 0.78), headPad: { x: 10, y: 12 } };
  const available = box.h - headHeight(head);
  const tileWidth = box.w / DAYS - 2 * POST_CELL.padX;
  const textWidth = tileWidth - 2 - 16;
  const chrome = POST_CELL.padY + POST_CELL.numHeight + POST_CELL.numGap + POST_CELL.padY + 1;

  const weekNeed = (week: readonly PosterDay[], density: Density, cap: number): number => {
    const tallest = Math.max(
      0,
      ...week.map((day) => {
        const shown = day.events.slice(0, cap);
        const tiles = shown.map((e) => postTileHeight(e, density, textWidth, measure));
        return sum(tiles) + Math.max(0, shown.length - 1) * POST_CELL.tileGap;
      }),
    );
    return tallest === 0 ? POST_CELL.compactRow : chrome + tallest;
  };
  const flexible = content.weeks.map((week) => week.some((day) => day.events.length > 0));

  // Show every event if any tile size allows it; otherwise the most tiles per day that fit,
  // in the richest tile size, with a "+N" marker for the rest.
  const caps = [
    Number.POSITIVE_INFINITY,
    ...Array.from({ length: MAX_TILES_WHEN_TIGHT }, (_, i) => MAX_TILES_WHEN_TIGHT - i),
  ];
  const plan = caps
    .flatMap((cap) => DENSITIES.map((density) => ({ density, cap })))
    .find(
      ({ density, cap }) => sum(content.weeks.map((w) => weekNeed(w, density, cap))) <= available,
    ) ?? { density: LAST_DENSITY, cap: 1 };
  const { density, cap } = plan;
  const rowHeights = distribute(
    content.weeks.map((w) => weekNeed(w, density, cap)),
    flexible,
    available,
  );

  let hiddenEvents = 0;
  grid(
    ops,
    content,
    {
      box,
      radius: 22,
      shadow: { offsetY: 14, blur: 40, color: 'rgba(90, 20, 160, 0.10)' },
      ...head,
      rowHeights,
    },
    (day, cellBox) => {
      const shown = day.events.slice(0, cap);
      const hidden = day.events.length - shown.length;
      hiddenEvents += hidden;
      dayNumber(ops, day, hidden, measure, {
        x: cellBox.x + POST_CELL.padX,
        y: cellBox.y + POST_CELL.padY,
        size: 14,
        height: POST_CELL.numHeight,
        radius: 6,
      });
      let y = cellBox.y + POST_CELL.padY + POST_CELL.numHeight + POST_CELL.numGap;
      for (const event of shown) {
        const height = postTileHeight(event, density, textWidth, measure);
        postTile(
          ops,
          event,
          density,
          { x: cellBox.x + POST_CELL.padX, y, w: tileWidth, h: height },
          measure,
        );
        y += height + POST_CELL.tileGap;
      }
    },
  );
  return {
    format: 'post',
    width: POST.width,
    height: POST.height,
    scale: POST.scale,
    ops,
    hiddenEvents,
  };
}

/** One event tile: logo on the game's background, title, time and (when it fits) the format pill. */
function postTile(
  ops: PosterOp[],
  event: PosterEvent,
  density: Density,
  box: Box,
  measure: TextMeasurer,
): void {
  const radius = 12;
  const logoPadY = density.logoHeight >= 44 ? 7 : density.logoHeight >= 34 ? 5 : 4;
  const textX = box.x + 1 + 8;
  const textWidth = box.w - 2 - 16;
  ops.push(
    {
      kind: 'rect',
      ...box,
      radius,
      fill: COLOR.white,
      shadow: { offsetY: 4, blur: 12, color: 'rgba(90, 20, 160, 0.10)' },
    },
    { kind: 'clip', ...box, radius },
    { kind: 'rect', x: box.x, y: box.y, w: box.w, h: 1 + density.logoHeight, fill: event.logoBg },
    { kind: 'unclip' },
    {
      kind: 'image',
      x: box.x + 1 + 10,
      y: box.y + 1 + logoPadY,
      w: box.w - 2 - 20,
      h: density.logoHeight - 2 * logoPadY,
      src: event.logo,
    },
    { kind: 'rect', ...box, radius, stroke: COLOR.cardBorder },
  );

  let y = box.y + 1 + density.logoHeight + 6;
  for (const line of wrapText(event.title, POST_TITLE, textWidth, density.titleLines, measure)) {
    ops.push({
      kind: 'text',
      x: textX,
      y: baseline(y, POST_TITLE_LINE, POST_TITLE),
      text: line,
      font: POST_TITLE,
      color: COLOR.fg,
    });
    y += POST_TITLE_LINE;
  }
  y += 3;
  ops.push({
    kind: 'text',
    x: textX,
    y: baseline(y, POST_TIME_LINE, POST_TIME),
    text: fitText(event.time, POST_TIME, textWidth, measure),
    font: POST_TIME,
    color: COLOR.fg2,
  });
  y += POST_TIME_LINE + 3;
  if (density.showFormat && event.format) {
    const label = fitText(event.format, POST_FORMAT, textWidth - 14, measure);
    ops.push(
      {
        kind: 'rect',
        x: textX,
        y,
        w: measure(label, POST_FORMAT) + 14,
        h: POST_FORMAT_HEIGHT,
        radius: 6,
        fill: COLOR.chip,
      },
      {
        kind: 'text',
        x: textX + 7,
        y: baseline(y, POST_FORMAT_HEIGHT, POST_FORMAT),
        text: label,
        font: POST_FORMAT,
        color: COLOR.fg2,
      },
    );
  }
}

// ---- Cover (16:9) ----

const COVER = { width: 1200, height: 676, scale: 2, padding: 40, gap: 14, maxRow: 72 } as const;
const COVER_TITLE = body(12, 700);
const COVER_TIME = body(11.5, 600);
const COVER_TITLE_LINE = COVER_TITLE.size * 1.15;
const COVER_TIME_LINE = COVER_TIME.size * LINE_HEIGHT;
const COVER_LOGO = { width: 54, height: 36, top: 29 } as const;

function layoutCover(content: PosterContent, measure: TextMeasurer): PosterLayout {
  const ops: PosterOp[] = [
    { kind: 'rect', x: 0, y: 0, w: COVER.width, h: COVER.height, fill: COLOR.page },
  ];
  const head = { headFont: body(11, 700, 0.66), headPad: { x: 8, y: 7 } };
  const titleSize = 46;
  const band = COVER_SAFE_BAND.bottom - COVER_SAFE_BAND.top;
  const rowHeight = Math.min(
    COVER.maxRow,
    Math.floor((band - titleSize - COVER.gap - headHeight(head)) / content.weeks.length),
  );
  const gridHeight = headHeight(head) + rowHeight * content.weeks.length;
  const top = (COVER.height - (titleSize + COVER.gap + gridHeight)) / 2;

  const headerHeight = header(ops, content, measure, {
    x: COVER.padding + 4,
    right: COVER.width - COVER.padding - 4,
    top,
    titleSize,
    siteSize: 21,
    sitePad: { x: 20, top: 7, bottom: 9 },
  });
  const box = {
    x: COVER.padding,
    y: top + headerHeight + COVER.gap,
    w: COVER.width - 2 * COVER.padding,
    h: gridHeight,
  };
  const titleLines = rowHeight >= 70 ? 2 : 1;

  let hiddenEvents = 0;
  grid(
    ops,
    content,
    {
      box,
      radius: 16,
      shadow: { offsetY: 10, blur: 30, color: 'rgba(90, 20, 160, 0.10)' },
      ...head,
      rowHeights: content.weeks.map(() => rowHeight),
    },
    (day, cellBox) => {
      // A cover row holds one event per day; the rest are counted next to the day number.
      const [event] = day.events;
      const hidden = Math.max(0, day.events.length - 1);
      hiddenEvents += hidden;
      dayNumber(ops, day, hidden, measure, {
        x: cellBox.x + 6,
        y: cellBox.y + 5,
        size: 12,
        height: 18,
        radius: 5,
      });
      if (!event) return;

      const logoTop = rowHeight >= 70 ? COVER_LOGO.top : 25;
      const logoHeight = Math.min(COVER_LOGO.height, rowHeight - logoTop - 6);
      const logo = { x: cellBox.x + 5, y: cellBox.y + logoTop, w: COVER_LOGO.width, h: logoHeight };
      ops.push(
        {
          kind: 'rect',
          ...logo,
          radius: 7,
          fill: event.logoBg,
          shadow: { offsetY: 2, blur: 6, color: 'rgba(90, 20, 160, 0.14)' },
        },
        {
          kind: 'image',
          x: logo.x + 5,
          y: logo.y + 4,
          w: logo.w - 10,
          h: logo.h - 8,
          src: event.logo,
        },
      );

      const textX = logo.x + logo.w + 8;
      const textWidth = cellBox.x + cellBox.w - 8 - textX;
      const lines = wrapText(event.title, COVER_TITLE, textWidth, titleLines, measure);
      const blockHeight = lines.length * COVER_TITLE_LINE + 2 + COVER_TIME_LINE;
      let y = cellBox.y + 4 + (rowHeight - 9 - blockHeight) / 2;
      for (const line of lines) {
        ops.push({
          kind: 'text',
          x: textX,
          y: baseline(y, COVER_TITLE_LINE, COVER_TITLE),
          text: line,
          font: COVER_TITLE,
          color: COLOR.fg,
        });
        y += COVER_TITLE_LINE;
      }
      ops.push({
        kind: 'text',
        x: textX,
        y: baseline(y + 2, COVER_TIME_LINE, COVER_TIME),
        text: fitText(event.time, COVER_TIME, textWidth, measure),
        font: COVER_TIME,
        color: COLOR.fg2,
      });
    },
  );
  return {
    format: 'cover',
    width: COVER.width,
    height: COVER.height,
    scale: COVER.scale,
    ops,
    hiddenEvents,
  };
}

export function layoutPoster(
  content: PosterContent,
  format: PosterFormat,
  measure: TextMeasurer,
): PosterLayout {
  return format === 'post' ? layoutPost(content, measure) : layoutCover(content, measure);
}
