export const RESIZE_MESSAGE_TYPE = 'calendar:resize';

export interface ResizeMessage {
  readonly type: typeof RESIZE_MESSAGE_TYPE;
  readonly height: number;
}

/**
 * When running inside an iframe, posts the document height to the parent so
 * the host can size the iframe without scrollbars. No-op when top-level.
 */
export class IframeHeightReporter {
  private observer: ResizeObserver | undefined;
  private lastHeight = -1;

  constructor(
    private readonly win: Window,
    private readonly targetOrigin: string,
  ) {}

  get isEmbedded(): boolean {
    return this.win.parent !== this.win;
  }

  start(): void {
    if (!this.isEmbedded || this.observer) return;
    this.observer = new ResizeObserver(() => {
      this.report();
    });
    this.observer.observe(this.win.document.body);
    this.report();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = undefined;
  }

  report(): void {
    if (!this.isEmbedded) return;
    // Measure <body>, not <html>: the root's scrollHeight never drops below the
    // iframe viewport, so the widget could grow but never shrink.
    const height = Math.ceil(this.win.document.body.getBoundingClientRect().height);
    if (height === this.lastHeight) return;
    this.lastHeight = height;
    const message: ResizeMessage = { type: RESIZE_MESSAGE_TYPE, height };
    this.win.parent.postMessage(message, this.targetOrigin);
  }
}
