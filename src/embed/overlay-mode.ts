/**
 * Overlay mode: while the event details are open, the host page makes the
 * iframe cover the whole screen, so the backdrop greys the entire page, the
 * dialog sits above the host's own bars, and the phone bottom sheet uses the
 * full screen width. The calendar keeps drawing its grid exactly where it was
 * on the page, so nothing visibly moves.
 *
 * It is opt-in: the host announces support with `calendar:host`. Hosts
 * without the script (see public/embed.js) keep the in-iframe behaviour.
 *
 * Handshake (both directions are `postMessage`):
 *
 *   host → calendar   { type: 'calendar:host', overlay: true }         support (any time)
 *   calendar → host   { type: 'calendar:hello' }                       "send calendar:host again"
 *   calendar → host   { type: 'calendar:dialog', open: true | false }
 *   host → calendar   { type: 'calendar:overlay', active: true, rect }  iframe is now full screen;
 *                                                                       rect = where it was on screen
 *   host → calendar   { type: 'calendar:overlay', active: false }      iframe is back in the page
 *   calendar → host   { type: 'calendar:overlay-ready' }               layout switched; host may
 *                                                                       show the iframe again
 */
export const HOST_MESSAGE_TYPE = 'calendar:host';
export const HELLO_MESSAGE_TYPE = 'calendar:hello';
export const DIALOG_MESSAGE_TYPE = 'calendar:dialog';
export const OVERLAY_MESSAGE_TYPE = 'calendar:overlay';
export const OVERLAY_READY_MESSAGE_TYPE = 'calendar:overlay-ready';

/** Where the iframe was on screen, in CSS px of the host's viewport. */
export interface OverlayRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

/** Class on `<html>` while the calendar is drawn as a full-screen overlay. */
export const OVERLAY_CLASS = 'is-overlay';

/** Give up waiting for the host after this long and fall back to the in-iframe dialog. */
const HOST_TIMEOUT_MS = 500;

interface Pending {
  readonly resolve: () => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

export class OverlayModeClient {
  private supported = false;
  private active = false;
  /** The dialog wants the overlay (between enter() and exit()). */
  private wanted = false;
  private pendingEnter: Pending | undefined;
  private pendingExit: Pending | undefined;
  private readonly onMessage = (event: MessageEvent) => {
    this.handle(event);
  };

  /**
   * @param targetOrigin The host's origin (`parentOrigin`); `*` accepts any parent.
   */
  constructor(
    private readonly win: Window,
    private readonly targetOrigin: string,
  ) {}

  get isActive(): boolean {
    return this.active;
  }

  start(): void {
    if (this.win.parent === this.win) return;
    this.win.addEventListener('message', this.onMessage);
    this.post({ type: HELLO_MESSAGE_TYPE });
  }

  stop(): void {
    this.win.removeEventListener('message', this.onMessage);
  }

  /** Called before the dialog opens; resolves once the iframe covers the screen (or at once). */
  enter(): Promise<void> {
    if (!this.supported || this.active || this.pendingEnter) return Promise.resolve();
    this.wanted = true;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingEnter = undefined;
        resolve(); // no answer: open the dialog inside the iframe as usual
      }, HOST_TIMEOUT_MS);
      this.pendingEnter = { resolve, timer };
      this.post({ type: DIALOG_MESSAGE_TYPE, open: true });
    });
  }

  /** Called after the dialog closed: hands the iframe back to the page. */
  exit(): void {
    this.wanted = false;
    if (this.pendingEnter) {
      // Closed before the host answered. If the host still switches, we switch back then.
      this.finish(this.pendingEnter);
      this.pendingEnter = undefined;
    }
    if (this.active) this.requestExit();
  }

  private requestExit(): void {
    if (this.pendingExit) return;
    const timer = setTimeout(() => {
      this.pendingExit = undefined;
      this.leave(); // the host did not answer: at least restore our own layout
    }, HOST_TIMEOUT_MS);
    this.pendingExit = { resolve: () => undefined, timer };
    this.post({ type: DIALOG_MESSAGE_TYPE, open: false });
  }

  private handle(event: MessageEvent): void {
    if (event.source !== this.win.parent) return;
    if (this.targetOrigin !== '*' && event.origin !== this.targetOrigin) return;
    const data: unknown = event.data;
    if (!isRecord(data)) return;

    if (data.type === HOST_MESSAGE_TYPE) {
      this.supported = data.overlay === true;
      return;
    }
    if (data.type !== OVERLAY_MESSAGE_TYPE) return;

    if (data.active === true) {
      const rect = parseRect(data.rect);
      if (!rect) return;
      this.applyLayout(rect);
      if (!this.active) {
        this.active = true;
        this.afterPaint(() => {
          this.post({ type: OVERLAY_READY_MESSAGE_TYPE });
        });
      }
      if (this.pendingEnter) {
        this.finish(this.pendingEnter);
        this.pendingEnter = undefined;
      }
      if (!this.wanted) this.requestExit();
      return;
    }
    if (data.active === false) {
      if (this.pendingExit) {
        clearTimeout(this.pendingExit.timer);
        this.pendingExit = undefined;
      }
      this.leave();
      this.afterPaint(() => {
        this.post({ type: OVERLAY_READY_MESSAGE_TYPE });
      });
    }
  }

  private applyLayout(rect: OverlayRect): void {
    const root = this.win.document.documentElement;
    root.style.setProperty('--overlay-left', `${String(rect.left)}px`);
    root.style.setProperty('--overlay-top', `${String(rect.top)}px`);
    root.style.setProperty('--overlay-width', `${String(rect.width)}px`);
    root.classList.add(OVERLAY_CLASS);
  }

  private leave(): void {
    this.active = false;
    this.win.document.documentElement.classList.remove(OVERLAY_CLASS);
  }

  private finish(pending: Pending): void {
    clearTimeout(pending.timer);
    pending.resolve();
  }

  /** Runs after the next frame has been painted (the dialog/layout change is on screen). */
  private afterPaint(callback: () => void): void {
    this.win.requestAnimationFrame(() => {
      this.win.requestAnimationFrame(callback);
    });
  }

  private post(message: Record<string, unknown>): void {
    this.win.parent.postMessage(message, this.targetOrigin);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseRect(value: unknown): OverlayRect | undefined {
  if (!isRecord(value)) return undefined;
  const { left, top, width } = value;
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  if (!finite(left) || !finite(top) || !finite(width) || width <= 0) return undefined;
  return { left, top, width };
}
