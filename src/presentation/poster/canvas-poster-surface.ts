import type { PosterFont, PosterLayout, TextMeasurer } from './poster-layout';
import { applyFont, fontCss, paintPoster, type PosterImage } from './poster-painter';
import type { PosterSurface } from './poster-page';

/** Every weight the poster draws; loaded up front so text is measured in the real fonts. */
const FONTS: readonly PosterFont[] = [
  { family: 'display', size: 64, weight: 700 },
  { family: 'display', size: 64, weight: 800 },
  { family: 'body', size: 14, weight: 600 },
  { family: 'body', size: 14, weight: 700 },
];
/** Polish letters make the browser fetch the `latin-ext` font files as well. */
const FONT_SAMPLE = 'Grudzień Październik ąćęłńóśźż 0123456789';

/** Draws the poster on a `<canvas>` and exports it as a PNG. */
export class CanvasPosterSurface implements PosterSurface {
  readonly element: HTMLCanvasElement;
  private readonly images = new Map<string, Promise<PosterImage | undefined>>();
  private fonts: Promise<void> | undefined;

  constructor(private readonly doc: Document) {
    this.element = doc.createElement('canvas');
    this.element.className = 'poster-canvas';
  }

  readonly measure: TextMeasurer = (text, font) => {
    const ctx = this.context();
    applyFont(ctx, font);
    return ctx.measureText(text).width;
  };

  prepare(): Promise<void> {
    this.fonts ??= Promise.all(
      FONTS.map((font) => this.doc.fonts.load(fontCss(font), FONT_SAMPLE)),
    ).then(
      () => undefined,
      // Without the web fonts the poster still renders, in the fallback fonts.
      () => undefined,
    );
    return this.fonts;
  }

  async draw(layout: PosterLayout): Promise<void> {
    const sources = new Set(layout.ops.flatMap((op) => (op.kind === 'image' ? [op.src] : [])));
    const loaded = new Map<string, PosterImage>();
    await Promise.all(
      [...sources].map(async (src) => {
        const image = await this.image(src);
        if (image) loaded.set(src, image);
      }),
    );
    this.element.width = Math.round(layout.width * layout.scale);
    this.element.height = Math.round(layout.height * layout.scale);
    paintPoster(this.context(), layout, loaded);
  }

  toBlob(): Promise<Blob | undefined> {
    return new Promise((resolve) => {
      this.element.toBlob((blob) => {
        resolve(blob ?? undefined);
      }, 'image/png');
    });
  }

  private context(): CanvasRenderingContext2D {
    const ctx = this.element.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    return ctx;
  }

  private image(src: string): Promise<PosterImage | undefined> {
    let pending = this.images.get(src);
    if (!pending) {
      const img = this.doc.createElement('img');
      img.decoding = 'async';
      img.src = src;
      pending = img.decode().then(
        () => ({ source: img, width: img.naturalWidth, height: img.naturalHeight }),
        // A missing logo leaves its box empty; the rest of the poster is still drawn.
        () => undefined,
      );
      this.images.set(src, pending);
    }
    return pending;
  }
}
