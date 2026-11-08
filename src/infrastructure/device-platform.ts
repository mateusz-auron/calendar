/** Phone/tablet platforms whose native calendar and maps apps the links target. */
export type DevicePlatform = 'ios' | 'android' | 'other';

/** What `detectPlatform` reads from `navigator`. */
export interface PlatformHints {
  readonly userAgent: string;
  readonly maxTouchPoints?: number;
}

export function detectPlatform({ userAgent, maxTouchPoints = 0 }: PlatformHints): DevicePlatform {
  if (/Android/i.test(userAgent)) return 'android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  // iPadOS asks for desktop sites: it says "Macintosh", but Macs have no touch screen.
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios';
  return 'other';
}
