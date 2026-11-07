# Calendar

An interactive month calendar for embedding in other pages with an `<iframe>`. It is a static
site, deployed to GitHub Pages by GitHub Actions.

- **Google Calendar integration:** shows events from a public Google Calendar, including
  repeating, timed and multi-day events.
- Events can be clicked and open in a **new tab**. Google events open their Google Calendar page.
- **Demo data:** used when no Google Calendar is configured. It has one event per month on a
  pseudo-random day, and the days stay the same across reloads.
- **Iframe-ready:** the widget sends its height to the host page, so the iframe can resize without
  scrollbars.
- Uses the browser's locale by default; you can set the locale, the first day of the week and the theme through URL parameters.
- No runtime dependencies (vanilla TypeScript). The bundle is about 6 kB gzipped.

## Quick start

Requirements: Node.js ≥ 22.12 (see `.nvmrc`).

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script                  | Purpose                                         |
| ----------------------- | ----------------------------------------------- |
| `npm run dev`           | Vite dev server with HMR                        |
| `npm run build`         | Type-check + production build into `dist/`      |
| `npm run preview`       | Serve the production build locally              |
| `npm run test`          | Unit tests (Vitest + happy-dom)                 |
| `npm run test:coverage` | Tests with V8 coverage report                   |
| `npm run lint`          | ESLint (strict, type-checked, layer boundaries) |
| `npm run format`        | Prettier                                        |
| `npm run check`         | Everything CI runs, in one command              |

## Google Calendar

The calendar reads a **public** Google Calendar through the Google Calendar API v3, directly
from the visitor's browser. If no calendar is configured, it shows the demo events.

### 1. Make the calendar public and copy its ID

In Google Calendar, open the calendar's **Settings and sharing**:

- Under **Access permissions for events**, tick **Make available to public** and choose
  **See all event details**.
- Under **Integrate calendar**, copy the **Calendar ID** (for example
  `abc123@group.calendar.google.com`).

### 2. Create a browser API key

In [Google Cloud Console](https://console.cloud.google.com/):

1. Enable **Google Calendar API** (APIs & Services → Library).
2. Go to **Credentials → Create credentials → API key**.
3. Restrict the key:
   - **Application restrictions → Websites:** add `https://<user>.github.io/*`, and
     `http://localhost:5173/*` for development.
   - **API restrictions → Restrict key:** select only **Google Calendar API**.

The key is included in the page's JavaScript, so anyone can see it. That is expected for a
browser key that only reads public data. The restrictions above stop other sites and other APIs
from using it. A key works for any public calendar, not only yours. Never use a key that has
broader permissions.

### 3. Configure

| Variable                  | Required | Description                                                                        |
| ------------------------- | -------- | ---------------------------------------------------------------------------------- |
| `VITE_GOOGLE_CALENDAR_ID` | yes      | Public calendar ID                                                                 |
| `VITE_GOOGLE_API_KEY`     | yes      | Restricted browser API key                                                         |
| `VITE_TIME_ZONE`          | no       | IANA zone for placing events on days, e.g. `Europe/Warsaw` (default: the viewer's) |

- **On GitHub:** go to **Settings → Secrets and variables → Actions → Variables** and add these
  as repository **variables**. The deploy workflow reads them when it builds. Then run the deploy
  workflow again.
- **Locally:** copy `.env.example` to `.env.local` (git-ignored) and fill it in.

### How Google events are shown

- **Repeating events** are expanded by Google (`singleEvents=true`).
- **Timed events** show their start time. They are placed on days using `tz` /
  `VITE_TIME_ZONE`, or the viewer's time zone if neither is set.
- **Multi-day events** appear on every day they cover.
- **Clicking an event** opens its Google Calendar page (`htmlLink`).
- **Descriptions** are shown as plain-text tooltips.
- **Months already loaded** are cached, so going back and forth doesn't fetch them again.
- **Errors** (calendar not public, wrong key, network) show a message with a **Retry** button.

## Deploying to GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
3. Push to `main`, or run the _Deploy to GitHub Pages_ workflow manually.

The site is published at `https://<user>.github.io/<repo>/`. The Vite config uses
`base: './'`, so the build works under any sub-path with no extra configuration.

Workflows:

- `.github/workflows/ci.yml` runs format, lint, typecheck, tests (with coverage) and the build on
  every pull request and on every branch except `main`.
- `.github/workflows/deploy.yml` runs the full check on `main`, builds the site and deploys it
  with the official `actions/deploy-pages`.

## Embedding

```html
<iframe
  id="calendar"
  src="https://<user>.github.io/<repo>/?lang=en-US&weekStart=1"
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
  });
</script>
```

If you use `sandbox`, you need both `allow-popups` and `allow-popups-to-escape-sandbox`. Without
them, clicking an event cannot open the new tab, or the new page opens with the iframe's sandbox
restrictions. A working example is deployed at `/embed-demo.html` (source:
`public/embed-demo.html`).

### URL parameters

| Parameter      | Example                         | Default                    | Description                                                 |
| -------------- | ------------------------------- | -------------------------- | ----------------------------------------------------------- |
| `month`        | `2026-03`                       | current month              | Month shown first                                           |
| `lang`         | `pl-PL`                         | browser language           | Locale used for month and weekday names                     |
| `weekStart`    | `0` (Sun) / `1` (Mon)           | `1`                        | First day of the week                                       |
| `theme`        | `light` / `dark`                | system preference          | Colour theme                                                |
| `parentOrigin` | `https://example.com`           | `*`                        | Target origin for resize `postMessage` (lock it down!)      |
| `tz`           | `Europe/Warsaw`                 | `VITE_TIME_ZONE` or viewer | Time zone used to place timed events on days                |
| `calendar`     | `abc@group.calendar.google.com` | `VITE_GOOGLE_CALENDAR_ID`  | Show a different public calendar (uses the build's API key) |

### Resize message contract

```ts
{ type: 'calendar:resize', height: number } // CSS pixels, sent on load and on every layout change
```

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
│   ├── caching-event-repository.ts          caching decorator for any repository
│   ├── demo-event-repository.ts             one seeded-random event per month
│   ├── zoned-time.ts                        instant → wall-clock date/time in a time zone
│   ├── seeded-random.ts                     mulberry32 PRNG
│   └── system-clock.ts
├── presentation/    DOM rendering (no innerHTML → XSS-safe), CSS, Intl formatting.
├── embed/           Iframe integration (height reporter via postMessage).
├── config/          Query-string → typed AppConfig.
└── main.ts          Composition root: the only place wiring concrete classes.
```

How the SOLID principles show up in the code:

- **S**: each module has one reason to change (grid maths, formatting, rendering, embedding, config).
- **O/L**: a new data source is another `EventRepository`. Google Calendar was added this way,
  without changing the domain or the view. Caching is a decorator that wraps any repository.
- **I**: the ports are small (`findInRange`, `today`).
- **D**: the application layer depends on abstractions. `main.ts` injects the concrete classes.

### Adding another event source

Implement the port, then choose it in `createRepository()` in `src/main.ts`:

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
Vitest 5 + happy-dom, ESLint 10 (`typescript-eslint` strict type-checked), Prettier 3,
Dependabot for npm and GitHub Actions.
