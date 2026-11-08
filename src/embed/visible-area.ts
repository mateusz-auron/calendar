/** The part of the iframe the visitor can see, in px from the iframe's top edge. */
export interface VisibleArea {
  readonly top: number;
  readonly bottom: number;
}

export type ObserverFactory = (
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit,
) => Pick<IntersectionObserver, 'observe' | 'disconnect'>;

/** Ratio steps for IntersectionObserver: every 0.5 % of the widget's height. */
const THRESHOLDS = Array.from({ length: 201 }, (_, i) => i / 200);
/** Dialog geometry (px), mirrored from the design: never squeeze it below this. */
export const DIALOG_MIN_HEIGHT = 320;
/** Backdrop left visible above a bottom sheet that grows to fit its content. */
const SHEET_TOP_GAP = 32;
const EDGE = 12;

/**
 * The iframe grows to fit its content, so its own viewport can be much taller
 * than the part on screen, and a centred modal (or a bottom sheet) could open
 * off-screen. This tracker reads the visible slice with an IntersectionObserver
 * (which clips against the top-level viewport, also for cross-origin frames)
 * and publishes dialog placement as CSS custom properties on `<html>`:
 *
 * - `--dialog-top`, `--dialog-max-height`: desktop dialog inside the slice;
 * - `--sheet-bottom`, `--sheet-max-height`: mobile bottom sheet at the slice's bottom; it is as
 *   tall as its content and only scrolls when the content is taller than the slice.
 */
export class VisibleAreaTracker {
  private observer: Pick<IntersectionObserver, 'observe' | 'disconnect'> | undefined;
  private area: VisibleArea | undefined;
  private readonly onResize = () => {
    this.publish();
  };

  constructor(
    private readonly win: Window,
    private readonly createObserver: ObserverFactory = (callback, options) =>
      new IntersectionObserver(callback, options),
  ) {}

  get current(): VisibleArea | undefined {
    return this.area;
  }

  start(): void {
    if (this.observer) return;
    this.observer = this.createObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        const rect = entry.intersectionRect;
        this.area = entry.isIntersecting
          ? { top: rect.top, bottom: rect.bottom }
          : { top: 0, bottom: 0 };
        this.publish();
      },
      { threshold: THRESHOLDS },
    );
    this.observer.observe(this.win.document.body);
    this.win.addEventListener('resize', this.onResize);
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    this.win.removeEventListener('resize', this.onResize);
  }

  private publish(): void {
    if (!this.area) return;
    const placement = placeDialog(this.area, this.win.innerHeight);
    const style = this.win.document.documentElement.style;
    for (const [name, value] of Object.entries(placement) as [string, number][]) {
      style.setProperty(`--${name}`, `${String(Math.round(value))}px`);
    }
  }
}

export interface DialogPlacement {
  readonly 'dialog-top': number;
  readonly 'dialog-max-height': number;
  readonly 'sheet-bottom': number;
  readonly 'sheet-max-height': number;
}

/** Pure placement maths, so the edge cases are unit-testable. */
export function placeDialog(area: VisibleArea, viewportHeight: number): DialogPlacement {
  const height = Math.max(viewportHeight, DIALOG_MIN_HEIGHT);
  const visible = Math.max(0, area.bottom - area.top);

  const maxHeight = Math.min(Math.max(DIALOG_MIN_HEIGHT, visible - 2 * 24), height - 2 * EDGE);
  const preferredTop = area.top + Math.max(24, visible * 0.12);
  const top = clamp(preferredTop, EDGE, Math.max(EDGE, height - maxHeight - EDGE));

  const sheetMaxHeight = Math.min(Math.max(DIALOG_MIN_HEIGHT, visible - SHEET_TOP_GAP), height);
  const sheetBottom = clamp(height - area.bottom, 0, height - sheetMaxHeight);

  return {
    'dialog-top': top,
    'dialog-max-height': maxHeight,
    'sheet-bottom': sheetBottom,
    'sheet-max-height': sheetMaxHeight,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
