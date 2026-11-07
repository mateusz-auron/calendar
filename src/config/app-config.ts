import { parseYearMonth, type Weekday, type YearMonth } from '../domain';

export type Theme = 'auto' | 'light' | 'dark';

export interface GoogleCalendarConfig {
  readonly calendarId: string;
  readonly apiKey: string;
}

export interface AppConfig {
  /** Month shown on load; `undefined` ⇒ current month. */
  readonly initialMonth: YearMonth | undefined;
  /** BCP-47 locale for month/weekday/time labels. */
  readonly locale: string;
  readonly weekStartsOn: Weekday;
  readonly theme: Theme;
  /** Origin allowed to receive iframe resize messages (`*` = any). */
  readonly parentOrigin: string;
  /** IANA time zone used to place timed events on days. */
  readonly timeZone: string;
  /** Google Calendar source; `undefined` ⇒ demo events. */
  readonly google: GoogleCalendarConfig | undefined;
  /** Link for demo events and for Google events without their own link. */
  readonly eventUrl: string;
}

/** Values that come from the build (env vars) or the browser rather than the URL. */
export interface ConfigDefaults {
  readonly locale?: string | undefined;
  readonly timeZone?: string | undefined;
  readonly calendarId?: string | undefined;
  readonly apiKey?: string | undefined;
}

export const DEFAULT_CONFIG: AppConfig = {
  initialMonth: undefined,
  locale: 'en-US',
  weekStartsOn: 1,
  theme: 'auto',
  parentOrigin: '*',
  timeZone: 'UTC',
  google: undefined,
  eventUrl: 'https://www.google.com/',
};

/**
 * Reads configuration from query-string parameters so the host page can
 * customise the widget purely through the iframe `src` attribute, e.g.
 * `?month=2026-03&lang=pl-PL&weekStart=1&theme=dark&tz=Europe/Warsaw&calendar=<id>`.
 * The API key is build-time only (never a URL parameter).
 */
export function parseConfig(search: string, defaults: ConfigDefaults = {}): AppConfig {
  const params = new URLSearchParams(search);
  const month = params.get('month');
  const weekStart = params.get('weekStart');
  const theme = params.get('theme');
  const calendarId = (params.get('calendar') ?? defaults.calendarId)?.trim();
  const apiKey = defaults.apiKey?.trim();

  return {
    initialMonth: month ? parseYearMonth(month) : undefined,
    locale: safeLocale(params.get('lang') ?? defaults.locale),
    weekStartsOn: weekStart === '0' ? 0 : weekStart === '1' ? 1 : DEFAULT_CONFIG.weekStartsOn,
    theme: theme === 'light' || theme === 'dark' ? theme : DEFAULT_CONFIG.theme,
    parentOrigin: safeOrigin(params.get('parentOrigin')),
    timeZone: safeTimeZone(params.get('tz') ?? defaults.timeZone),
    google: calendarId && apiKey ? { calendarId, apiKey } : undefined,
    eventUrl: DEFAULT_CONFIG.eventUrl,
  };
}

function safeLocale(locale: string | undefined): string {
  if (!locale) return DEFAULT_CONFIG.locale;
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? DEFAULT_CONFIG.locale;
  } catch {
    return DEFAULT_CONFIG.locale;
  }
}

function safeTimeZone(timeZone: string | undefined): string {
  if (!timeZone) return DEFAULT_CONFIG.timeZone;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone;
  } catch {
    return DEFAULT_CONFIG.timeZone;
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
