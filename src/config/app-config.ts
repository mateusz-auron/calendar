import { parseYearMonth, type Weekday, type YearMonth } from '../domain';

export type Theme = 'auto' | 'light' | 'dark';

export interface AppConfig {
  /** Month shown on load; `undefined` ⇒ current month. */
  readonly initialMonth: YearMonth | undefined;
  /** BCP-47 locale for month/weekday names. */
  readonly locale: string;
  readonly weekStartsOn: Weekday;
  readonly theme: Theme;
  /** Origin allowed to receive iframe resize messages (`*` = any). */
  readonly parentOrigin: string;
  /** Destination URL of demo events. */
  readonly eventUrl: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  initialMonth: undefined,
  locale: 'en-US',
  weekStartsOn: 1,
  theme: 'auto',
  parentOrigin: '*',
  eventUrl: 'https://www.google.com/',
};

/**
 * Reads configuration from query-string parameters so the host page can
 * customise the widget purely through the iframe `src` attribute, e.g.
 * `?month=2026-03&lang=pl-PL&weekStart=1&theme=dark&parentOrigin=https://example.com`.
 */
export function parseConfig(
  search: string,
  fallbackLocale: string = DEFAULT_CONFIG.locale,
): AppConfig {
  const params = new URLSearchParams(search);
  const month = params.get('month');
  const weekStart = params.get('weekStart');
  const theme = params.get('theme');

  return {
    initialMonth: month ? parseYearMonth(month) : undefined,
    locale: safeLocale(params.get('lang') ?? fallbackLocale),
    weekStartsOn: weekStart === '0' ? 0 : weekStart === '1' ? 1 : DEFAULT_CONFIG.weekStartsOn,
    theme: theme === 'light' || theme === 'dark' ? theme : DEFAULT_CONFIG.theme,
    parentOrigin: safeOrigin(params.get('parentOrigin')),
    eventUrl: DEFAULT_CONFIG.eventUrl,
  };
}

function safeLocale(locale: string): string {
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? DEFAULT_CONFIG.locale;
  } catch {
    return DEFAULT_CONFIG.locale;
  }
}

function safeOrigin(origin: string | null): string {
  if (!origin) return DEFAULT_CONFIG.parentOrigin;
  try {
    return new URL(origin).origin;
  } catch {
    return DEFAULT_CONFIG.parentOrigin;
  }
}
