import { DIALOG_MIN_HEIGHT, type VisibleArea } from './visible-area';

export const FOCUS_MESSAGE_TYPE = 'calendar:focus';

/**
 * Optional message for host pages: "please scroll this part of the iframe into
 * view". `top` and `height` are CSS px from the iframe's top edge. Hosts that
 * ignore it still get a usable dialog (it is clamped to the visible area).
 */
export interface FocusMessage {
  readonly type: typeof FOCUS_MESSAGE_TYPE;
  readonly top: number;
  readonly height: number;
}

/** Comfortable visible height for the dialog; below it the host is asked to scroll. */
const COMFORTABLE_HEIGHT = DIALOG_MIN_HEIGHT + 80;

/**
 * Watches the details `<dialog>` and, when it opens while too little of the
 * iframe is on screen, posts a {@link FocusMessage} to the host page.
 */
export class DialogFocusRequester {
  private observer: MutationObserver | undefined;

  constructor(
    private readonly win: Window,
    private readonly dialog: HTMLElement,
    private readonly visibleArea: () => VisibleArea | undefined,
    private readonly targetOrigin: string,
  ) {}

  start(): void {
    if (this.observer || this.win.parent === this.win) return;
    this.observer = new MutationObserver(() => {
      if (this.dialog.hasAttribute('open')) this.request();
    });
    this.observer.observe(this.dialog, { attributes: true, attributeFilter: ['open'] });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = undefined;
  }

  request(): void {
    const area = this.visibleArea();
    if (area && area.bottom - area.top >= COMFORTABLE_HEIGHT) return;
    const rect = this.dialog.getBoundingClientRect();
    const message: FocusMessage = {
      type: FOCUS_MESSAGE_TYPE,
      top: Math.max(0, Math.floor(rect.top)),
      height: Math.ceil(rect.height),
    };
    this.win.parent.postMessage(message, this.targetOrigin);
  }
}
