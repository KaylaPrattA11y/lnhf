# Lower Notley Hall Farm — Website

[![Netlify Status](https://api.netlify.com/api/v1/badges/98b68b14-ec53-4eb4-a5c2-50c1d9b96ec0/deploy-status)](https://app.netlify.com/projects/lowernotleyhallfarm/deploys)

The official website for **Lower Notley Hall Farm**, a historic waterfront wedding venue in Chaptico, Southern Maryland. Built with Astro 6, React 19, TinaCMS, and Netlify Database (Postgres), deployed on Netlify.

**Live site:** https://lowernotleyhallfarm.com
**Owners:** Jack & Cindy | **Phone:** (301) 769-2030
**Address:** 36290 Notley Manor Ln, Chaptico, MD 20621

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Getting Started](#getting-started)
4. [Environment Variables](#environment-variables)
5. [Development Commands](#development-commands)
6. [Pages](#pages)
7. [Content Management (TinaCMS)](#content-management-tinacms)
8. [Booking System](#booking-system)
9. [Netlify Functions API](#netlify-functions-api)
10. [Admin Panel](#admin-panel)
11. [Forms (Netlify Forms)](#forms-netlify-forms)
12. [Styling](#styling)
13. [Deployment](#deployment)
14. [Security Notes](#security-notes)
15. [Contributing](#contributing)

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | [Astro](https://astro.build) | 6.3.1 |
| UI Components | [React](https://react.dev) | 19.1.0 |
| CMS | [TinaCMS](https://tina.io) | 2.6.4 |
| Database | [Netlify Database](https://docs.netlify.com/build/data-and-storage/netlify-database/) (managed Postgres) | `@netlify/database` |
| Deployment | [Netlify](https://netlify.com) | — |
| Auth | [Netlify Identity](https://docs.netlify.com/security/secure-access-to-sites/identity/) | Widget 1.9.2 |
| Styling | Vanilla CSS (custom properties) | — |
| Language | TypeScript (strict) | 5.8.3 |
| Node | v22 | — |

---

## Project Structure

```
lnhf/
├── .tina/
│   └── config.ts               # TinaCMS schema & cloud config
├── netlify/
│   ├── database/
│   │   └── migrations/
│   │       └── 0002_tours_and_weddings_schema/migration.sql  # Core tours + weddings schema
│   └── functions/
│       ├── utils/
│       │   └── db.ts            # Netlify Database client singleton
│       ├── get-tour-slots.ts         # GET  /.netlify/functions/get-tour-slots
│       ├── create-tour-booking.ts    # POST /.netlify/functions/create-tour-booking
│       ├── admin-tours.ts            # GET  /.netlify/functions/admin-tours (admin only)
│       ├── admin-tour-slot.ts        # POST/PATCH/DELETE (admin only)
│       └── generate-seeded-tour-slots.ts  # Scheduled monthly seeded-slot sync
├── public/
│   ├── logo.svg                 # Brand crest
│   ├── robots.txt
│   └── images/                  # Static images (gallery, OG, etc.)
├── src/
│   ├── components/
│   │   ├── about/
│   │   │   └── LightboxGallery.tsx   # Keyboard-navigable photo lightbox
│   │   ├── admin/
│   │   │   ├── ToursAdmin.tsx        # Tours admin UI (Netlify Identity gated)
│   │   │   └── WeddingsAdmin.tsx     # Weddings admin UI (Netlify Identity gated)
│   │   ├── blog/
│   │   │   └── BlogCard.astro        # Reusable post card
│   │   ├── booking/
│   │   │   ├── BookingCalendar.tsx   # Monthly calendar, Sundays-only
│   │   │   └── BookingModal.tsx      # Booking form dialog
│   │   ├── home/
│   │   │   ├── Blockquote.astro
│   │   │   ├── Hero.astro
│   │   │   ├── tours.astro               # Tour booking calendar
│   │   │   ├── StatsBar.astro
│   │   │   ├── Testimonials.tsx      # Auto-advancing carousel
│   │   │   ├── TheSetting.astro
│   │   │   └── TourForm.astro        # Netlify Form for tour requests
│   │   │   ├── booking-manager/index.astro      # Admin portal (client:only)
│   │   │   ├── booking-manager/tours.astro      # Tours admin panel
│   │   │   ├── booking-manager/weddings.astro   # Weddings admin panel
│   │   │   ├── Footer.astro          # Map, contact info, quick links
│   │   │   └── Nav.astro             # Sticky nav, search, mobile menu
│   │   └── pricing/
│   │       └── PricingTable.tsx      # Interactive pricing estimator
│   ├── content/
│   │   ├── blog/                     # MDX blog posts (managed via TinaCMS)
│   │   ├── faqs/                     # MDX FAQ entries (managed via TinaCMS)
│   │   └── config.ts                 # Astro content collection schemas
│   ├── data/
│   │   └── pricing.ts                # Pricing constants & adjustments
│   ├── layouts/
│   │   ├── BaseLayout.astro          # Root HTML, meta tags, Netlify Identity
│   │   └── BlogLayout.astro          # Blog post wrapper
│   ├── pages/
│   │   ├── index.astro               # Home
│   │   ├── about.astro               # About / history / gallery
│   │   ├── tours.astro               # Tour booking calendar
│   │   ├── pricing.astro             # Package pricing estimator
│   │   ├── faqs.astro                # FAQ accordion
│   │   ├── contact.astro             # Contact form
│   │   ├── vendors.astro             # Preferred vendor directory
│   │   ├── booking-manager/index.astro # Admin portal (client:only)
│   │   ├── blog/index.astro          # Blog listing
│   │   ├── blog/[slug].astro         # Dynamic blog post
│   │   └── contact/success.astro     # Form submission thank-you
│   ├── styles/
│   │   ├── global.css                # Reset, utilities, .btn, .form-*
│   │   └── variables.css             # CSS custom properties (design tokens)
│   └── env.d.ts                      # TypeScript env type declarations
├── astro.config.mjs
├── netlify.toml
├── tsconfig.json
├── .env.example
└── package.json
```

---

## Getting Started

### Prerequisites

- **Node.js v22+** (matches Netlify build environment)
- **npm** v10+
- **Netlify CLI** — `npm install -g netlify-cli` (required to run functions and the local database)
- A **TinaCMS Cloud** account (free tier works)
- A **Netlify** account linked to this project (`netlify link`)

### 1. Clone & install

```bash
git clone https://github.com/KaylaPrattA11y/lnhf.git
cd lnhf
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in all four variables (see [Environment Variables](#environment-variables) below).

### 3. Start the dev server

```bash
# Full stack — Netlify Functions + local Postgres + TinaCMS + Astro (recommended)
npm run dev
```

This runs `netlify dev`, which starts:
- Astro at **http://localhost:4321** (proxied through Netlify at **http://localhost:8888**)
- TinaCMS local mode (CMS admin at http://localhost:8888/admin)
- All Netlify Functions at `http://localhost:8888/.netlify/functions/*`
- A local Postgres database (auto-provisioned; no external DB needed)

### 4. Apply database migrations

On first run, apply the schema to the local database:

```bash
netlify database migrations apply
```

### 5. Run seeded slot sync (optional)

Seed future tour slots from `src/content/tour-time-slots` (based on each slot's `seedSlotOnDay` values):

```bash
curl -X POST http://localhost:8888/.netlify/functions/generate-seeded-tour-slots
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. **Never commit `.env` to git.**

| Variable | Description | Where to get it |
|---|---|---|
| `TINA_PUBLIC_CLIENT_ID` | TinaCMS project client ID | app.tina.io → Project → Overview |
| `TINA_TOKEN` | TinaCMS read/write token | app.tina.io → Project → Overview |
| `TINA_SEARCH` | TinaCMS search token | app.tina.io → Project → Overview |
| `NETLIFY_IDENTITY_URL` | Your Netlify site URL (for Identity) | Netlify Dashboard → Site settings → Identity |
| `NETLIFY_EMAILS_SECRET` | Secret required to call Netlify Email templates from functions | Netlify Dashboard → Site configuration → Environment variables |
| `NETLIFY_EMAILS_MAILGUN_DOMAIN` | Sender domain used for confirmation emails (for example `mg.lowernotleyhallfarm.com`) | Netlify Dashboard → Site configuration → Environment variables |
| `NETLIFY_EMAILS_FROM` *(optional)* | Full sender override (for example `noreply@lowernotleyhallfarm.com`) | Netlify Dashboard → Site configuration → Environment variables |
| `ENABLE_CONFIRMATION_EMAILS` *(optional)* | Confirmation email toggle. Defaults to enabled; set to `false` to disable. | Netlify Dashboard → Site configuration → Environment variables |
| `IP_ALLOWLIST` *(optional but recommended)* | Comma-separated list of allowed source IPs/CIDRs for protected admin routes (example: `203.0.113.10,198.51.100.0/24`) | Netlify Dashboard → Site configuration → Environment variables |

> **Database connection (`NETLIFY_TOURS_DB_URL`)** is injected automatically by `netlify dev` locally and by Netlify at build/runtime in production. You do not set this manually.

On Netlify, set the remaining variables under **Site configuration → Environment variables**. `NETLIFY_IDENTITY_URL` is injected automatically in production.

### IP allowlist format

The edge allowlist parser accepts a comma-separated list:

```bash
IP_ALLOWLIST=203.0.113.10,198.51.100.25,198.51.100.0/24
```

- Exact IPs are supported.
- IPv4 CIDR ranges are supported.
- If `IP_ALLOWLIST` is unset/empty, IP filtering is bypassed (safe default to avoid lockout).

---

## Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Start full stack via `netlify dev` (functions + local DB + TinaCMS + Astro) |
| `npm run build` | Run `tinacms build` then `astro build` |
| `npm run preview` | Serve the production `dist/` folder locally |
| `npm run db:migrate` | Apply pending migrations using Netlify CLI (local/linked environment) |
| `npm run db:migrate:neon` | Apply all migration.sql files to the DB from `DATABASE_URL` or the repo `.env` |
| `netlify database migrations apply` | Apply pending SQL migrations to the local database |
| `netlify database status` | Show local DB connection string and migration status |
| `netlify database connect` | Open an interactive psql session against the local database |

> **Tip:** TinaCMS local mode is included in `npm run dev` — content is read/written directly from your local filesystem. No cloud credentials are needed for local editing. The CMS UI is available at http://localhost:8888/admin.

### Force seeded slot sync (dev & staging)

The `generate-seeded-tour-slots` function runs automatically on the first day of each month at 00:00 UTC in production. To trigger it immediately during development:

```bash
curl -X POST http://localhost:8888/.netlify/functions/generate-seeded-tour-slots
```

This syncs slots for the next 12 months using the configured time ranges and weekdays. It inserts missing future slots and removes future unbooked slots that are no longer seeded. Safe to run multiple times.

---

## Pages

| Route | File | Description |
|---|---|---|
| `/` | `src/pages/index.astro` | Hero, stats bar, blockquote, venue overview, testimonials carousel, latest blog posts, tour request form |
| `/about` | `src/pages/about.astro` | Location, history, crest symbolism, room descriptions, photo gallery lightbox, CTA |
| `/tours` | `src/pages/tours.astro` | Interactive tour calendar; time slot picker; booking modal |
| `/pricing` | `src/pages/pricing.astro` | Interactive package estimator with running total; print/PDF button |
| `/faqs` | `src/pages/faqs.astro` | Accessible accordion sourced from content collection |
| `/contact` | `src/pages/contact.astro` | Contact form (Netlify Forms), address, phone, Facebook link |
| `/contact/success` | `src/pages/contact/success.astro` | Post-form-submission thank-you page |
| `/vendors` | `src/pages/vendors.astro` | Preferred vendor directory by category |
| `/blog` | `src/pages/blog/index.astro` | Blog post grid, sorted newest first |
| `/blog/[slug]` | `src/pages/blog/[slug].astro` | Individual post with optional photo gallery |
| `/booking-manager` | `src/pages/booking-manager/index.astro` | Admin portal (Netlify Identity required) |
| `/booking-manager/tours` | `src/pages/booking-manager/tours.astro` | Tours management panel (Netlify Identity required) |
| `/booking-manager/weddings` | `src/pages/booking-manager/weddings.astro` | Weddings management panel (Netlify Identity required) |

---

## Content Management (TinaCMS)

Blog posts and FAQs are managed through TinaCMS. The CMS admin UI lives at `/admin`.

### Content collections

#### Blog posts — `src/content/blog/*.mdx`

```typescript
{
  title:          string       // required, used as page title
  date:           Date         // publish date
  showOnHomepage: boolean      // whether to surface on the home page
  author?:        string
  excerpt?:       string       // used in BlogCard and meta description
  featuredImage?: string       // path to image in /public/images/
  photoGallery?:  string[]     // paths rendered as a gallery at end of post
}
```

#### FAQs — `src/content/faqs/*.mdx`

```typescript
{
  question:   string   // required, accordion header
  sortOrder?: number   // lower = appears first; default 99
}
// Body = the answer, written in MDX
```

### Editing locally

Run `npm run dev:cms`. Navigate to http://localhost:4321/admin. Changes are written directly to the MDX files in `src/content/`.

### Editing in production

Log in at `https://lowernotleyhallfarm.com/admin` using your TinaCMS Cloud account. Changes are committed directly to the `main` branch, triggering a Netlify redeploy.

---

## Booking System

Tours are configurable by time range and weekday via `src/content/tour-time-slots`.
Default seeded slots currently include:

| Slot | Time |
|---|---|
| 1 | 1:00 PM – 2:00 PM |
| 2 | 2:00 PM – 3:00 PM |
| 3 | 3:00 PM – 4:00 PM |

Admins can create additional slots at any time via the [Admin Panel](#admin-panel).

### Database schema

Managed Postgres via **Netlify Database**. Core migration: `netlify/database/migrations/0002_tours_and_weddings_schema/migration.sql`

```sql
CREATE TABLE tour_slots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date             TEXT NOT NULL,          -- 'YYYY-MM-DD'
  start_time       TEXT NOT NULL,          -- 'HH:MM'
  end_time         TEXT NOT NULL,          -- 'HH:MM'
  status           TEXT NOT NULL DEFAULT 'available',  -- 'available' | 'booked' | 'blocked'
  guest_name       TEXT,
  guest_email      TEXT,
  guest_phone      TEXT,
  guest_party_size INTEGER,
  guest_message    TEXT,
  booked_at        TIMESTAMPTZ,
  UNIQUE (date, start_time)
);
```

All API responses use `_id` (aliased from `id`) and camelCase field names for frontend compatibility.

### Slot auto-generation

`generate-seeded-tour-slots` is a **scheduled Netlify Function** that runs monthly (day 1 at 00:00 UTC). It looks 12 months ahead and syncs seeded slots from `seedSlotOnDay` in `src/content/tour-time-slots`.

- Inserts missing future slots for configured weekdays/time ranges.
- Removes future **unbooked** slots when a weekday is un-seeded.
- Never removes booked slots.

To trigger it immediately: see [Force seeded slot sync](#force-seeded-slot-sync-dev--staging).

### Booking flow

1. Visitor opens `/tours` — `BookingCalendar` fetches slots via `GET /.netlify/functions/get-tour-slots`.
2. Visitor clicks an available Sunday → time slot pills appear.
3. Visitor clicks a time → `BookingModal` opens.
4. On submit, `POST /.netlify/functions/create-tour-booking` uses a **SQL atomic `UPDATE ... WHERE status = 'available'`** to prevent double-booking. Returns `409 Conflict` if the slot was taken between the visitor opening the modal and submitting.
5. On success, a secondary `POST` to `/` (Netlify Forms) submits the hidden `booking` form, triggering an email notification to the venue.

### Adding slots (admin)

Slots are seeded by the scheduled sync function. Additional or one-off slots can be created via the [Admin Panel](#admin-panel) or directly via `POST /.netlify/functions/admin-tour-slot`.

---

## Netlify Functions API

All functions live in `netlify/functions/`. They are deployed automatically by Netlify.

### `GET /.netlify/functions/get-tour-slots`

Returns available and booked slots in a date range. Booking details are stripped from the response to protect guest privacy.

**Query parameters:**

| Param | Format | Required |
|---|---|---|
| `startDate` | `YYYY-MM-DD` | ✓ |
| `endDate` | `YYYY-MM-DD` | ✓ |

**Response `200`:**
```json
[
  { "_id": "ba8faa2c-...", "date": "2026-06-07", "startTime": "13:00", "endTime": "14:00", "status": "available" }
]
```

---

### `POST /.netlify/functions/create-tour-booking`

Books an available slot. Atomic — safe against race conditions.

**Request body (JSON):**

| Field | Type | Required |
|---|---|---|
| `slotId` | UUID string (from `get-tour-slots` response `_id`) | ✓ |
| `name` | string | ✓ |
| `email` | string | ✓ |
| `phone` | string | — |
| `partySize` | number | — |
| `message` | string | — |

**Responses:**
- `200` — Booking confirmed
- `400` — Validation error
- `409` — Slot already booked
- `500` — Server error

---

### `GET /.netlify/functions/admin-tours` *(auth required)*

Returns all slots including full booking details. Requires a valid Netlify Identity JWT in the `Authorization: Bearer <token>` header.

**Query parameters:** `startDate`, `endDate` (optional YYYY-MM-DD filters)

---

### `POST | PATCH | DELETE /.netlify/functions/admin-tour-slot` *(auth required)*

Manage individual slots. All methods require Netlify Identity JWT.

**POST** — Create a new slot:
```json
{ "date": "2026-06-07", "startTime": "10:00", "endTime": "11:00", "status": "available" }
```

**PATCH** — Update a slot's status, or cancel a booking (`unbook: true`):
```json
{ "id": "<uuid>", "status": "blocked" }
{ "id": "<uuid>", "unbook": true }
```

**DELETE** — Remove a slot permanently:
```json
{ "id": "<uuid>" }
```

---

## Admin Panel

The admin panel is available at `/booking-manager` with tours at `/booking-manager/tours`. It is a React component (`client:only="react"`) gated by **Netlify Identity**.

**To access:**
1. A Netlify Identity user must be invited via **Netlify Dashboard → Identity → Invite users**.
2. The invited user accepts the invite and sets a password.
3. Navigate to `/booking-manager` and log in with those credentials.

**Admin capabilities:**
- View all upcoming (and past) tour slots with guest details
- Add new tour slots for any Sunday with a chosen start time
- Block a slot (removes it from public availability without deleting it)
- Unblock a blocked slot
- Unbook a booked slot (restores it to `available`)
- Delete a slot permanently

---

## Forms (Netlify Forms)

All forms use `data-netlify="true"` and include a hidden honeypot field (`bot-field`) to reduce spam. Form submissions are forwarded to the email address configured in the Netlify dashboard under **Forms → Notifications**.

| Form name | Page | Fields |
|---|---|---|
| `tour-booking` | `/tours` (hidden) | name, email, phone, date, time, party-size, message |
| `contact` | `/contact` | name\*, email\*, phone, subject, message\* |

> **Email target:** Configure submission notifications in Netlify → Forms → `tour-booking` / `contact` → **Add notification → Email notification**.

---

## Styling

The site uses **vanilla CSS** with no CSS framework. Design tokens are defined as custom properties in `src/styles/variables.css` and consumed everywhere.

### Brand colors

| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#254aaf` | Buttons, links, active states |
| `--color-primary-dark` | `#1a3578` | Headings, hero backgrounds, nav |
| `--color-accent` | `#e2a120` | Gold accent — CTAs, dividers, badges |
| `--color-cream` | `#fdf8f0` | Alternate section backgrounds |

### Typography

- **Headings:** Cormorant Garamond
- **Body:** Jost
- Font sizes use `clamp()` for fluid scaling between mobile and desktop.

### Breakpoints

| Token / Usage | Width |
|---|---|
| Small (2-column grids) | 640px |
| Tablet | 768px |
| Desktop nav visible | 1024px |
| Wide containers | 1280px |

### Utility classes

Defined in `src/styles/global.css`:

- `.container` — max-width centered wrapper
- `.section` — standard vertical padding
- `.section--cream`, `.section--sm` — section modifiers
- `.btn`, `.btn--primary`, `.btn--secondary`, `.btn--outline-white`, `.btn--ghost`, `.btn--lg`, `.btn--sm`
- `.form-group`, `.form-label`, `.form-input`, `.form-textarea`, `.form-select`
- `.card`, `.section-header`, `.divider`, `.sr-only`, `.skip-link`
- `.bot-field` — honeypot hiding (off-screen + opacity 0)

---

## Deployment

The site deploys automatically to Netlify on push to `main`.

### Branches

| Branch | Environment | URL |
|---|---|---|
| `main` | Production | https://lowernotleyhallfarm.com |
| `staging` | Preview | Netlify-generated staging URL |

### Build process

```
npm run build
  └─ tinacms build         # generates /public/admin TinaCMS UI
  └─ astro build           # outputs static HTML/CSS/JS to dist/
```

### Netlify configuration highlights (`netlify.toml`)

- **Node version:** 22
- **Functions directory:** `netlify/functions`
- **Security headers** on all routes: `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS with 2-year max-age + preload
- **Immutable cache** on `/_astro/*` (hashed filenames, 1 year)

### Required Netlify settings

1. **Environment variables** — set all variables from `.env.example` in Site configuration → Environment variables. (`NETLIFY_TOURS_DB_URL` is managed automatically.)
2. **Database** — Netlify Database is automatically provisioned on first deploy. Migrations in `netlify/database/migrations/` are applied automatically during the build.
3. **Identity** — enable Netlify Identity, invite admin users.
4. **Forms** — enable Netlify Forms (automatic on first deploy); configure email notifications for `contact` and `tour-booking`.
5. **Custom domain** — add `lowernotleyhallfarm.com` and enable HTTPS.
6. **Admin IP allowlist (recommended)** — set `IP_ALLOWLIST` and keep the edge function mappings in `netlify.toml` for protected admin paths.

---

## Security Notes

- **Honeypot fields** on all public forms prevent basic bot spam.
- **Admin endpoints** (`admin-tours`, `admin-tour-slot`, `admin-weddings`) validate the Netlify Identity JWT on every request. Requests without a valid token receive `401 Unauthorized`.
- **Edge IP allowlist** can restrict admin surfaces before auth is even reached. `netlify/edge-functions/ip-allowlist.js` is mapped in `netlify.toml` to protect:
  - `/admin` and `/admin/*`
  - `/booking-manager` and `/booking-manager/*`
  - `/.netlify/functions/admin-*`
  Requests from non-allowlisted IPs receive `403 Forbidden`.
- **Double-booking** is prevented atomically via `UPDATE tour_slots SET status = 'booked' WHERE id = $1 AND status = 'available'` — no race condition possible.
- **Input sanitization** on `create-tour-booking`: all string inputs are trimmed and clamped to max lengths before being written to the database.
- **`/booking-manager`** pages are client-only React shells. The Netlify Identity check happens in the component before any admin API calls are made.
- **robots.txt** disallows `/admin/` from search engine indexing.
- **.env** is listed in `.gitignore` — secrets are never committed. The `.env.example` file contains only placeholder values.

### Known audit warnings

`npm audit` reports vulnerabilities in TinaCMS's transitive dependencies (`@tinacms/cli`, `jsonpath-plus`, `dompurify`, `mermaid`, `lodash`). These vulnerabilities:
- Are **inside the TinaCMS admin build tooling**, not in application runtime code.
- The path-traversal issues in `@tinacms/cli` affect the **local dev server only** — not the production static build.
- Cannot be `npm audit fix`'d without breaking TinaCMS compatibility.

Monitor TinaCMS releases for upstream fixes.

---

## Contributing

This project is private. For questions or changes, contact the site maintainer:

**Kayla Pratt** — [KaylaPrattA11y](https://github.com/KaylaPrattA11y)

---

*Lower Notley Hall Farm — "Step back in time, to a place where the past meets the present and your future begins."*
