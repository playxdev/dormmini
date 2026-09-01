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

``` text
                         LINE
                          │
                          ▼
                 dorm.place MINI App
                          │
                          ▼
                dorm.place Web App
                          │
                          ▼
                  Backend API
                          │
             ┌────────────┼────────────┐
             ▼            ▼            ▼
          Tenant       Property       Room
```

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
line_user_id
```

dorm.place:

``` text
user_id
tenant_id
property_id
room_id
```

Recommended relationship:

``` text
LINE User
    │
    ▼
User Account
    │
    ▼
Tenant
    │
    ├── Property
    │
    └── Room
```

The backend is the source of truth for authorization.

The browser must never decide which property or room a user belongs to.

------------------------------------------------------------------------

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
├── My Room
├── Invoice
├── Payment
├── Water/Electricity
├── Repair Request
└── Announcements
```

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

The MINI App should communicate with the dorm.place backend through
HTTPS.

Suggested API structure:

``` text
POST /api/v1/auth/line
GET  /api/v1/me
GET  /api/v1/me/property
GET  /api/v1/me/room
```

Example:

``` text
LINE MINI App
      │
      │ HTTPS
      ▼
https://apidorm.playxdev.com
```

The exact backend implementation is intentionally independent of the
frontend.

------------------------------------------------------------------------

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

Recommended frontend structure:

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
N Properties
N Tenants
N Rooms
```

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
