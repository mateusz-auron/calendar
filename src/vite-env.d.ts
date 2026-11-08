/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public Google Calendar ID, e.g. `abc123@group.calendar.google.com`. */
  readonly VITE_GOOGLE_CALENDAR_ID?: string;
  /** Browser API key restricted to the Calendar API + your referrers. Public by nature. */
  readonly VITE_GOOGLE_API_KEY?: string;
  /** Default IANA time zone for placing timed events; defaults to the viewer's. */
  readonly VITE_TIME_ZONE?: string;
  /** `auto` (default) | `google-api` | `ical` | `demo`. */
  readonly VITE_EVENT_SOURCE?: string;
  /** `true` when the build ships an iCal snapshot (`public/events.json`). Set by CI. */
  readonly VITE_ICAL_SNAPSHOT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
