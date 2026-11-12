/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public Google Calendar ID, e.g. `abc123@group.calendar.google.com`. */
  readonly VITE_GOOGLE_CALENDAR_ID?: string;
  /** Browser API key restricted to the Calendar API + your referrers. Public by nature. */
  readonly VITE_GOOGLE_API_KEY?: string;
  /** IANA time zone of the store's calendar; defaults to `Europe/Warsaw`. */
  readonly VITE_TIME_ZONE?: string;
  /** BCP-47 UI locale; defaults to `pl-PL`. */
  readonly VITE_LOCALE?: string;
  /** Seats shown when a tournament description gives none; defaults to 12. */
  readonly VITE_DEFAULT_SEATS?: string;
  /** Store name and address used when an event has no location. */
  readonly VITE_DEFAULT_LOCATION?: string;
  /** `auto` (default) | `google-api` | `ical` | `demo`. */
  readonly VITE_EVENT_SOURCE?: string;
  /** `true` when the build ships an iCal snapshot (`public/events.json`). Set by CI. */
  readonly VITE_ICAL_SNAPSHOT?: string;
  /** Text of the pill on the Facebook poster, e.g. the store's website. */
  readonly VITE_POSTER_SITE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
