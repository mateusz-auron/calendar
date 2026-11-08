import { parseYearMonth, type Weekday, type YearMonth } from '../domain';

export type Theme = 'auto' | 'light' | 'dark';

/** Where events come from. */
export type EventSourceKind = 'google-api' | 'ical' | 'demo';

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
  /**
   * Sources in priority order; each one falls back to the next on failure.
   * e.g. `['google-api', 'ical']` = live API with the synced iCal snapshot as backup.
   */
  readonly eventSources: readonly [EventSourceKind, ...EventSourceKind[]];
  /** Credentials for the `google-api` source (present when it is configured). */
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
  /** `auto` (default), or force one source: `google-api` | `ical` | `demo`. */
  readonly eventSource?: string | undefined;
  /** True when the build includes an iCal snapshot (`events.json`). */
  readonly icalSnapshot?: boolean | undefined;
}

export const DEFAULT_CONFIG: AppConfig = {
  initialMonth: undefined,
  locale: 'en-US',
  weekStartsOn: 1,
  theme: 'auto',
  parentOrigin: '*',
  timeZone: 'UTC',
  eventSources: ['demo'],
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
  const google = calendarId && apiKey ? { calendarId, apiKey } : undefined;

  return {
    initialMonth: month ? parseYearMonth(month) : undefined,
    locale: safeLocale(params.get('lang') ?? defaults.locale),
    weekStartsOn: weekStart === '0' ? 0 : weekStart === '1' ? 1 : DEFAULT_CONFIG.weekStartsOn,
    theme: theme === 'light' || theme === 'dark' ? theme : DEFAULT_CONFIG.theme,
    parentOrigin: safeOrigin(params.get('parentOrigin')),
    timeZone: safeTimeZone(params.get('tz') ?? defaults.timeZone),
    eventSources: resolveSources(defaults.eventSource, {
      'google-api': google !== undefined,
      ical: defaults.icalSnapshot === true,
    }),
    google,
    eventUrl: DEFAULT_CONFIG.eventUrl,
  };
}

/**
 * `auto` uses every configured source, live API first (fresher) with the iCal
 * snapshot as fallback. Forcing an unconfigured source falls back to demo data.
 */
function resolveSources(
  requested: string | undefined,
  available: Record<Exclude<EventSourceKind, 'demo'>, boolean>,
): readonly [EventSourceKind, ...EventSourceKind[]] {
  const choice = requested?.trim().toLowerCase() || 'auto';
  if (choice === 'google-api' || choice === 'ical') {
    return available[choice] ? [choice] : ['demo'];
  }
  if (choice === 'demo') return ['demo'];
  const [first, ...rest] = (['google-api', 'ical'] as const).filter((kind) => available[kind]);
  return first ? [first, ...rest] : ['demo'];
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
