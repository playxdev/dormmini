# dorm-mini

`dorm.place` LINE MINI App — the tenant-facing frontend for the dorm.place
multi-tenant dormitory management platform.

One MINI App serves every dormitory. The property is a data boundary, not a
LINE application boundary. See [`docs/DESIGN-LINE-MINI.md`](docs/DESIGN-LINE-MINI.md)
for the full specification.

## Where this sits

Three services over one shared Cloudflare D1 database:

| Repo | Role |
| --- | --- |
| [playxdev/dormplace](https://github.com/playxdev/dormplace) | Backoffice for owners and staff. **Owns the schema.** |
| [playxdev/dormapi](https://github.com/playxdev/dormapi) | Tenant API this app calls |
| playxdev/dormmini | This app |

A second database is not possible: a contract activated in the backoffice has
to be visible here immediately, and D1 cannot query across databases.

## Status

**Milestone 1 — authentication.** The app proves that a LINE user can open the
MINI App and be identified by dorm.place:

```
Open from LINE → LIFF init → LINE login → backend auth
              → resolve tenant/property/room → home screen
```

**Phase 2 — tenant features.** Following §10's order:

| | |
| --- | --- |
| My Room | done |
| Invoice | done — balance on the home screen, list and detail |
| Payment | blocked on how rent is collected |
| Water/Electricity | blocked on storage for meter photos |
| Repair Request | done — list, detail, and filing one |
| Announcements | not started |

Tiles for unbuilt screens render disabled, so the layout keeps the shape of the
finished design.

**Onboarding** (§22) is complete: an unlinked tenant can scan the QR the owner
issues, or type the code, review the terms, and slide to confirm. The same code
also arrives as `?invite=CODE` on the permanent link, for tenants who cannot
scan.

`liff.scanCodeV2()` needs **Scan QR** enabled for the LIFF app in the LINE
Developers Console, and on iOS works only when the LIFF size is `Full`. The app
asks LIFF whether the scanner is available rather than guessing, and falls back
to code entry when it is not.

Amounts cross the API as integer satang and dates in the Gregorian calendar.
`src/lib/format.js` is the only place either becomes what a Thai tenant reads —
baht with two decimals, and Buddhist-era years.

## Stack

- [Vite](https://vite.dev) — dev server and build
- [`@line/liff`](https://developers.line.biz/en/docs/liff/) — LINE Front-end Framework
- Vanilla ES modules, no UI framework

## Getting started

```bash
npm install
cp .env.example .env
# fill in VITE_LINE_LIFF_ID and VITE_API_BASE_URL
npm run dev
```

### Running without LINE or a backend

`VITE_MOCK=1` skips LIFF entirely and serves fixture data, so the UI can be
worked on in a normal desktop browser. Add `?unlinked=1` to reach the
onboarding screens, and `?invite=CODE` to land straight on the review:

```bash
VITE_MOCK=1 npm run dev
```

Mock mode requires no LIFF ID and makes no network calls.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server on `0.0.0.0:5173` (LAN-accessible for phone testing) |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run pages:dev` | Serve the build through the Cloudflare Pages runtime (applies `_headers`) |
| `npm run deploy` | Build and deploy to Cloudflare Pages |
| `npm run deploy:preview` | Build and deploy to the `preview` branch |

## Configuration

All configuration is environment-based. Vite only exposes variables prefixed
with `VITE_` to browser code.

| Variable | Description |
| --- | --- |
| `VITE_APP_ENV` | `development` or `production` |
| `VITE_APP_URL` | Public URL of this app |
| `VITE_API_BASE_URL` | dorm.place backend base URL |
| `VITE_LINE_LIFF_ID` | LIFF ID for the target LINE environment |
| `VITE_MOCK` | `1` to run with fixtures and no LINE/backend |

Production URLs are never hard-coded. Copy `.env.example` to `.env` and keep
`.env` out of source control.

### Environments

| | Frontend | Backend API | LINE environment |
| --- | --- | --- | --- |
| Development | `https://dorm.playxdev.com` | `https://apidorm.playxdev.com` | Developing |
| Production | `https://app.dorm.place` | `https://api.dorm.place` | Published |

`playxdev.com` is the shared PlayDevX development root, so API subdomains are
project-level and flat: `api<project>.playxdev.com` — `apidorm`, `apipenbun`,
`apiedv`. Not `api.dorm.playxdev.com`. `dorm.place` is the product's own domain
and uses the nested `api.` form.

Moving to production changes the LIFF endpoint and configuration only. It must
never require creating a second LINE MINI App.

## Deployment

The app is a static Vite build hosted on **Cloudflare Pages**. `wrangler.jsonc`
declares `pages_build_output_dir`, which is what marks the project as Pages
rather than a Worker.

Current deployment: <https://dorm.playxdev.com> (Pages project `dormmini`,
also reachable at <https://dorm-mini.pages.dev>)

The custom domain is attached to the Pages project directly. Cloudflare manages
the DNS record for it — there is no hand-written A record and no origin IP.

`.node-version` pins Node to 22.16.0 for the Pages build image. Vite 7 requires
`^20.19.0 || >=22.12.0`; the v3 build image already defaults to a compatible
version, but pinning keeps older build images from silently failing.

> Cloudflare now recommends Workers with static assets for new projects. Pages
> remains supported and actively maintained. Switching later means replacing
> `pages_build_output_dir` with an `assets` block — the app code is unaffected.

### Environment variables are build-time

Vite inlines every `VITE_*` value into the bundle at build time. They are
**build** variables, not runtime bindings — set them under *Settings →
Environment variables → Production/Preview* in the Pages project, or they will
be missing from the deployed bundle. Everything inlined is public by design
(LIFF ID, API base URL); no secret ever belongs in this list.

### Option A — direct upload from your machine

```bash
npx wrangler login          # once
npm run deploy              # builds, then uploads dist/
npm run deploy:preview      # same, to the preview branch
```

Pages configuration files reject `account_id` — it is a Workers-only field. If
your token has access to more than one Cloudflare account, select it with an
environment variable instead:

```bash
export CLOUDFLARE_ACCOUNT_ID=<ACCOUNT_ID>
```

Run `npx wrangler whoami` to list the accounts your token can reach.

With direct upload, `VITE_*` values come from your **local** `.env`, since the
build happens on your machine.

### Option B — Git-connected build (recommended for a team)

Connect the repository in the Cloudflare dashboard and use:

| Setting | Value |
| --- | --- |
| Framework preset | None (or Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 20 or later |

Then add `VITE_APP_ENV`, `VITE_APP_URL`, `VITE_API_BASE_URL` and
`VITE_LINE_LIFF_ID` as production and preview environment variables. Every push
to `main` deploys production; other branches get preview URLs.

### Caching and headers

`public/_headers` is copied verbatim into the build:

- `/static/*` — content-hashed Vite output, cached immutably for one year.
  `vite.config.js` sets `assetsDir: "static"` specifically to keep hashed output
  separate from `public/assets/`, whose filenames are stable.
- `/assets/*` — verbatim copies of `public/assets/`, one hour with revalidation.
- `/` and `/index.html` — `no-cache`, so a deploy is picked up immediately.

No `X-Frame-Options` or `frame-ancestors` is set. LINE MINI Apps run inside the
LINE in-app browser and the LIFF login flow performs cross-origin redirects;
framing restrictions break those flows.

### Pointing LINE at the deployment

After the first deploy, set the LINE Developers Console **Developing** endpoint
URL to the Pages URL (or to `https://dorm.playxdev.com` once the custom domain
is attached). Production later swaps in `https://app.dorm.place`.

Changing the endpoint never requires creating a second LINE MINI App.


## Project structure

```
src/
├── main.js            entry point
├── app/
│   ├── config.js      environment configuration
│   └── bootstrap.js   startup sequence, routing, error screens
├── auth/
│   ├── line.js        all LIFF calls (the only LINE-aware module)
│   └── session.js     backend session token
├── api/
│   └── client.js      HTTPS client, typed AppError codes
├── lib/
│   └── format.js      money and Thai date formatting
├── pages/
│   ├── login.js       unauthenticated screen
│   ├── home.js        identity, balance, feature grid
│   ├── bills.js       invoice list and detail
│   └── nav.js         shared bottom navigation
└── styles/
    └── app.css        design tokens and screen styles

public/
├── favicon.svg
├── _headers           Cloudflare Pages cache and security headers
└── assets/mascot.png

wrangler.jsonc         Cloudflare Pages project config
```

LINE-specific logic stays inside `src/auth/line.js`. No other module imports
`@line/liff`.

## Security

The browser holds only public configuration: the LIFF ID, the API base URL and
the app environment. Channel secrets, Messaging API tokens, database
credentials and JWT signing keys live on the backend.

Authorization is the backend's job. The client never sends `property_id`,
`room_id` or `tenant_id` — the server derives every authorized resource from
the authenticated session. `GET /api/v1/me` returns the context the server
decided on.

Authentication sends the LINE **ID token** (signed by LINE, verifiable by the
backend) rather than the access token. The returned session token is kept in
`sessionStorage`, so it does not outlive the MINI App window.

Raw API errors, stack traces and tokens are never rendered. `AppError` carries
a stable code that `bootstrap.js` maps to Thai copy; diagnostics go to the
console in non-production builds only.

## Backend API

```
POST /api/v1/auth/line     { id_token } -> { token }
GET  /api/v1/me            -> { user_id, tenant_id, property_id, property_name, room_id }
```

Phase 2 will add `/api/v1/me/property` and `/api/v1/me/room`.

## Design

The visual system is derived from `docs/dorm-uxui-v1.0.png`. Tokens live at the
top of `src/styles/app.css`:

| Token | Value | Use |
| --- | --- | --- |
| `--green` | `#009245` | Primary actions, LINE login, nav FAB |
| `--green-header` | `#008d58` | Home header block |
| `--bg` | `#f3f7f4` | Page ground |
| `--danger` | `#de0000` | Outstanding balance |
| `--blue` / `--purple` / `--orange` / `--red` | | Feature accents |

UX principles: mobile-first, Thai-first, fast startup, large touch targets,
minimal typing, important actions within one or two taps.
