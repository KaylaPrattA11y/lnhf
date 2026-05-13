# Lower Notley Hall Farm — Website

The official website for **Lower Notley Hall Farm**, a historic waterfront wedding venue in Chaptico, Southern Maryland. Built with Astro 5, React 19, TinaCMS, and MongoDB Atlas, deployed on Netlify.

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
| Framework | [Astro](https://astro.build) | 5.7.13 |
| UI Components | [React](https://react.dev) | 19.1.0 |
| CMS | [TinaCMS](https://tina.io) | 2.6.4 |
| Database | [MongoDB Atlas](https://www.mongodb.com/atlas) M0 (free tier) | Driver 6.14 |
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
│   └── functions/
│       ├── utils/
│       │   └── mongodb.ts       # Shared MongoDB connection singleton
│       ├── get-slots.ts         # GET  /api — public slot availability
│       ├── create-booking.ts    # POST /api — atomic slot booking
│       ├── admin-bookings.ts    # GET  /api — all slots (admin only)
│       └── admin-slot.ts        # POST/PATCH/DELETE (admin only)
├── public/
│   ├── logo.svg                 # Brand crest
│   ├── robots.txt
│   └── images/                  # Static images (gallery, OG, etc.)
├── src/
│   ├── components/
│   │   ├── about/
│   │   │   └── LightboxGallery.tsx   # Keyboard-navigable photo lightbox
│   │   ├── admin/
│   │   │   └── BookingAdmin.tsx      # Admin UI (Netlify Identity gated)
│   │   ├── blog/
│   │   │   └── BlogCard.astro        # Reusable post card
│   │   ├── booking/
│   │   │   ├── BookingCalendar.tsx   # Monthly calendar, Sundays-only
│   │   │   └── BookingModal.tsx      # Booking form dialog
│   │   ├── faqs/
│   │   │   └── FAQAccordion.tsx      # Accessible accordion
│   │   ├── home/
│   │   │   ├── Blockquote.astro
│   │   │   ├── Hero.astro
│   │   │   ├── LatestPosts.astro
│   │   │   ├── StatsBar.astro
│   │   │   ├── Testimonials.tsx      # Auto-advancing carousel
│   │   │   ├── TheSetting.astro
│   │   │   └── TourForm.astro        # Netlify Form for tour requests
│   │   ├── layout/
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
│   │   ├── booking.astro             # Tour booking calendar
│   │   ├── pricing.astro             # Package pricing estimator
│   │   ├── faqs.astro                # FAQ accordion
│   │   ├── contact.astro             # Contact form
│   │   ├── vendors.astro             # Preferred vendor directory
│   │   ├── admin/bookings.astro      # Admin panel (client:only)
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
- A **MongoDB Atlas** account (free M0 tier works)
- A **TinaCMS Cloud** account (free tier works)
- A **Netlify** account

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
# With TinaCMS local mode (recommended — enables /admin editing locally)
npm run dev:cms

# Without TinaCMS (faster cold start, no /admin)
npm run dev
```

The site will be available at **http://localhost:4321** (Astro default) or **http://localhost:3000** when using `netlify dev`.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. **Never commit `.env` to git.**

| Variable | Description | Where to get it |
|---|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string | Atlas → Cluster → Connect → Drivers |
| `TINA_PUBLIC_CLIENT_ID` | TinaCMS project client ID | app.tina.io → Project → Overview |
| `TINA_TOKEN` | TinaCMS read/write token | app.tina.io → Project → Overview |
| `TINA_SEARCH` | TinaCMS search token | app.tina.io → Project → Overview |
| `NETLIFY_IDENTITY_URL` | Your Netlify site URL (for Identity) | Netlify Dashboard → Site settings → Identity |

On Netlify, set these under **Site configuration → Environment variables**. `NETLIFY_IDENTITY_URL` is injected automatically in production.

---

## Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Astro dev server only (no TinaCMS) |
| `npm run dev:cms` | Start TinaCMS local mode + Astro dev server |
| `npm run build` | Run `tinacms build` then `astro build` |
| `npm run preview` | Serve the production `dist/` folder locally |

> **Tip:** When using TinaCMS local mode (`dev:cms`), content is read/written directly from your local filesystem. No cloud credentials are needed for local editing. The `/admin` TinaCMS UI is available at http://localhost:4321/admin.

---

## Pages

| Route | File | Description |
|---|---|---|
| `/` | `src/pages/index.astro` | Hero, stats bar, blockquote, venue overview, testimonials carousel, latest blog posts, tour request form |
| `/about` | `src/pages/about.astro` | Location, history, crest symbolism, room descriptions, photo gallery lightbox, CTA |
| `/booking` | `src/pages/booking.astro` | Interactive Sunday tour calendar; time slot picker; booking modal |
| `/pricing` | `src/pages/pricing.astro` | Interactive package estimator with running total; print/PDF button |
| `/faqs` | `src/pages/faqs.astro` | Accessible accordion sourced from content collection |
| `/contact` | `src/pages/contact.astro` | Contact form (Netlify Forms), address, phone, Facebook link |
| `/contact/success` | `src/pages/contact/success.astro` | Post-form-submission thank-you page |
| `/vendors` | `src/pages/vendors.astro` | Preferred vendor directory by category |
| `/blog` | `src/pages/blog/index.astro` | Blog post grid, sorted newest first |
| `/blog/[slug]` | `src/pages/blog/[slug].astro` | Individual post with optional photo gallery |
| `/admin/bookings` | `src/pages/admin/bookings.astro` | Booking management panel (Netlify Identity required) |

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

Tours are held on **Sundays only**. Each tour slot is one hour. Available time slots:

| Slot | Time |
|---|---|
| 1 | 10:00 AM – 11:00 AM |
| 2 | 11:00 AM – 12:00 PM |
| 3 | 12:00 PM – 1:00 PM |
| 4 | 1:00 PM – 2:00 PM |
| 5 | 2:00 PM – 3:00 PM |
| 6 | 3:00 PM – 4:00 PM |

### MongoDB schema

Database: `lnhf` | Collection: `booking_slots`

```typescript
interface BookingSlot {
  _id:       ObjectId
  date:      string          // "YYYY-MM-DD"
  startTime: string          // "10:00"
  endTime:   string          // "11:00"
  status:    'available' | 'booked' | 'blocked'
  booking?: {
    name:       string
    email:      string
    phone?:     string
    partySize?: number
    message?:   string
    bookedAt:   Date
  }
}
```

### Booking flow

1. Visitor opens `/booking` — `BookingCalendar` fetches slots via `GET /.netlify/functions/get-slots`.
2. Visitor clicks an available Sunday → time slot pills appear.
3. Visitor clicks a time → `BookingModal` opens.
4. On submit, `POST /.netlify/functions/create-booking` uses a **MongoDB atomic `findOneAndUpdate`** to prevent double-booking. Returns `409 Conflict` if the slot was taken between the visitor opening the modal and submitting.
5. On success, a secondary `POST` to `/` (Netlify Forms) submits the hidden `booking-notification` form, triggering an email notification to the venue.

### Adding slots (admin)

Slots must be explicitly created via the [Admin Panel](#admin-panel) or directly via `POST /.netlify/functions/admin-slot`. The calendar only shows slots that exist in the database; it does not auto-generate Sunday slots.

---

## Netlify Functions API

All functions live in `netlify/functions/`. They are deployed automatically by Netlify.

### `GET /.netlify/functions/get-slots`

Returns available and booked slots in a date range. Booking details are stripped from the response to protect guest privacy.

**Query parameters:**

| Param | Format | Required |
|---|---|---|
| `startDate` | `YYYY-MM-DD` | ✓ |
| `endDate` | `YYYY-MM-DD` | ✓ |

**Response `200`:**
```json
{
  "slots": [
    { "_id": "...", "date": "2026-06-07", "startTime": "10:00", "endTime": "11:00", "status": "available" }
  ]
}
```

---

### `POST /.netlify/functions/create-booking`

Books an available slot. Atomic — safe against race conditions.

**Request body (JSON):**

| Field | Type | Required |
|---|---|---|
| `slotId` | MongoDB ObjectId string | ✓ |
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

### `GET /.netlify/functions/admin-bookings` *(auth required)*

Returns all slots including full booking details. Requires a valid Netlify Identity JWT in the `Authorization: Bearer <token>` header.

**Query parameters:** `startDate`, `endDate` (optional YYYY-MM-DD filters)

---

### `POST | PATCH | DELETE /.netlify/functions/admin-slot` *(auth required)*

Manage individual slots. All methods require Netlify Identity JWT.

**POST** — Create a new slot:
```json
{ "date": "2026-06-07", "startTime": "10:00", "endTime": "11:00", "status": "available" }
```

**PATCH** — Update a slot's status, or cancel a booking (`unbook: true`):
```json
{ "id": "<objectId>", "status": "blocked" }
{ "id": "<objectId>", "unbook": true }
```

**DELETE** — Remove a slot permanently:
```json
{ "id": "<objectId>" }
```

---

## Admin Panel

The admin panel is available at `/admin/bookings`. It is a React component (`client:only="react"`) gated by **Netlify Identity**.

**To access:**
1. A Netlify Identity user must be invited via **Netlify Dashboard → Identity → Invite users**.
2. The invited user accepts the invite and sets a password.
3. Navigate to `/admin/bookings` and log in with those credentials.

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
| `tour-inquiry` | `/` (TourForm) | name\*, email\*, phone, preferred-date, message |
| `booking-notification` | `/booking` (hidden) | guest-name, guest-email, guest-phone, slot-date, slot-time, party-size, message |
| `contact` | `/contact` | name\*, email\*, phone, subject, message\* |

> **Email target:** Configure submission notifications in Netlify → Forms → `tour-inquiry` / `contact` → **Add notification → Email notification** → recipient: `kaylapratt@protonmail.com`.

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

1. **Environment variables** — set all variables from `.env.example` in Site configuration → Environment variables.
2. **Identity** — enable Netlify Identity, invite admin users.
3. **Forms** — enable Netlify Forms (automatic on first deploy); configure email notifications for `tour-inquiry`, `contact`, and `booking-notification`.
4. **Custom domain** — add `lowernotleyhallfarm.com` and enable HTTPS.

---

## Security Notes

- **Honeypot fields** on all public forms prevent basic bot spam.
- **Admin endpoints** (`admin-bookings`, `admin-slot`) validate the Netlify Identity JWT on every request. Requests without a valid token receive `401 Unauthorized`.
- **Double-booking** is prevented atomically via MongoDB `findOneAndUpdate({ status: 'available' })` — no race condition possible.
- **Input sanitization** on `create-booking`: all string inputs are trimmed and clamped to max lengths before being written to the database.
- **`/admin/bookings`** page is a client-only React shell. The Netlify Identity check happens in the component before any admin API calls are made.
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
Photography credit: [Candace Nicole Photography](https://candacenicolephotography.com)

---

*Lower Notley Hall Farm — "Step back in time, to a place where the past meets the present and your future begins."*
