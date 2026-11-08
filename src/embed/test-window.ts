import { vi } from 'vitest';

export interface FakeEmbeddedWindow {
  readonly win: Window;
  readonly parent: { postMessage: ReturnType<typeof vi.fn> };
  /** Delivers a message as if posted by `source` (default: the parent) from `origin`. */
  readonly receive: (data: unknown, origin?: string, source?: unknown) => void;
  /** Everything posted to the parent so far. */
  readonly sent: () => Record<string, unknown>[];
}

/** A fake embedded window: records posts to the parent, delivers messages from it. */
export function fakeEmbeddedWindow(): FakeEmbeddedWindow {
  const parent = { postMessage: vi.fn() };
  let listener: ((event: MessageEvent) => void) | undefined;
  const win = {
    parent,
    document,
    addEventListener: (type: string, fn: (event: MessageEvent) => void) => {
      if (type === 'message') listener = fn;
    },
    removeEventListener: vi.fn(),
  } as unknown as Window;
  const receive = (data: unknown, origin = 'https://host.example', source: unknown = parent) => {
    listener?.({ data, origin, source } as unknown as MessageEvent);
  };
  const sent = () =>
    parent.postMessage.mock.calls.map((call) => call[0] as Record<string, unknown>);
  return { win, parent, receive, sent };
}
