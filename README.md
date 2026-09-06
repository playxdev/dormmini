# dorm-mini

`dorm.place` LINE LIFF app — the tenant-facing frontend for the dorm.place
multi-tenant dormitory management platform.

One LIFF app serves every dormitory. The property is a data boundary, not a
LINE application boundary.

| | |
| --- | --- |
| [`docs/DESIGN.md`](docs/DESIGN.md) | The specification — screens, LINE wiring, deployment, security, and the reasoning behind each |
| `TODO.md` | What is not built, deferred, or undecided. It spans all three services, so it sits beside `DORMPLACE.md` in the workspace rather than in this repository |

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

**1.0.0.** Every screen the system can serve is built, and every control leads
somewhere — nothing renders disabled.

```
Open from LINE → LIFF init → LINE login → backend auth
              → resolve tenant/property/room → home screen
```

| | |
| --- | --- |
| My Room | identity, building and room on the home screen |
| Invoice | outstanding balance, list, detail with line items |
| Payment | PromptPay QR, full or open amount, report a transfer |
| Water/Electricity | readings per month, previous → current and the units used |
| Repair Request | list, detail, filing one |
| Announcements | the building's notice board, unread badge, marked read on open |
| Menu | identity, every screen, the app version |

**Onboarding** is complete: an unlinked tenant can scan the QR the owner
issues, or type the code, review the terms, and slide to confirm. The same code
also arrives as `?invite=CODE` on the permanent link, for tenants who cannot
scan. The scan button on the tab bar runs the same flow for a tenant who
already has a room and is handed a second one.

Amounts cross the API as integer satang and dates in the Gregorian calendar.
`src/lib/format.js` is the only place either becomes what a Thai tenant reads —
baht with two decimals, and Buddhist-era years.

## Stack

- [Vite](https://vite.dev) — dev server and build
- [`@line/liff`](https://developers.line.biz/en/docs/liff/) — LINE Front-end Framework
- Vanilla ES modules, no UI framework

LINE-specific logic stays inside `src/auth/line.js`. No other module imports
`@line/liff`.

## Getting started

```bash
npm install
cp .env.example .env
# fill in VITE_LINE_LIFF_ID and VITE_API_BASE_URL
npm run dev
```

Every variable is described in [`docs/DESIGN.md`](docs/DESIGN.md), along with
the LIFF app and channel the values come from. Vite only exposes variables
prefixed with `VITE_` to browser code and inlines each into the bundle at build
time — so they are public by design, and no secret belongs in the list.

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
| `npm run deploy` | Build and deploy to Cloudflare Pages production (`--branch main`) |
| `npm run deploy:preview` | Build and deploy to the `preview` branch |

## Deployment

A static Vite build on **Cloudflare Pages**, project `dormmini`, live at
<https://dorm.playxdev.com> (also <https://dorm-mini.pages.dev>). The custom
domain is attached to the Pages project directly — no hand-written DNS record
and no origin IP. `wrangler.jsonc` declares `pages_build_output_dir`, which is
what marks the project as Pages rather than a Worker.

```bash
npx wrangler login   # once
npm run deploy
```

Three things bite here, and only here:

- **`wrangler pages deploy` infers the Pages branch from the current git
  branch.** Run from a feature branch it uploads a *preview* and still reports
  success, while `dorm.playxdev.com` keeps serving the previous bundle. Both
  scripts pass `--branch` explicitly for that reason.
- **`VITE_*` values are build inputs, not runtime bindings.** With direct
  upload they come from your local `.env`, because the build happens on your
  machine. On a git-connected build they must be set under *Settings →
  Environment variables* for Production and Preview, or they are simply missing
  from the deployed bundle.
- **Pages configuration files reject `account_id`** — it is a Workers-only
  field. Where a token can reach more than one account, select it with
  `CLOUDFLARE_ACCOUNT_ID`; `npx wrangler whoami` lists them.

`.node-version` pins Node to 22.16.0 for the Pages build image. Vite 7 needs
`^20.19.0 || >=22.12.0`; the v3 image already defaults to something compatible,
but pinning keeps an older image from silently failing.

Caching, framing headers and the LINE endpoint settings are in
[`docs/DESIGN.md`](docs/DESIGN.md).

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
│   ├── format.js      money and Thai date formatting
│   └── scanner.js     camera 2D code reader, for where LIFF has none
├── pages/
│   ├── login.js         unauthenticated screen
│   ├── home.js          identity, balance, tile grid
│   ├── bills.js         invoice list and detail
│   ├── payment.js       PromptPay QR and reporting a transfer
│   ├── repairs.js       list, detail, filing one
│   ├── announcements.js notice board and one notice
│   ├── meters.js        water and electricity per month
│   ├── menu.js          identity, every screen, version
│   ├── onboarding.js    scan, review terms, confirm
│   └── nav.js           shared bottom navigation
└── styles/
    └── app.css        design tokens and screen styles

public/
├── favicon.svg
├── _headers           Cloudflare Pages cache and security headers
└── assets/mascot.png

wrangler.jsonc         Cloudflare Pages project config
```
