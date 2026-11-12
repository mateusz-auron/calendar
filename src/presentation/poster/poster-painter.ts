import type { PosterFont, PosterLayout, PosterOp } from './poster-layout';

/** The part of the 2D canvas API the poster needs (tests pass a recording fake). */
export type PosterContext = Pick<
  CanvasRenderingContext2D,
  | 'save'
  | 'restore'
  | 'setTransform'
  | 'beginPath'
  | 'moveTo'
  | 'lineTo'
  | 'arcTo'
  | 'closePath'
  | 'clip'
  | 'fill'
  | 'stroke'
  | 'fillText'
  | 'drawImage'
  | 'fillStyle'
  | 'strokeStyle'
  | 'lineWidth'
  | 'font'
  | 'textBaseline'
  | 'shadowColor'
  | 'shadowBlur'
  | 'shadowOffsetX'
  | 'shadowOffsetY'
>;

/** A decoded image and its natural size. */
export interface PosterImage {
  readonly source: CanvasImageSource;
  readonly width: number;
  readonly height: number;
}

const FAMILY = {
  display: "'Bricolage Grotesque', Inter, system-ui, sans-serif",
  body: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
} as const;

/** The CSS `font` shorthand for a poster font. */
export function fontCss(font: PosterFont): string {
  return `${String(font.weight)} ${String(font.size)}px ${FAMILY[font.family]}`;
}

/** Sets the font (and letter spacing, where the browser supports it) for drawing or measuring. */
export function applyFont(ctx: Pick<CanvasRenderingContext2D, 'font'>, font: PosterFont): void {
  ctx.font = fontCss(font);
  if ('letterSpacing' in ctx) {
    (ctx as { letterSpacing: string }).letterSpacing = `${String(font.letterSpacing ?? 0)}px`;
  }
}

function boxPath(
  ctx: PosterContext,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paintOp(
  ctx: PosterContext,
  op: PosterOp,
  scale: number,
  images: ReadonlyMap<string, PosterImage>,
): void {
  switch (op.kind) {
    case 'rect': {
      if (op.fill) {
        ctx.save();
        if (op.shadow) {
          // Shadow sizes ignore the canvas transform, so scale them by hand.
          ctx.shadowColor = op.shadow.color;
          ctx.shadowBlur = op.shadow.blur * scale;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = op.shadow.offsetY * scale;
        }
        ctx.fillStyle = op.fill;
        boxPath(ctx, op.x, op.y, op.w, op.h, op.radius ?? 0);
        ctx.fill();
        ctx.restore();
      }
      if (op.stroke) {
        ctx.strokeStyle = op.stroke;
        ctx.lineWidth = 1;
        boxPath(ctx, op.x + 0.5, op.y + 0.5, op.w - 1, op.h - 1, (op.radius ?? 0) - 0.5);
        ctx.stroke();
      }
      return;
    }
    case 'text':
      applyFont(ctx, op.font);
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = op.color;
      ctx.fillText(op.text, op.x, op.y);
      return;
    case 'image': {
      const image = images.get(op.src);
      if (!image || image.width <= 0 || image.height <= 0) return;
      const fit = Math.min(op.w / image.width, op.h / image.height);
      const w = image.width * fit;
      const h = image.height * fit;
      ctx.drawImage(image.source, op.x + (op.w - w) / 2, op.y + (op.h - h) / 2, w, h);
      return;
    }
    case 'clip':
      ctx.save();
      boxPath(ctx, op.x, op.y, op.w, op.h, op.radius);
      ctx.clip();
      return;
    case 'unclip':
      ctx.restore();
      return;
  }
}

/** Draws a poster layout. The canvas must be `width × scale` by `height × scale` pixels. */
export function paintPoster(
  ctx: PosterContext,
  layout: PosterLayout,
  images: ReadonlyMap<string, PosterImage>,
): void {
  ctx.save();
  ctx.setTransform(layout.scale, 0, 0, layout.scale, 0, 0);
  for (const op of layout.ops) paintOp(ctx, op, layout.scale, images);
  ctx.restore();
}
