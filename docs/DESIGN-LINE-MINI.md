# DESIGN-LINE-MINI.md

# dorm.place --- LINE MINI App Design Specification

## 1. Purpose

This document defines the initial technical and UX design for the
`dorm.place` LINE MINI App.

The LINE MINI App is the tenant-facing application for the dorm.place
multi-tenant SaaS platform.

The first implementation target is:

``` text
https://dorm.playxdev.com/
```

This is the **Developing** environment and will later be replaced by the
production domain:

``` text
https://app.dorm.place/
```

------------------------------------------------------------------------

## 2. Product Architecture

The platform uses one LINE MINI App for all participating dormitories.

It is built as three services over **one shared database**.

``` text
   LINE user                          dormitory owner / staff
       │                                        │
       ▼                                        ▼
 dorm.place MINI App                    dorm.place backoffice
   (playxdev/dormmini)                   (playxdev/dormplace)
   Cloudflare Pages                      Cloudflare Workers
       │                                        │
       │ HTTPS                                  │ D1 binding
       ▼                                        │
  Tenant API                                    │
   (playxdev/dormapi)                           │
   Go, container host                           │
       │ D1 REST                                │
       └──────────────┬─────────────────────────┘
                      ▼
                Cloudflare D1
                  `dorm-db`
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
    Building        Room         Contract
```

The backoffice **owns the schema**. Its `migrations/` directory is the single
place any table is defined or changed; the other services read the same
database and add none of their own.

A second database is not an option. The onboarding flow depends on a contract
activated in the backoffice being immediately visible to the MINI App, and D1
offers no query across databases — not even a join.

The application must NOT create a separate LINE MINI App per dormitory.

Example:

``` text
LINE User A
    └── Oscar Apartment
          └── Room A-203

LINE User B
    └── หอแต๋วแตก
          └── Room B-105
```

Both users use the same MINI App.

------------------------------------------------------------------------

## 3. Environments

### Development

``` text
MINI App Endpoint:
https://dorm.playxdev.com/

Environment:
Developing

Hosting:
Cloudflare Pages
```

### Production

``` text
MINI App Endpoint:
https://app.dorm.place/

Environment:
Published

Hosting:
Cloudflare Pages
```

Do not hard-code production URLs into the development build.

Use environment configuration.

------------------------------------------------------------------------

## 4. LINE MINI App

The LINE Developers Console contains three internal environments:

``` text
Developing
Review
Published
```

The initial implementation uses only:

``` text
Developing
```

Each environment has its **own** LIFF ID. They are not interchangeable.

``` text
Developing   2011361700-JZlB29PM
Review       2011361701-CK48xQPp
Published    2011361702-IZrdVpdn
```

The LIFF URL for an environment is:

``` text
https://miniapp.line.me/<LIFF_ID>
```

The LIFF ID must be stored in application configuration:

``` text
VITE_LINE_LIFF_ID=2011361700-JZlB29PM
```

A LIFF ID is public. It is inlined into the browser bundle by design and
identifies the app, not the account. The **channel secret** is different: it is
a credential, belongs on the backend only, and must never appear in the
frontend, in configuration committed to source control, or in a screenshot.

### Required scopes

``` text
profile
openid
```

`openid` is mandatory. Without it `liff.getIDToken()` returns `null`, the
backend has nothing to verify, and authentication cannot complete. Because a
fresh login still yields no token in that state, the app treats a missing ID
token as a configuration error rather than retrying the login.

### Endpoint URL

The endpoint URL is configured per environment in the LINE Developers Console
under **Web app settings**, and points at the deployed frontend.

``` text
Developing   →   https://dorm.playxdev.com/
Published    →   https://app.dorm.place/
```

Review and Published keep the LINE default endpoints until each is ready.

Never commit secrets or environment-specific credentials into source
control.

------------------------------------------------------------------------

## 5. Initial User Flow

The first milestone is to prove that a LINE user can open the MINI App
and be identified by dorm.place.

``` text
User
 │
 ▼
LINE
 │
 ▼
LINE MINI App
 │
 ▼
dorm.playxdev.com
 │
 ▼
LIFF initialization
 │
 ▼
LINE user profile
 │
 ▼
dorm.place Backend
 │
 ▼
Find/Create Tenant
 │
 ▼
Tenant Home
```

The application should not attempt to implement the full dormitory
management system in the first iteration.

------------------------------------------------------------------------

## 6. Application Bootstrap

On application startup:

1.  Load environment configuration.
2.  Initialize the LIFF SDK.
3.  Detect whether the application is running inside LINE.
4.  Check login state.
5.  If authentication is required, initiate LINE login.
6.  Obtain the authenticated LINE identity through the supported LIFF
    flow.
7.  Send the identity/authentication result to the dorm.place backend.
8.  Resolve the associated tenant/property/room.
9.  Render the tenant home screen.

Conceptual flow:

``` javascript
await liff.init({
    liffId: LINE_LIFF_ID,
    withLoginOnExternalBrowser: true
});

if (!liff.isLoggedIn()) {
    liff.login();
}
```

`withLoginOnExternalBrowser` makes LIFF perform the login redirect itself when
the app is opened outside the LINE client, so a desktop or mobile browser
reaches an authenticated state rather than stalling as logged out.

One consequence is that the login screen is effectively only reachable inside
the LINE client, and even there the user is already authenticated. It remains
in the codebase as the fallback for a failed or cancelled login.

The exact authentication implementation must follow the current LINE
LIFF/MINI App documentation and should not expose channel secrets in
browser code.

------------------------------------------------------------------------

## 7. Identity Model

LINE identity and dorm.place identity are different concepts.

LINE:

``` text
line_user_id        the `sub` claim of a verified ID token
```

dorm.place:

``` text
users               one row per person
identities          one row per way that person signs in
memberships         which buildings a person administers
contracts           which room a person rents
```

### A person is one account

Sign-in providers are planned across LINE, Google, Facebook and email, so the
provider cannot live on the account itself.

``` text
identities
├── (line,     U56feab…)  ──┐
├── (google,   107812…)   ──┼──►  users.id
└── (email,    a@b.com)   ──┘
```

Adding a second provider later adds a row here, not a second account.

`users.email` and `users.password_hash` are both nullable: a tenant who signs
in with LINE has neither.

### Role is a relationship, not an attribute

An owner may rent a room in someone else's building. A tenant may buy a
building years later. Storing a single role on the person breaks at the first
such case.

``` text
memberships   user_id + building_id + role(owner|staff)   ← administers
contracts     tenant_id → tenants.user_id                 ← rents
```

Seat-based billing counts rows in `memberships`.

### A tenant record can exist before the account

The owner writes the contract at signing, when the tenant may never have opened
the app.

``` text
owner fills in the contract
    └── tenants row created, user_id NULL
              │
              │  tenant scans the QR and signs in with LINE
              ▼
    identities row added, tenants.user_id filled in
```

Nothing is created twice. The identity attaches to the record the owner already
made, which is why the review screen has real terms to show.

### Authorization

The backend is the source of truth.

The browser must never decide which building or room a user belongs to. No
endpoint accepts a `building_id`, `room_id` or `tenant_id` from the client;
each is reached by joining the caller's session to the row that grants access:

``` sql
JOIN tenants t ON t.user_id = ?session
```

Written this way, forgetting the constraint returns nothing rather than
returning someone else's data — the failure is visible instead of silent.

## 8. Multi-Tenant Design

The same MINI App must dynamically load property-specific configuration.

Example:

``` text
Property
├── property_id
├── name
├── logo
├── contact
├── theme
└── settings
```

The frontend receives the authorized property context from the backend.

Example:

``` json
{
  "property_id": "P001",
  "property_name": "Oscar Apartment",
  "room_id": "A-203"
}
```

The application can then render:

``` text
Oscar Apartment

ห้อง A-203
```

For another tenant:

``` text
หอแต๋วแตก

ห้อง B-105
```

No separate MINI App is required.

------------------------------------------------------------------------

## 9. Initial UI

The first screen should be intentionally simple.

### Unauthenticated

``` text
┌─────────────────────────┐
│                         │
│       dorm.place        │
│                         │
│   ระบบจัดการหอพัก       │
│                         │
│   [ เข้าสู่ระบบด้วย LINE ] │
│                         │
└─────────────────────────┘
```

### Authenticated

``` text
┌─────────────────────────┐
│  dorm.place             │
│                         │
│  สวัสดี, คุณสมชาย       │
│  Oscar Apartment        │
│  ห้อง A-203             │
│                         │
│ ┌─────────────────────┐ │
│ │ ค่าใช้จ่าย           │ │
│ │ ฿5,250              │ │
│ └─────────────────────┘ │
│                         │
│  ใบแจ้งหนี้              │
│  การชำระเงิน             │
│  แจ้งซ่อม                │
│  ประกาศ                  │
│                         │
└─────────────────────────┘
```

For the first MVP, only the identity/property information is required.

------------------------------------------------------------------------

## 10. MVP Scope

### Phase 1 --- Authentication

Required:

-   LINE MINI App bootstrap
-   LIFF initialization
-   LINE authentication
-   Retrieve LINE profile
-   Backend authentication
-   User lookup/creation
-   Tenant/property/room resolution
-   Basic authenticated home screen

Not required yet:

-   Payment
-   Invoice
-   Meter reading
-   Repair requests
-   Notifications
-   Admin functions

### Phase 2 --- Tenant Features

``` text
Home
├── My Room            done
├── Invoice            done
├── Payment            done (PromptPay QR + reported notice)
├── Water/Electricity  blocked on file storage for meter photos
├── Repair Request     done
└── Announcements      not started
```

Meter readings remain blocked on a decision rather than on work: where the
photo of the meter is stored.

### Phase 3 --- LINE Messaging

The backend will later integrate LINE Messaging API.

``` text
dorm.place Backend
       │
       ▼
LINE Messaging API
       │
       ▼
Tenant LINE
```

Use cases:

-   New invoice
-   Payment reminder
-   Payment confirmation
-   Repair status
-   Announcement
-   Meter reading result

Messaging is a backend capability and must not be implemented by
exposing messaging credentials in the MINI App frontend.

------------------------------------------------------------------------

## 11. Backend API

The MINI App talks only to the tenant API over HTTPS. The backoffice does not
serve it, and the MINI App never reaches the database.

``` text
POST /api/v1/auth/line              { id_token } -> { token, expires_at }
GET  /api/v1/me                     identity, building, room
GET  /api/v1/me/invoices            list + outstanding total
GET  /api/v1/me/invoices/{id}       items and payments
GET  /api/v1/me/invoices/{id}/payment   PromptPay payloads, full and open
POST /api/v1/me/invoices/{id}/payments  report a transfer the owner will verify
GET  /api/v1/me/repairs             list
POST /api/v1/me/repairs             file one
GET  /api/v1/me/repairs/{id}        one
GET  /api/v1/invites/{code}         terms to review before confirming
POST /api/v1/invites/{code}/claim   confirm and bind
GET  /healthz
```

### Conventions

**Money is integer satang** everywhere, in the database and on the wire. Never
a float, never a pre-formatted string — the client decides how it reads.

**Dates are Gregorian and ISO.** Buddhist-era years are a presentation
concern, converted once in the client.

**Errors are stable codes, not messages.** The client maps them to Thai copy of
its own; a leaked SQL or LINE error would reach the tenant as noise.

``` json
{ "error": "tenancy_not_found" }
```

**A missing row and someone else's row return the same 404.** Distinguishing
them would confirm that another tenant's record exists.

**Only verified payments count as paid.** A slip the tenant submitted but the
owner has not accepted must not make an invoice look settled.

This rule binds the backoffice too. `dormplace` tracks `invoices.paid_total`
and used to insert owner-recorded payments on the column default of
`verified = 0`; `dormapi` sums only `verified = 1`. A payment the owner had
recorded therefore left the tenant staring at an unchanged balance. Recording a
payment in the backoffice now writes `verified = 1`, because the owner doing
the recording *is* the verification.

## 12. Security

### Never expose

-   LINE channel secret
-   Messaging API channel access token
-   Database credentials
-   Backend private keys
-   JWT signing secrets

These belong on the server.

### Browser may contain

-   Developing LIFF ID
-   Public application configuration
-   API base URL

### Authorization

Every protected API request must be authorized by the backend.

Do not trust:

``` text
property_id
room_id
tenant_id
```

when supplied directly by the client.

The server must derive authorized resources from the authenticated user.

------------------------------------------------------------------------

## 13. Domain Strategy

### Development --- PlayDevX root domain

The development root domain is:

``` text
playxdev.com
```

The Dorm project uses:

``` text
Frontend:      https://dorm.playxdev.com
Backend API:   https://apidorm.playxdev.com
```

### API subdomain naming convention

PlayDevX hosts multiple projects and each project may have its own API.
API subdomains are therefore project-level, directly under the root domain:

``` text
api<project>.playxdev.com
```

Examples:

``` text
apidorm.playxdev.com
apipenbun.playxdev.com
apiedv.playxdev.com
```

Do NOT use a nested form such as:

``` text
api.dorm.playxdev.com
```

The nested form would make each project its own zone-like namespace and
defeats the flat, project-level API convention.

Note also that the root domain is `playxdev.com`, not `playdevx.com`.

### Production

Recommended future production structure:

``` text
app.dorm.place
api.dorm.place
```

`dorm.place` is the product's own domain rather than a shared multi-project
root, so the nested `api.` form is correct there. The `api<project>` convention
applies only under `playxdev.com`.

Example:

``` text
LINE MINI App
    │
    ▼
app.dorm.place
    │
    ▼
api.dorm.place
```

The domain migration must not require creating another LINE MINI App.

Only the appropriate LINE MINI App endpoint/configuration should be
updated during production rollout.

------------------------------------------------------------------------

## 14. Repository Structure

Three repositories, one database.

``` text
playxdev/dormplace   backoffice   TypeScript on Workers, D1 binding
                                  OWNS THE SCHEMA — migrations live here
                                  checked out locally as works/dorm/backend

playxdev/dormapi     tenant API   Go, container host, D1 over REST

playxdev/dormmini    MINI App     Vite + vanilla JS, Cloudflare Pages
```

Note the local path mismatch: `dormplace` sits in a directory called
`backend`, which makes it easy to miss.

**No service outside `dormplace` defines a table.** A schema change is a
migration in `dormplace/migrations`, applied once to `dorm-db`.

MINI App structure:

``` text
dorm-mini/
├── public/
│   ├── favicon.svg
│   ├── _headers
│   └── assets/
│
├── src/
│   ├── main.js
│   │
│   ├── app/
│   │   ├── bootstrap.js
│   │   └── config.js
│   │
│   ├── auth/
│   │   ├── line.js
│   │   └── session.js
│   │
│   ├── api/
│   │   └── client.js
│   │
│   ├── pages/
│   │   ├── login.js
│   │   └── home.js
│   │
│   └── styles/
│       └── app.css
│
├── index.html
├── vite.config.js
├── wrangler.jsonc
├── .env.example
└── README.md
```

Keep LINE-specific logic isolated in the `auth` module.

The build tool is Vite. `src/main.js` is the module entry point and does
nothing but import the stylesheet and call `bootstrap.start()`.

------------------------------------------------------------------------

## 15. Configuration

Example `.env.example`:

``` env
VITE_APP_ENV=development

VITE_APP_URL=https://dorm.playxdev.com
VITE_API_BASE_URL=https://apidorm.playxdev.com

VITE_LINE_LIFF_ID=<DEVELOPING_LIFF_ID>

VITE_MOCK=0
```

Vite only exposes variables prefixed with `VITE_` to browser code. The prefix is
a deliberate guard: an unprefixed variable can never leak into the bundle by
accident.

Every `VITE_*` value is inlined at build time, so these are build inputs rather
than runtime settings. On Cloudflare Pages they must be configured as build
environment variables (see section 21).

`VITE_MOCK=1` runs the app with fixture data and no LIFF or backend calls. It is
a development aid only and must never be enabled in a deployed build.

Do not commit the actual `.env` file if it contains environment-specific
private configuration.

------------------------------------------------------------------------

## 16. Error States

The MINI App must handle at least:

``` text
LINE SDK initialization failed
        ↓
Unable to initialize application

Not logged in
        ↓
Login with LINE

Authenticated but tenant not found
        ↓
ยังไม่ได้ผูกบัญชีกับหอพัก

Backend unavailable
        ↓
ไม่สามารถเชื่อมต่อระบบได้
```

Never display raw API errors, stack traces, tokens, or secrets to users.

------------------------------------------------------------------------

## 17. UX Principles

The MINI App is a mobile-first application.

Principles:

-   Fast startup
-   Minimal navigation
-   Large touch targets
-   Thai-first UX
-   Clear property identity
-   Minimal typing
-   Avoid unnecessary forms
-   Use LINE identity whenever possible
-   Keep important actions within one or two taps

The MINI App should feel like a lightweight LINE-native service rather
than a desktop website compressed onto a phone.

------------------------------------------------------------------------

## 18. First Development Milestone

The first successful demo is considered complete when this flow works:

``` text
1. Open MINI App from LINE
          ↓
2. dorm.playxdev.com loads
          ↓
3. LIFF initializes
          ↓
4. LINE user authenticates
          ↓
5. Backend receives authenticated identity
          ↓
6. Backend resolves user
          ↓
7. MINI App displays:

   ชื่อผู้ใช้
   Property
   Room
          ↓
8. User can close the MINI App
```

Do not proceed to payment, messaging, invoices, or advanced tenant
features until this flow is stable.

**Status: complete.** Verified end to end on 2026-09-01 — the MINI App opens
from LINE, LIFF initialises, the user authenticates, the backend verifies the
ID token with LINE, resolves the account through `identities`, and renders the
building and room.

------------------------------------------------------------------------

## 19. Future Production Architecture

``` text
                           LINE
                            │
                            ▼
                  ┌──────────────────┐
                  │ dorm.place MINI  │
                  │      App         │
                  └────────┬─────────┘
                           │
                           ▼
                    app.dorm.place
                           │
                           ▼
                    api.dorm.place
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
          Identity      Property       Tenant
             │             │             │
             └─────────────┼─────────────┘
                           │
                           ▼
                        Database
                           │
                           │
                           ▼
                  LINE Messaging API
                           │
                           ▼
                     Tenant LINE
```

------------------------------------------------------------------------

## 20. Design Decision

### One platform, one MINI App

`dorm.place` is a multi-tenant platform.

Therefore:

``` text
1 LINE MINI App
1 LINE Login identity integration
1 Backend platform
1 Database
N Properties
N Tenants
N Rooms
```

### One database, not one per dormitory

A database per dormitory was considered and rejected.

The tenant-facing app is inherently cross-dormitory: one LINE identity may hold
contracts in two different buildings, and the identity itself belongs to no
building at all. D1 has no query across databases, so answering "which rooms are
mine?" would mean one HTTPS request per dormitory on every app launch.

Schema changes would also have to be applied N times, with partial failure
leaving databases on different versions — worst during beta, when the schema
moves most.

Isolation is instead enforced in the query shape (§7): access is reached by
joining the caller's session, so a forgotten constraint returns nothing rather
than someone else's data.

If one customer ever needs physical isolation, that customer alone can be moved
to their own database, because the schema is identical.

The property is a data/configuration boundary, not a LINE application
boundary.

This decision is fundamental to keeping dorm.place scalable as a SaaS
platform.

------------------------------------------------------------------------

## 21. Deployment

The MINI App is a static build. It has no server runtime of its own --- all
logic that requires a server belongs to the backend API.

Hosting:

``` text
Cloudflare Pages
```

``` text
Vite build
    │
    ▼
dist/
    │
    ▼
Cloudflare Pages
    │
    ▼
dorm.playxdev.com   (Developing)
app.dorm.place      (Published)
```

`wrangler.jsonc` declares `pages_build_output_dir`, which is what identifies
the project as Pages rather than a Worker.

Cloudflare now recommends Workers with static assets for new projects. Pages
remains supported and actively maintained. Migrating later replaces
`pages_build_output_dir` with an `assets` block and does not affect application
code.

### Build-time configuration

Every `VITE_*` value is inlined into the bundle during the build. They are
build inputs, not runtime settings.

On Cloudflare Pages they must be set as build environment variables for both
the Production and Preview environments:

``` text
VITE_APP_ENV
VITE_APP_URL
VITE_API_BASE_URL
VITE_LINE_LIFF_ID
```

Only public configuration may appear here. This is a direct consequence of
section 12: anything inlined into the bundle is readable by anyone.

### Deployment methods

Direct upload:

``` text
npm run deploy
```

Pages configuration files do not accept `account_id`. Where a token can reach
more than one account, `CLOUDFLARE_ACCOUNT_ID` selects the target.

Git-connected build:

``` text
Build command:            npm run build
Build output directory:   dist
```

A push to `main` deploys production. Other branches receive preview URLs.

### Caching

`public/_headers` is copied verbatim into the build.

``` text
/static/*        immutable, 1 year    (content-hashed Vite output)
/assets/*        1 hour               (stable filenames from public/assets)
/                no-cache             (references hashed filenames)
/index.html      no-cache
```

`vite.config.js` sets `assetsDir` to `static` so that hashed output never
shares a path prefix with the unhashed contents of `public/assets`.

### Framing headers

No `X-Frame-Options` or `frame-ancestors` directive is set.

LINE MINI Apps run inside the LINE in-app browser and the LIFF login flow
performs cross-origin redirects. Framing restrictions break those flows.

### LINE endpoint

After deployment, the LINE Developers Console endpoint URL for the target
environment is pointed at the Pages deployment.

``` text
Developing   →   https://dorm.playxdev.com/
Published    →   https://app.dorm.place/
```

Consistent with section 13, changing the endpoint never requires creating a
second LINE MINI App.

------------------------------------------------------------------------

## 22. Tenant Onboarding

How a LINE user comes to be bound to one room in one building.

### The rule that shapes everything

A room number is guessable. If a tenant could pick a building and type "609",
they would see someone else's bills and file repairs against someone else's
room.

**Binding must always be authorised by the dormitory side.**

### Primary flow: QR issued at handover

The dormitory already knows who lives where. That knowledge is the
authorisation.

``` text
owner                                        tenant
  │
  │ backoffice: fills in the contract
  │ marks the room active
  ▼
system issues an invite code + QR
  │
  │  QR shown on the owner's screen
  │  at handover
  │                                    adds the LINE Official Account
  │                                          │
  │                                    opens the MINI App, signs in
  │                                          │
  │                                    "not linked to a dormitory yet"
  │                                          │
  ├───────── scans ─────────────────►  liff.scanCodeV2()
                                            │
                                    GET /api/v1/invites/{code}
                                            │
                              ┌─────────────────────────┐
                              │ Oscar Apartment         │
                              │ Room 609                │
                              │ Rent      4,500.00      │
                              │ Deposit   9,000.00      │
                              │ From      1 Oct 2569    │
                              │                         │
                              │  ═══ slide to confirm ══ │
                              └─────────────────────────┘
                                            │
                              POST /api/v1/invites/{code}/claim
                                            │
                                            ▼
                                       home screen
```

The tenant types nothing.

### Where the QR comes from

The backoffice issues it. `GET /contracts/:id/invite` in `dormplace` shows the
current code for a contract, with buttons to issue, reissue and revoke.

Reissuing revokes the previous code in the same write. A QR already shown or
printed stops working rather than staying quietly valid beside its replacement
— two live codes for one room is a state nobody can reason about later.

Codes expire 30 days after issue. Long enough for a tenant who moves in on a
Friday and gets to it the following weekend; short enough that an abandoned
code does not stay usable for a year.

Only an `active` contract can be given a code. A QR for an ended contract would
bind a tenant to a room they have left.

### The QR carries only a code

``` text
✅  https://miniapp.line.me/<LIFF_ID>?invite=K7M9P4QX
❌  {"name":"...","room":"609","rent":450000}
```

Encoding the terms would hand them to anyone who photographs the code, and
could never be revoked. What the QR holds is opaque; the app fetches the terms
from the backend, which can expire or revoke the code at any time.

The QR encodes the permanent link rather than the bare code so that any camera
opens the MINI App. Requiring the tenant to already be inside the app before
scanning would make the QR useless in the one moment it is most wanted — the
tenant standing at the door with the sheet in their hand.

### The printed sheet

`/contracts/:id/invite/print` produces an A5 sheet: the QR, the code in large
type, and the four steps in Thai.

This is a deliberate softening of an earlier rule that the QR should live only
on the owner's screen. That rule protected the *terms*, and the terms are not
in the QR — a photographed sheet yields a code that is single use, expiring and
revocable. What it does hand over is the chance to claim the room before the
real tenant does, so the sheet is a handover document, not a notice to pin up.
Suspected exposure is answered by reissuing, which invalidates it.

### Code alphabet

Codes exclude `0 O`, `1 I L`, `2 Z`, `5 S` and `8 B`, because an owner will
read one aloud over the phone.

This is not hypothetical: development of this app lost several rounds to a LIFF
ID transcribed from a screenshot in which a lowercase `l` was read as an
uppercase `I`.

### Single use without a transaction

D1 permits no parameterised multi-statement write (§21), so the claim cannot be
a transaction. The guard is in the statement itself:

``` sql
UPDATE contracts SET confirmed_by_user_id = ?1, ...
WHERE confirmed_by_user_id IS NULL AND ...
```

A second claim matches no rows. Linking `tenants.user_id` follows as a separate
idempotent statement, so a failure between the two is repaired by retrying.

### What confirming records

The confirmation stores a **snapshot** — the rent, deposit and start date as
they stood when the tenant saw them — not a reference to the contract.

If the owner later amends the rent, the tenant's record of what they agreed to
must not move with it. That snapshot is the answer to "what did I agree to?"
months afterwards.

### Fallback

Scanning is unavailable below iOS 14.3, on desktop, and whenever the tenant is
not standing in front of the owner. The same code therefore also works as a
link:

``` text
https://miniapp.line.me/<LIFF_ID>?invite=K7M9P4QX
```

One code, two ways in — not two systems.

### The LINE Official Account's role

The OA is the distribution and notification channel, not a gate.

Adding it is offered through the MINI App's own add-friend option at login,
never enforced: a tenant who declines must still be able to reach their room.
A prompt on the home screen can ask again later.

### Requirements

- **Scan QR** must be enabled for the LIFF app in the LINE Developers Console.
- On iOS, `liff.scanCodeV2()` works only when the LIFF size is `Full`.

## 23. Payment

### The money does not pass through this system

The tenant transfers to the owner's bank account. Nothing here observes it. Two
things follow, and every screen is shaped by them.

**The QR is a payment instruction, not a transaction.** It is a PromptPay
EMVCo payload built from the owner's PromptPay ID. Scanning it opens the
tenant's banking app; what happens next is between the tenant and their bank.

**A balance can only move on the owner's word.** The tenant reports the
transfer, the owner matches it against their statement, and only then does the
invoice change.

### Two payloads, because one cannot do both

``` text
payload_full   amount embedded      tap, confirm, cannot mistype
payload_open   no amount            tenant types the amount
```

A payload with an amount in it cannot be paid in instalments — the bank fills
the field and locks it. Dormitories that allow instalments need the open one.
The screen defaults to the full amount, because most tenants pay in full and
a typed amount is a chance to get it wrong.

The distinction is in the payload itself: an open payload omits tag `54` and
carries initiation method `11` (static), the full one `12` (dynamic).

### The same generator in two languages

`dormplace` builds payloads in TypeScript for its own invoice pages;
`dormapi` builds them in Go for the MINI App. Two implementations of one
byte-exact format is a standing risk — a divergence would surface as a bank app
refusing to read the QR, in front of a tenant.

So `dormapi`'s tests assert byte equality against payloads generated by the
TypeScript implementation, over eight cases spanning mobile numbers, national
IDs, e-wallet IDs, with and without an amount. Conformance is proved, not
assumed.

### The verification loop

``` text
tenant                                       owner
  │
  │ scans the QR on the invoice
  │ transfers in their banking app
  │
  │ reports: amount + reference
  ▼
POST /me/invoices/{id}/payments
  │  writes verified = 0
  │  invoice balance unchanged
  │
  │  MINI App shows the notice in orange:
  │  "แจ้งชำระ รอตรวจสอบ", not subtracted
  │                                    backoffice: /invoices lists every
  │                                    unverified notice across all invoices
  │                                             │
  │                                    checks the bank statement
  │                                             │
  │                              ┌──────────────┴──────────────┐
  │                        POST /payments/{id}/verify   POST /payments/{id}/delete
  │                              │                             │
  │                     verified = 1                     row removed
  │                     paid_total moves                 paid_total untouched
  ▼                              │                             │
balance drops  ◄─────────────────┘                             │
                                                    tenant may report again
```

Rejecting an unverified notice must not subtract from `paid_total`, because
verifying it was what would have added it. Getting that backwards would credit
a tenant for a payment the owner just said never arrived.

### Retries are not second payments

A tenant on a weak connection will tap twice. `payments.idempotency_key` is
unique, the client sends a `crypto.randomUUID()` per submission, and a repeat
returns `202` while inserting nothing.

The column is nullable and SQLite permits many NULLs in a unique index, so rows
the backoffice creates need no key.

### Not yet built

Slip images. The tenant reports an amount and a reference; the owner matches
those against a statement by hand. Uploading the slip needs R2 and an S3-API
client in Go, and was cut from the first slice deliberately — a slip is
evidence for a human, and the human can already do the job without it.
