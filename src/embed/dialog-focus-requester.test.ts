import { describe, expect, it, vi } from 'vitest';
import { DialogFocusRequester, FOCUS_MESSAGE_TYPE } from './dialog-focus-requester';

function setup(area: { top: number; bottom: number } | undefined) {
  const parent = { postMessage: vi.fn() };
  const win = { parent } as unknown as Window;
  const dialog = document.createElement('div');
  dialog.getBoundingClientRect = () => ({ top: 1180.4, height: 320 }) as DOMRect;
  const requester = new DialogFocusRequester(win, dialog, () => area, 'https://host.example');
  return { requester, dialog, parent };
}

describe('DialogFocusRequester', () => {
  it('asks the host to scroll when the dialog opens with little of the iframe visible', async () => {
    const { requester, dialog, parent } = setup({ top: 1400, bottom: 1500 });
    requester.start();
    dialog.setAttribute('open', '');
    await vi.waitFor(() => {
      expect(parent.postMessage).toHaveBeenCalledWith(
        { type: FOCUS_MESSAGE_TYPE, top: 1180, height: 320 },
        'https://host.example',
      );
    });
    requester.stop();
  });

  it('stays quiet in overlay mode (the iframe already covers the screen)', () => {
    const { requester, parent } = setup({ top: 1400, bottom: 1500 });
    document.documentElement.classList.add('is-overlay');
    requester.request();
    document.documentElement.classList.remove('is-overlay');
    expect(parent.postMessage).not.toHaveBeenCalled();
  });

  it('stays quiet when enough is visible', () => {
    const { requester, parent } = setup({ top: 0, bottom: 800 });
    requester.request();
    expect(parent.postMessage).not.toHaveBeenCalled();
  });

  it('does nothing when the page is not embedded', () => {
    const win = window;
    const dialog = document.createElement('div');
    const requester = new DialogFocusRequester(win, dialog, () => undefined, '*');
    const spy = vi.spyOn(window, 'postMessage');
    requester.start();
    dialog.setAttribute('open', '');
    expect(spy).not.toHaveBeenCalled();
  });
});
