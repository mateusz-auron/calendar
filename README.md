# Calendar

A tournament calendar for a game store, for embedding in other pages with an `<iframe>`. It is a
static site, deployed to GitHub Pages by GitHub Actions. The UI is in Polish by default.

Organisers add tournaments in Google Calendar and write the details (game, titles, format, entry
fee, seats, registration and results links) in the event description, one `key: value` per line.
See **[docs/event-description.md](docs/event-description.md)** (in Polish) for the template.

- **Google Calendar integration**, two ways that can be combined:
  - an **iCal sync**: a scheduled GitHub Actions job turns the calendar's iCal feed into a static
    `events.json`. No API key is needed, and updates appear within about 5–30 minutes;
  - the **Google Calendar API**: called live from the browser with a restricted API key.
- Month grid with game logos, a **game filter**, and a **details dialog** (bottom sheet on phones)
  with registration / results buttons, "add to calendar" and directions links.
- Missing details get defaults: "TBA" format and fee, 12 seats, "Zapisy wkrótce" /
  "Wyniki wkrótce". Events without a game are shown as generic events.
- Supports repeating, timed, overnight and multi-day events.
- **Demo data:** used when no calendar is configured: a weekly tournament schedule that shows
  every default, the same on every reload.
- **Iframe-ready:** the widget sends its height to the host page, so the iframe can resize without
  scrollbars.
- Polish by default (`?lang=en` for English); times are shown in the store's time zone.
- No runtime dependencies (vanilla TypeScript). The script is about 18 kB gzipped; fonts and game
  logos are self-hosted.

## Quick start

Requirements: Node.js ≥ 22.12 (see `.nvmrc`).

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script                  | Purpose                                          |
| ----------------------- | ------------------------------------------------ |
| `npm run dev`           | Vite dev server with HMR                         |
| `npm run build`         | Type-check + production build into `dist/`       |
| `npm run preview`       | Serve the production build locally               |
| `npm run test`          | Unit tests (Vitest + happy-dom)                  |
| `npm run test:coverage` | Tests with V8 coverage report                    |
| `npm run lint`          | ESLint (strict, type-checked, layer boundaries)  |
| `npm run format`        | Prettier                                         |
| `npm run check`         | Everything CI runs, in one command               |
| `npm run sync:ical`     | Download the iCal feed into `public/events.json` |

## Google Calendar

Both options need the calendar to be **public**. In Google Calendar, open the calendar's
**Settings and sharing**:

- Under **Access permissions for events**, tick **Make available to public** and choose
  **See all event details**.
- Under **Integrate calendar**, copy the **Public address in iCal format** (for option A) or
  the **Calendar ID** (for option B).

Never use the _Secret address in iCal format_. Its events would be published in a public file.

|                            | **A. iCal sync** (scheduled)                          | **B. Google Calendar API** (live)         |
| -------------------------- | ----------------------------------------------------- | ----------------------------------------- |
| Setup                      | Only the iCal URL                                     | Google Cloud project + restricted API key |
| Freshness                  | About 5–30 min (GitHub schedule + 10 min Pages cache) | Instant                                   |
| Visitor requests to Google | None (reads `events.json` from the same site)         | One per month viewed                      |
| Repeating events           | Expanded at build time (`ical.js`)                    | Expanded by Google                        |
| `?calendar=` URL parameter | No (one calendar per build)                           | Yes                                       |

Configure both and the site uses the **live API first** and falls back to the iCal snapshot if
the API fails (bad key, quota, outage). To use only one, set `VITE_EVENT_SOURCE` (see below).

### A. iCal sync

1. Add the repository variable **`ICAL_URL`** with the public iCal address, e.g.
   `https://calendar.google.com/calendar/ical/abc123%40group.calendar.google.com/public/basic.ics`.
   Add it under **Settings → Secrets and variables → Actions → Variables**.
2. Run **Actions → Deploy to GitHub Pages → Run workflow** once. After that, the schedule keeps it
   up to date.

How the sync works (`.github/workflows/deploy.yml`):

- **Every 10 minutes**, the workflow downloads the feed and expands repeating events (RRULE,
  EXDATE, moved occurrences, time zones) into `events.json`. The file covers 12 months back and
  24 months ahead; change this with the `ICAL_PAST_MONTHS` / `ICAL_FUTURE_MONTHS` variables.
- It **compares the result with the deployed `events.json`** and only builds and deploys when
  something changed. Scheduled runs also skip lint and tests, because the code didn't change.
- **If the feed can't be downloaded**, scheduled runs fail without touching the site. Code
  deploys still go ahead and keep the previously deployed events.
- **GitHub runs schedules on a best-effort basis**, often 5–30 minutes late, and only on the
  default branch. In public repositories, GitHub disables schedules after **60 days without a
  commit**. The monthly `keepalive.yml` workflow prevents this by re-enabling `deploy.yml` (and
  itself) through the GitHub API, without commits. If the sync ever stops anyway, re-enable the
  workflow in the Actions tab.
- **Actions minutes:** free and unlimited for public repositories. On private repositories every
  run uses minutes (about 30–40 per hour at this interval). Lower the cron frequency if needed.

Locally: run `ICAL_URL=<url> npm run sync:ical`, set `VITE_ICAL_SNAPSHOT=true` in `.env.local`,
then run `npm run dev`.

### B. Google Calendar API

In [Google Cloud Console](https://console.cloud.google.com/):

1. Enable **Google Calendar API** (APIs & Services → Library).
2. Go to **Credentials → Create credentials → API key**.
3. Restrict the key:
   - **Application restrictions → Websites:** add `https://<user>.github.io/*`, and
     `http://localhost:5173/*` for development.
   - **API restrictions → Restrict key:** select only **Google Calendar API**.

The key is included in the page's JavaScript, so anyone can see it. That is expected for a
browser key that only reads public data. The restrictions stop other sites and other APIs from
using it. A key can read any public calendar, not only yours. Never use a key that has broader
permissions.

### Configuration

Add these as repository **variables** under **Settings → Secrets and variables → Actions →
Variables**. For local development, put them in `.env.local` (copy `.env.example`).

| Variable                  | Used by | Description                                                                              |
| ------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| `ICAL_URL`                | A       | Public iCal address; enables the scheduled sync                                          |
| `ICAL_PAST_MONTHS`        | A       | Months of history in the snapshot (default 12)                                           |
| `ICAL_FUTURE_MONTHS`      | A       | Months ahead in the snapshot (default 24)                                                |
| `VITE_GOOGLE_CALENDAR_ID` | B       | Public calendar ID                                                                       |
| `VITE_GOOGLE_API_KEY`     | B       | Restricted browser API key                                                               |
| `VITE_TIME_ZONE`          | A, B    | IANA zone of the store's calendar (default `Europe/Warsaw`)                              |
| `VITE_EVENT_SOURCE`       | —       | `auto` (default: every configured source, API first) or `ical` / `google-api` / `demo`   |
| `VITE_LOCALE`             | —       | UI language (default `pl-PL`)                                                            |
| `VITE_DEFAULT_SEATS`      | —       | Seats shown when a tournament gives none (default 12)                                    |
| `VITE_DEFAULT_LOCATION`   | —       | Optional. Store name and address for events without a location (else no directions link) |

### How events are shown

- **Timed events** show their time range in `tz` / `VITE_TIME_ZONE` (default `Europe/Warsaw`).
  A tournament ending after midnight but before 06:00 stays on its first day.
- **Multi-day events** appear on every day they cover.
- **Clicking an event** opens the details dialog. Its links (registration, results, add to
  calendar, directions) open in a new tab.
- **Descriptions** are parsed into tournament fields; any other text is shown as plain text.
  Problems (unknown game, bad link, …) are listed in the sync job's GitHub Actions summary.
- **Data already loaded** is cached, so going back and forth doesn't fetch it again.
- **Errors** (calendar not public, wrong key, missing snapshot, network) show a message with a
  **Retry** button.

## Deploying to GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
3. Push to `main`, or run the _Deploy to GitHub Pages_ workflow manually.

The site is published at `https://<user>.github.io/<repo>/`. The Vite config uses
`base: './'`, so the build works under any sub-path with no extra configuration.

Workflows:

- `.github/workflows/ci.yml` runs format, lint, typecheck, tests (with coverage) and the build on
  every pull request and on every branch except `main`.
- `.github/workflows/deploy.yml` runs the full check on `main`, syncs the iCal feed (if
  configured), builds the site and deploys it with the official `actions/deploy-pages`. Its
  10-minute schedule only re-syncs the iCal feed and deploys when the events changed.

## Embedding

```html
<iframe
  id="calendar"
  src="https://<user>.github.io/<repo>/?parentOrigin=https://your-site.example"
  title="Event calendar"
  style="width:100%; height:640px; border:0"
  loading="lazy"
  sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
></iframe>

<script>
  // Optional: auto-resize the iframe to its content.
  const frame = document.getElementById('calendar');
  window.addEventListener('message', (event) => {
    if (event.source !== frame.contentWindow) return;
    if (event.data?.type === 'calendar:resize') frame.style.height = `${event.data.height}px`;
    // Optional: scroll the details dialog into view when it opens near the screen edge.
    if (event.data?.type === 'calendar:focus') {
      const top = frame.getBoundingClientRect().top + window.scrollY + event.data.top;
      window.scrollTo({ top: Math.max(0, top - 16), behavior: 'smooth' });
    }
  });
</script>
```

If you use `sandbox`, you need both `allow-popups` and `allow-popups-to-escape-sandbox`. Without
them, the dialog's registration and results links cannot open a new tab, or the new page opens with the iframe's sandbox
restrictions. A working example is deployed at `/embed-demo.html` (source:
`public/embed-demo.html`).

### URL parameters

| Parameter      | Example                         | Default                             | Description                                                                  |
| -------------- | ------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| `month`        | `2026-03`                       | current month                       | Month shown first                                                            |
| `lang`         | `en`                            | `VITE_LOCALE` or `pl-PL`            | UI language (Polish, or English for `en…`)                                   |
| `weekStart`    | `0` (Sun) / `1` (Mon)           | `1`                                 | First day of the week                                                        |
| `game`         | `pokemon`                       | all games                           | Initial game filter (`lorcana`, `riftbound`, `onepiece`, `pokemon`, `other`) |
| `parentOrigin` | `https://example.com`           | `*`                                 | Target origin for `postMessage` (lock it down!)                              |
| `tz`           | `Europe/Warsaw`                 | `VITE_TIME_ZONE` or `Europe/Warsaw` | Time zone used to place timed events on days                                 |
| `calendar`     | `abc@group.calendar.google.com` | `VITE_GOOGLE_CALENDAR_ID`           | Show a different public calendar (API source only)                           |

### Message contract

```ts
{ type: 'calendar:resize', height: number } // CSS pixels, sent on load and on every layout change
{ type: 'calendar:focus', top: number, height: number } // optional: dialog opened near the edge
```

The details dialog always stays inside the part of the iframe that is on screen (measured with an
`IntersectionObserver`). `calendar:focus` is only a hint: it asks the host to scroll that part of
the iframe (px from its top) into view when too little of the calendar is visible.

## Architecture

The code follows Clean / Hexagonal Architecture and the SOLID principles. Dependencies only point
inwards, and ESLint enforces this (`no-restricted-imports` for each layer).

```
src/
├── domain/          Pure model + ports. No DOM, no I/O.
│   ├── plain-date.ts       timezone-free date value object
│   ├── year-month.ts       month value object & arithmetic
│   ├── date-range.ts       inclusive day range + overlap helpers
│   ├── calendar-event.ts   CalendarEvent entity (all-day / timed / multi-day)
│   └── ports.ts            EventRepository, Clock (interfaces)
├── application/     Use-cases; depend only on domain ports.
│   ├── month-grid.ts       pure 6×7 grid builder (view-model)
│   └── calendar-service.ts "get month view" use-case
├── infrastructure/  Adapters implementing domain ports.
│   ├── google-calendar-event-repository.ts  Google Calendar API v3 adapter
│   ├── snapshot-event-repository.ts         reads the synced iCal snapshot (events.json)
│   ├── event-snapshot.ts / raw-event.ts     shared snapshot format + raw → domain mapping
│   ├── fallback-event-repository.ts         decorator: primary source, fallback on failure
│   ├── caching-event-repository.ts          caching decorator for any repository
│   ├── demo-event-repository.ts             one seeded-random event per month
│   ├── zoned-time.ts                        instant → wall-clock date/time in a time zone
│   ├── seeded-random.ts                     mulberry32 PRNG
│   └── system-clock.ts
├── presentation/    DOM rendering (no innerHTML → XSS-safe), CSS, Intl formatting.
├── embed/           Iframe integration (height reporter via postMessage).
├── config/          Query-string → typed AppConfig.
└── main.ts          Composition root: the only place wiring concrete classes.

scripts/             Build-time Node code (never shipped to the browser).
├── sync-ical.ts            CLI: download feed → public/events.json, change detection
└── ical/ical-to-snapshot.ts  pure iCal → snapshot conversion (ical.js, RRULE expansion)
```

How the SOLID principles show up in the code:

- **S**: each module has one reason to change (grid maths, formatting, rendering, embedding, config).
- **O/L**: a new data source is another `EventRepository`. The Google API and the iCal snapshot
  were both added this way, without changing the domain or the view. Caching and fallback are
  decorators that wrap any repository.
- **I**: the ports are small (`findInRange`, `today`).
- **D**: the application layer depends on abstractions. `main.ts` injects the concrete classes.

### Adding another event source

Implement the port, then add it to `createSource()` in `src/main.ts`:

```ts
export class HttpEventRepository implements EventRepository {
  constructor(private readonly baseUrl: string) {}
  async findInRange({ start, end }: DateRange): Promise<readonly CalendarEvent[]> {
    const res = await fetch(
      `${this.baseUrl}/events?from=${toIsoString(start)}&to=${toIsoString(end)}`,
    );
    return parseEvents(await res.json()); // validate at the boundary
  }
}
```

## Tech stack

Vite 8, TypeScript 6 (strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`),
ical.js (build time only), Vitest 5 + happy-dom, ESLint 10 (`typescript-eslint` strict type-checked), Prettier 3,
Dependabot for npm and GitHub Actions.
