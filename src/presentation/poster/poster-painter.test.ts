import { describe, expect, it } from 'vitest';

import type { PosterLayout, PosterOp } from './poster-layout';
import { fontCss, paintPoster, type PosterContext, type PosterImage } from './poster-painter';

/** Records every call and property write, in order. */
function recorder(): { ctx: PosterContext; log: string[] } {
  const log: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get:
        (_, name) =>
        (...args: unknown[]) => {
          log.push(
            `${String(name)}(${args.map((a) => (typeof a === 'number' || typeof a === 'string' ? String(a) : 'img')).join(',')})`,
          );
        },
      set: (_, name, value) => {
        log.push(`${String(name)}=${String(value)}`);
        return true;
      },
      has: () => false,
    },
  ) as PosterContext;
  return { ctx, log };
}

const layout = (ops: PosterOp[], scale = 2): PosterLayout => ({
  format: 'post',
  width: 100,
  height: 100,
  scale,
  ops,
  hiddenEvents: 0,
});

describe('paintPoster', () => {
  it('scales the whole drawing to the output size', () => {
    const { ctx, log } = recorder();
    paintPoster(ctx, layout([], 2.25), new Map());
    expect(log).toEqual(['save()', 'setTransform(2.25,0,0,2.25,0,0)', 'restore()']);
  });

  it('draws text as text, so event data cannot inject markup', () => {
    const { ctx, log } = recorder();
    const font = { family: 'body', size: 12, weight: 700 } as const;
    paintPoster(
      ctx,
      layout([{ kind: 'text', x: 5, y: 20, text: '<b>Turniej</b>', font, color: '#111' }]),
      new Map(),
    );
    expect(log).toContain(`font=${fontCss(font)}`);
    expect(log).toContain('fillText(<b>Turniej</b>,5,20)');
  });

  it('scales shadows by hand, because they ignore the canvas transform', () => {
    const { ctx, log } = recorder();
    const shadow = { offsetY: 4, blur: 12, color: 'rgba(0,0,0,.1)' };
    paintPoster(
      ctx,
      layout([{ kind: 'rect', x: 0, y: 0, w: 10, h: 10, fill: '#fff', shadow }]),
      new Map(),
    );
    expect(log).toContain('shadowBlur=24');
    expect(log).toContain('shadowOffsetY=8');
  });

  it('fits images inside their box and skips the ones that failed to load', () => {
    const { ctx, log } = recorder();
    const images = new Map<string, PosterImage>([
      ['wide', { source: {} as CanvasImageSource, width: 200, height: 50 }],
    ]);
    paintPoster(
      ctx,
      layout([
        { kind: 'image', x: 0, y: 0, w: 100, h: 100, src: 'wide' },
        { kind: 'image', x: 0, y: 0, w: 100, h: 100, src: 'missing' },
      ]),
      images,
    );
    expect(log.filter((entry) => entry.startsWith('drawImage'))).toEqual([
      'drawImage(img,0,37.5,100,25)',
    ]);
  });

  it('balances every clip with a restore', () => {
    const { ctx, log } = recorder();
    paintPoster(
      ctx,
      layout([{ kind: 'clip', x: 0, y: 0, w: 10, h: 10, radius: 2 }, { kind: 'unclip' }]),
      new Map(),
    );
    expect(log.filter((e) => e === 'save()')).toHaveLength(2);
    expect(log.filter((e) => e === 'restore()')).toHaveLength(2);
    expect(log).toContain('clip()');
  });
});
