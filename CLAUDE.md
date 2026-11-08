# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in this repository.

## What this is

A static, embeddable tournament calendar for a game store (vanilla TypeScript + Vite, Polish UI by
default). Other sites load it in an `<iframe>`, and GitHub Pages hosts it (deployed by
`.github/workflows/deploy.yml`). Clicking an event opens a details dialog; registration and results
links in the dialog open in a new tab. Tournament fields (game, titles, formats, price, seats,
links) are written by organisers in the event description, one `key: value` per line, and parsed
by `infrastructure/event-description-parser.ts`; defaults ("TBA", 12 seats, "Wyniki wkrótce") are
applied in `application/event-card.ts`. The plan is in `docs/plans/tournament-design.md`.
Events come from a public Google Calendar in one or both ways:

- **iCal sync**: a scheduled workflow runs `scripts/sync-ical.ts`, which turns the feed in
  `ICAL_URL` into a static `events.json`. The browser reads it through `SnapshotEventRepository`.
- **Google Calendar API**: called live from the browser when `VITE_GOOGLE_CALENDAR_ID` and
  `VITE_GOOGLE_API_KEY` are set at build time.

When both are configured, the API is used first and the snapshot is the fallback
(`FallbackEventRepository`). `VITE_EVENT_SOURCE` can force a single source. With nothing
configured, the app shows demo data: one event per month, on a seeded random day.

## Commands

```bash
npm install            # setup (Node >= 22.12, see .nvmrc)
npm run dev            # dev server
npm run check          # format:check + lint + typecheck + test  (run before every commit)
npm run build          # production build -> dist/
ICAL_URL=<feed> npm run sync:ical   # write public/events.json (then VITE_ICAL_SNAPSHOT=true)
npm run test:watch     # TDD loop
npx vitest run src/application/month-grid.test.ts   # a single test file
```

CI must stay green. `npm run check` runs the same steps as CI.

## Architecture (strict, lint-enforced)

Dependencies only point inwards:

```
domain  <-  application  <-  presentation | infrastructure | embed | config  <-  main.ts
```

- `src/domain/`: pure types, value objects (`PlainDate`, `YearMonth`, `DateRange`) and **ports**
  (`EventRepository`, `Clock`). No DOM, no `fetch`, no `Date.now()`.
- `src/application/`: use-cases (`CalendarService`) and pure view-model builders
  (`buildMonthGrid`). Imports only from `domain`.
- `src/infrastructure/`: adapters that implement the ports (`GoogleCalendarEventRepository`,
  `SnapshotEventRepository`, `DemoEventRepository`, `SystemClock`) and decorators
  (`CachingEventRepository`, `FallbackEventRepository`). Both Google sources convert to
  `RawEvent` and map it with the shared `toCalendarEvent()` in `raw-event.ts`, so they behave the
  same. Keep it that way.
- `scripts/`: build-time Node code with its own `tsconfig.json` (Node globals are allowed here and
  never in `src/`). `ical/ical-to-snapshot.ts` is pure and unit-tested; `sync-ical.ts` handles
  I/O and is the command-line entry point. The snapshot format (`EventSnapshot`, `version: 1`) is
  a contract with already-deployed pages: change it only by adding fields, or bump the version.
- `src/presentation/`: DOM rendering (`CalendarView` orchestrates `month-header`, `game-filter`,
  `month-grid-view`, `event-tile` and `EventDialog`), copy in `messages.ts` (PL default, EN),
  `Intl` formatting, game colours/logos in `game-theme.ts`, self-hosted fonts and `styles.css`.
- `src/embed/`: iframe concerns: `IframeHeightReporter` (`calendar:resize`), `VisibleAreaTracker`
  (keeps the dialog inside the on-screen part of the auto-height iframe via CSS variables) and
  `DialogFocusRequester` (optional `calendar:focus` hint to the host).
- `src/config/`: parses query-string parameters into a typed `AppConfig`.
- `src/main.ts`: the **composition root**. It is the only file that instantiates concrete classes.

`eslint.config.js` encodes these boundaries with `no-restricted-imports`. If lint reports a
boundary error, move the code to the correct layer or add a port. Do not disable the rule.

## Conventions

- **SOLID / DI**: classes receive their collaborators through the constructor. To add a capability,
  add a port in `domain/ports.ts` and an adapter in `infrastructure/`, then wire both in `main.ts`.
- **Dates**: always use `PlainDate` / `YearMonth`. Months are **1-based**. Do not pass JS `Date`
  objects across layers. `Intl` formatting uses `timeZone: 'UTC'` with `Date.UTC(...)`.
- **DOM**: build elements with `h()` from `presentation/dom.ts`. **Never use `innerHTML`**, because
  event data must not be able to inject markup.
- **Remote data** (Google API JSON) is untrusted. Validate it at the boundary in the adapter,
  allow only `http(s)` links, and show descriptions as plain text. Adapters take `fetch` as a
  constructor dependency, so tests use canned responses and never touch the network.
- **Errors**: adapters throw `EventSourceError` with a message users can read.
  `CalendarView.show()` never rejects: it shows an error state with a Retry button.
- **Secrets**: `VITE_GOOGLE_API_KEY` is a _public_ browser key and ends up in the bundle. It is
  protected by API and HTTP-referrer restrictions in Google Cloud. Never accept the key from a URL
  parameter, and never put a key with broader permissions into `VITE_*` variables.
- **Event links** (registration, results, add to calendar, directions) must be real
  `<a href target="_blank" rel="noopener noreferrer">`, not `window.open`. External URLs are built
  by the `EventLinks` port (`GoogleEventLinks`), never in views. Popup blockers and iframe sandboxes allow anchors, and anchors are accessible.
- **Iframe**: keep `base: './'` in `vite.config.ts`. Do not add anything that breaks framing (for
  example a `frame-ancestors` CSP or `X-Frame-Options`). Keep the `calendar:resize` and `calendar:focus`
  message shapes backward compatible, because host pages depend on them.
- **Accessibility**: use semantic table markup, `aria-current="date"` for today, labelled buttons,
  and visible `:focus-visible` styles.
- **TypeScript**: strict mode with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.
  Use `import type` for types. Avoid `any` and non-null `!`.
- **Tests**: co-located `*.test.ts` files (Vitest + happy-dom). Test pure logic directly and test
  views through the DOM. Inject a fake `Clock` instead of mocking the system date. Every bug fix
  needs a test that would have caught it.
- **Style**: Prettier (single quotes, 100 columns). Files use kebab-case. One main export per module.
  Each layer has an `index.ts` barrel.

## Deployment

A push to `main` runs `deploy.yml` (check, build, `upload-pages-artifact`, `deploy-pages`). The
repository's Pages source must be set to **GitHub Actions**, and `main` must be the default branch
(the `github-pages` environment only accepts deployments from it). The build reads these repository
**variables**:

- `ICAL_URL` (and optionally `ICAL_PAST_MONTHS` / `ICAL_FUTURE_MONTHS`);
- `VITE_GOOGLE_CALENDAR_ID`, `VITE_GOOGLE_API_KEY`, `VITE_TIME_ZONE` (default `Europe/Warsaw`),
  `VITE_EVENT_SOURCE`, `VITE_LOCALE` (default `pl-PL`);
- `VITE_DEFAULT_SEATS` (default 12) and `VITE_DEFAULT_LOCATION` (the store address).

The workflow also runs every 10 minutes. Those scheduled runs only re-sync the iCal feed, skip
the checks, and deploy only when the events changed compared with the live `events.json`.
`keepalive.yml` runs monthly and re-enables `deploy.yml` (and itself) through the API, so GitHub's
60-day inactivity rule never disables the schedule. It needs only `actions: write`; keep it that way. A
failed sync on a push keeps the previously deployed snapshot. Never commit `public/events.json`,
because it is generated. For local
development, copy `.env.example` to `.env.local`. Only `dist/` is published. Files in
`public/` (for example `embed-demo.html`) are copied into it as they are.

## Out of scope / don'ts

- Do not add a UI framework or runtime dependencies without a clear need. The bundle is tiny on purpose.
- Do not commit `dist/` or `coverage/`.
- Do not hard-code URLs in components. They come from config or the repository.
