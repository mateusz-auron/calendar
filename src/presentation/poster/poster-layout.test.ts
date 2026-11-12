import { describe, expect, it } from 'vitest';

import {
  COVER_SAFE_BAND,
  fitText,
  layoutPoster,
  wrapText,
  type PosterContent,
  type PosterDay,
  type PosterEvent,
  type PosterFont,
  type PosterLayout,
  type PosterOp,
  type TextMeasurer,
} from './poster-layout';

/** Every character is 0.55 em wide: deterministic and close to the real fonts. */
const measure: TextMeasurer = (text, font) => text.length * font.size * 0.55;
const FONT: PosterFont = { family: 'body', size: 10, weight: 700 };

const event = (title: string, extra: Partial<PosterEvent> = {}): PosterEvent => ({
  title,
  time: '18:00–22:00',
  format: 'Standard',
  logo: `logo:${title}`,
  logoBg: '#E3ECFD',
  ...extra,
});

/** A month that starts on the given grid column, with `events(day)` on each day. */
function month(
  days: number,
  firstColumn: number,
  events: (day: number) => readonly PosterEvent[] = () => [],
): PosterContent {
  const cells: PosterDay[] = [];
  for (let i = 0; i < firstColumn; i++) {
    cells.push({
      number: String(30 - firstColumn + i + 1),
      outside: true,
      weekend: i >= 5,
      events: [],
    });
  }
  for (let day = 1; day <= days; day++) {
    cells.push({
      number: String(day),
      outside: false,
      weekend: cells.length % 7 >= 5,
      events: events(day),
    });
  }
  for (let next = 1; cells.length % 7 !== 0; next++) {
    cells.push({ number: String(next), outside: true, weekend: cells.length % 7 >= 5, events: [] });
  }
  const weeks: PosterDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return {
    title: 'Grudzień',
    year: '2026',
    site: 'booster-ziomki.pl',
    weekdays: ['PON', 'WT', 'ŚR', 'CZW', 'PT', 'SOB', 'NIEDZ'],
    weeks,
  };
}

/** December 2026 with the store's rhythm: Monday, Tuesday, Friday and Saturday. */
const december = month(31, 1, (day) => {
  const column = day % 7; // the 1st is a Tuesday (column 1)
  return [0, 1, 4, 5].includes(column) ? [event(`Turniej ${String(day)}`)] : [];
});

const texts = (layout: PosterLayout): string[] =>
  layout.ops.flatMap((op) => (op.kind === 'text' ? [op.text] : []));

type Boxed = Extract<PosterOp, { x: number }>;
interface OpBox {
  op: Boxed;
  left: number;
  right: number;
  top: number;
  bottom: number;
}
const boxes = (layout: PosterLayout): OpBox[] =>
  layout.ops.flatMap((op): OpBox[] => {
    if (op.kind === 'unclip') return [];
    if (op.kind === 'text') {
      const width = measure(op.text, op.font);
      return [
        {
          op,
          left: op.x,
          right: op.x + width,
          top: op.y - op.font.size * 0.8,
          bottom: op.y + op.font.size * 0.3,
        },
      ];
    }
    return [{ op, left: op.x, right: op.x + op.w, top: op.y, bottom: op.y + op.h }];
  });

function expectInside(layout: PosterLayout, top = 0, bottom = layout.height): void {
  for (const box of boxes(layout).slice(1)) {
    expect(box.left, JSON.stringify(box.op)).toBeGreaterThanOrEqual(0);
    expect(box.right, JSON.stringify(box.op)).toBeLessThanOrEqual(layout.width + 0.01);
    expect(box.top, JSON.stringify(box.op)).toBeGreaterThanOrEqual(top - 0.01);
    expect(box.bottom, JSON.stringify(box.op)).toBeLessThanOrEqual(bottom + 0.01);
  }
}

describe('fitText / wrapText', () => {
  it('keeps text that fits and cuts longer text with an ellipsis', () => {
    expect(fitText('Draft', FONT, 100, measure)).toBe('Draft');
    const cut = fitText('Core Constructed', FONT, 60, measure);
    expect(cut.endsWith('…')).toBe(true);
    expect(measure(cut, FONT)).toBeLessThanOrEqual(60);
  });

  it('wraps on words and ends the last allowed line with an ellipsis', () => {
    expect(wrapText('Store Tournament', FONT, 60, 2, measure)).toEqual(['Store', 'Tournament']);
    const lines = wrapText('Wielki Turniej Noworoczny Booster Ziomków', FONT, 80, 2, measure);
    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith('…')).toBe(true);
    expect(wrapText('League Cup', FONT, 200, 2, measure)).toEqual(['League Cup']);
  });
});

describe('layoutPoster: post (4:5)', () => {
  const layout = layoutPoster(december, 'post', measure);

  it('is a 2160 × 2700 image', () => {
    expect([layout.width * layout.scale, layout.height * layout.scale]).toEqual([2160, 2700]);
    expect(layout.format).toBe('post');
  });

  it('shows only the month, the site and the events', () => {
    const all = texts(layout);
    expect(all).toEqual(expect.arrayContaining(['Grudzień', '2026', 'booster-ziomki.pl']));
    expect(all).toEqual(
      expect.arrayContaining(['PON', 'NIEDZ', '31', 'Turniej 1', '18:00–22:00', 'Standard']),
    );
    expect(all.join(' ')).not.toMatch(/wydarze|Zapisy|Kalendarz/i);
    expect(layout.hiddenEvents).toBe(0);
  });

  it('keeps everything inside the image', () => {
    expectInside(layout);
  });

  it('marks event days with the accent colour, and only those', () => {
    const badges = layout.ops.filter((op) => op.kind === 'rect' && op.fill === '#9A17FA');
    expect(badges).toHaveLength(17);
  });

  it('draws one logo per event on the game background', () => {
    const logos = layout.ops.filter((op) => op.kind === 'image');
    expect(logos).toHaveLength(17);
    expect(layout.ops.some((op) => op.kind === 'rect' && op.fill === '#E3ECFD')).toBe(true);
  });

  it('leaves out the pill when no site is configured', () => {
    const noSite: PosterContent = { ...december };
    Reflect.deleteProperty(noSite, 'site');
    expect(texts(layoutPoster(noSite, 'post', measure))).not.toContain('booster-ziomki.pl');
  });

  it('drops the format pill before it hides events in a busy month', () => {
    const busy = month(31, 1, (day) => [event(`A ${String(day)}`), event(`B ${String(day)}`)]);
    const dense = layoutPoster(busy, 'post', measure);
    expect(texts(dense)).not.toContain('Standard');
    expect(texts(dense)).toEqual(expect.arrayContaining(['A 1', 'B 31']));
    expect(dense.hiddenEvents).toBe(0);
    expectInside(dense);
  });

  it('counts what cannot fit in a "+N" marker instead of overflowing', () => {
    const packed = month(31, 6, (day) =>
      Array.from({ length: 6 }, (_, i) => event(`E${String(day)}-${String(i)}`)),
    );
    const dense = layoutPoster(packed, 'post', measure);
    expect(packed.weeks).toHaveLength(6);
    expect(dense.hiddenEvents).toBeGreaterThan(0);
    expect(texts(dense).some((text) => /^\+\d+$/.test(text))).toBe(true);
    expectInside(dense);
  });

  it('gives weeks without events a low row and the rest of the height to the others', () => {
    const sparse = layoutPoster(
      month(31, 1, (day) => (day === 5 ? [event('Solo')] : [])),
      'post',
      measure,
    );
    const numberY = (text: string): number =>
      sparse.ops.flatMap((op) =>
        op.kind === 'text' && op.text === text && op.font.size === 14 ? [op.y] : [],
      )[0] ?? 0;
    // Week 1 (with the event) is tall; weeks 2 and 3 are compact, so 14 → 21 is a small step.
    expect(numberY('7') - numberY('1')).toBeGreaterThan(400);
    expect(numberY('21') - numberY('14')).toBeLessThan(50);
    expectInside(sparse);
  });
});

describe('layoutPoster: cover (16:9)', () => {
  const layout = layoutPoster(december, 'cover', measure);

  it('is a 2400 × 1352 image', () => {
    expect([layout.width * layout.scale, layout.height * layout.scale]).toEqual([2400, 1352]);
  });

  it('keeps everything in the band that survives the desktop crop', () => {
    expectInside(layout, COVER_SAFE_BAND.top, COVER_SAFE_BAND.bottom);
    const sixWeeks = layoutPoster(
      month(31, 6, () => [event('Store Tournament')]),
      'cover',
      measure,
    );
    expectInside(sixWeeks, COVER_SAFE_BAND.top, COVER_SAFE_BAND.bottom);
  });

  it('is a seven-column grid with title and time, without the format pill', () => {
    const all = texts(layout);
    expect(all).toEqual(expect.arrayContaining(['PON', 'WT', 'ŚR', 'CZW', 'PT', 'SOB', 'NIEDZ']));
    expect(all).toEqual(
      expect.arrayContaining(['Grudzień', 'booster-ziomki.pl', 'Turniej 29', '18:00–22:00']),
    );
    expect(all).not.toContain('Standard');
    const mondays = layout.ops.flatMap((op) =>
      op.kind === 'text' && ['7', '14', '21', '28'].includes(op.text) ? [op.x] : [],
    );
    expect(new Set(mondays.map((x) => Math.floor((x - 40) / 160))).size).toBe(1);
  });

  it('shows one event per day and counts the others', () => {
    const double = layoutPoster(
      month(31, 1, (day) => (day === 12 ? [event('First'), event('Second')] : [])),
      'cover',
      measure,
    );
    expect(texts(double)).toContain('First');
    expect(texts(double)).not.toContain('Second');
    expect(texts(double)).toContain('+1');
    expect(double.hiddenEvents).toBe(1);
  });
});
