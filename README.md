# Altair: group meetups slice

A map-centred community feature for dog owners: members of small neighbourhood walking groups create
meetups at public places, RSVP, and see where to meet on a map. This repository is the slice the
First Epic workflow challenge asks for: **database (Supabase/Postgres + RLS), a Zod-validated write
layer, one shared contract, and an Expo React Native app** — built from the provided schema starter
and seed.

> Read [ENGINEERING_NOTES.md](ENGINEERING_NOTES.md) for the product decision (approximate area until
> RSVP), the security design and the trade-offs, and [QA_REPORT.md](QA_REPORT.md) for what was
> verified and how.

## What is in the slice

| Area            | What it does                                                                                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database        | `meetups`, `meetup_meeting_points` (exact spot, split out so RLS can hide it), `rsvps`; RLS on every table; triggers for the domain rules (no RSVP to cancelled/started meetups, cancel is final).   |
| Write layer     | Fastify server. Every write (create, cancel, RSVP, withdraw, bonus edit) is validated with the shared Zod schemas, then runs **as the member** under RLS. The app cannot write to Supabase directly. |
| Shared contract | `packages/shared`: Zod 4 request/response schemas imported by the server **and** the app.                                                                                                            |
| App             | Expo (SDK 58) React Native: sign-in, group meetup list, create, detail with map + RSVP + creator-only cancel, bonus edit.                                                                            |
| Privacy         | Members who have not RSVP'd get an offset 400 m area, never the exact coordinates or place name. Home locations are not readable by any client-facing role.                                          |
| Tests           | 224 offline tests (embedded Postgres 17 running the real migrations + seed) and a hosted suite against real Supabase Auth/PostgREST/Postgres.                                                        |

## Architecture

```
 Expo app (React Native)                         Fastify API (Node 22)
 ┌───────────────────────────┐   HTTPS + JWT    ┌──────────────────────────────────────┐
 │ screens → hooks (React    │ ───────────────▶ │ routes: parse with shared Zod        │
 │ Query) → gateway ports    │                  │ services: business rules             │
 │ → ApiClient (Zod-parsed)  │ ◀─────────────── │ repositories (SQL) via UnitOfWork:   │
 └────────────┬──────────────┘  shared contract │   BEGIN; SET LOCAL ROLE authenticated│
              │ sign-in only                    │   | altair_api_writer;               │
              ▼                                 │   request.jwt.claims = {sub: member} │
       Supabase Auth  ◀──── token verification ─┴──────────────┬───────────────────────┘
                                                                ▼
                                       Postgres (Supabase): RLS + column grants + triggers
```

- `authenticated` (the role a member's JWT maps to) is **read-only**: even with a valid session,
  the app cannot insert/update/delete anything through PostgREST.
- `altair_api_writer` is a `NOLOGIN` role only the API server can assume, after verifying the
  token and validating the body. RLS still applies to it as the member (creator-only cancel/edit,
  own-RSVP only, members-only create).

## Repository layout

```
supabase/
  migrations/20261001000000_starter.sql        provided starter, byte-for-byte
  migrations/20261029120000_meetups_and_rsvps.sql
  migrations/20261029120100_meetup_rules.sql    approximate area, insert function, triggers
  migrations/20261029120200_access_control.sql  roles, grants, RLS policies
  migrations/20261029140000_edit_meetup.sql     bonus: creator-only edit
  seed/part2_reference_meetups.sql              seed PART 2 adapted (idempotent)
packages/shared/        @altair/shared: Zod contract + tests
server/                 @altair/server: Fastify API
  src/domain            ports, types, pure rules (no framework imports)
  src/features/*        services (application) + routes (HTTP) per feature
  src/infrastructure    pg repositories, unit of work, Supabase token verifier
  src/http              app assembly, auth hook, error handler, validation
  test/unit|offline|hosted
mobile/                 @altair/mobile: Expo app
  src/core              ports, API client, Supabase auth adapter, DI context
  src/features/*        auth, groups, meetups (screens, components, hooks)
  src/ui                design system (theme, Button, Card, TextField, states)
  test/                 Jest + Testing Library
altair-feature-spec.html, altair-seed-data.sql, altair-schema-starter/   provided inputs, unchanged
```

## Prerequisites

- **Node.js ≥ 22.13** (Expo SDK 58 requires it) and npm ≥ 10.
- A **hosted Supabase project** (free tier is fine). No Docker needed.
- To run the app: an Android emulator (Android Studio) or a phone with **Expo Go for SDK 58**.
  iOS simulator also works on macOS. The web client is out of scope.

## Run from a clean checkout

### 1. Install

```bash
git clone <repo-url> altair && cd altair
npm ci
```

### 2. Configure

Create a Supabase project, then:

```bash
cp .env.example .env               # Windows PowerShell: Copy-Item .env.example .env
cp mobile/.env.example mobile/.env
```

| Variable                      | Where to find it                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`                | Project Settings → Data API → Project URL                                                                           |
| `SUPABASE_ANON_KEY`           | Project Settings → API Keys → publishable / `anon` key (**not** the service-role/secret key; nothing here needs it) |
| `DATABASE_URL`                | **Connect** → _Session pooler_ connection string, with your database password                                       |
| `EXPO_PUBLIC_*` (mobile/.env) | Same URL and anon key; `EXPO_PUBLIC_API_URL` = where the phone/emulator reaches the API (see below)                 |

Both `.env` files are git-ignored. Supabase Auth needs no extra configuration: the email provider
is on by default and the seed marks the accounts as confirmed.

### 3. Database: migrations, then seed (exactly once each)

The starter is the **first migration**, so it is applied by the Supabase CLI together with ours.
Do **not** also paste it into the SQL editor.

```bash
npm run db:inspect    # read-only: Postgres version, existing tables, applied migrations
npm run db:push:dry   # shows the 6 migrations that would be applied; changes nothing
npm run db:push       # = npx supabase db push --db-url $DATABASE_URL
```

> **Windows PowerShell:** use `db:push:dry`, not `npm run db:push -- --dry-run`. PowerShell strips
> a bare `--`, so `--dry-run` reaches npm instead of the script and the push really runs.

Then, in the Supabase dashboard → **SQL Editor** (runs as the database owner, which the seed needs):

1. Paste and run **`altair-seed-data.sql`** (the provided file, unchanged: PART 1 accounts,
   profiles, groups, memberships; PART 2 is commented out in it).
2. Paste and run **`supabase/seed/part2_reference_meetups.sql`** (PART 2 adapted to this schema).

Check that a seed account can sign in (prints an access token):

```bash
curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" -d '{"email":"sam@example.test","password":"altair-fixture-pass"}'
```

To restore the three reference meetups later (fresh start times, seed RSVPs; nothing else is
touched): `npm run db:reset-reference`.

### 4. API server

```bash
npm run server          # http://localhost:4000/health → {"status":"ok"}
```

### 5. App

```bash
npm run mobile          # Expo dev server; press "a" for the Android emulator, or scan the QR code with Expo Go
```

`EXPO_PUBLIC_API_URL` must be reachable **from the device**:

| Where the app runs       | API URL                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------ |
| Android emulator         | `http://10.0.2.2:4000`                                                               |
| iOS simulator            | `http://127.0.0.1:4000`                                                              |
| Physical phone (Expo Go) | `http://<your computer's LAN IP>:4000` (same Wi-Fi; allow port 4000 in the firewall) |

### 6. Tests

```bash
npm run test:offline   # no network, no credentials: shared + server (unit, API, DB on embedded Postgres 17) + mobile
npm run test:hosted    # against your Supabase project (needs .env)
npm run lint && npm run typecheck && npm run format:check
```

The hosted suite signs in as the seed accounts, re-runs `part2_reference_meetups.sql` before each
test (only the three reference meetups are reset) and deletes meetups it created (titles start with
`[test]`). It never touches other data.

## Bonuses

- **(a) Edit a meetup**: creator-only `PATCH /v1/meetups/:id`, an "Edit meetup" screen from the
  detail (shown to the creator only). Covered by contract, DB, API and app tests.
- **(b) Live walk map work sample**: synthetic walkers over a private Supabase Realtime channel
  with interpolation and viewport culling. See [REALTIME_MAP_BONUS.md](REALTIME_MAP_BONUS.md).
  To see it: sign in as a creator or attendee (e.g. `jordan@example.test`), open "Saturday morning
  loop" → **Live walk (demo)**, and in another terminal run:

  ```bash
  npm run live:simulate                    # 12 walkers every 2 s on "Saturday morning loop"
  npm run live:simulate -- --chaos         # also late, duplicated and invalid messages
  ```

## Seed accounts

Password for every account: `altair-fixture-pass` (published fixture; development/testing only).

| Email               | Groups                 | Role in the reference meetups                         |
| ------------------- | ---------------------- | ----------------------------------------------------- |
| avery@example.test  | Maple Street Walkers   | creator of "Saturday morning loop"                    |
| jordan@example.test | Maple Street Walkers   | RSVP'd to Saturday; creator of "Weeknight short walk" |
| sam@example.test    | Maple Street Walkers   | member, no RSVP                                       |
| riley@example.test  | both groups            | RSVP'd to Saturday only                               |
| morgan@example.test | Riverside Loop Walkers | creator of "Riverside sunrise walk"                   |
| casey@example.test  | Riverside Loop Walkers | RSVP'd to Riverside sunrise                           |
| quinn@example.test  | Riverside Loop Walkers | member, no RSVP                                       |
| taylor@example.test | neither                | outsider                                              |

The seed coordinates are synthetic, around 40.0000 N, 100.0000 W; the real-world map labels there
have nothing to do with the fictional place names.

## API

All `/v1` routes require `Authorization: Bearer <Supabase access token>`. Errors always have the
shape `{ "error": { "code", "message", "issues"? } }`.

| Method & path                     | Purpose                                    | Notes                       |
| --------------------------------- | ------------------------------------------ | --------------------------- |
| `GET /health`                     | liveness                                   | public                      |
| `GET /v1/me/groups`               | the caller's groups                        |                             |
| `GET /v1/groups/:groupId/meetups` | meetups, soonest first, cancelled included | 404 for non-members         |
| `GET /v1/groups/:groupId/map`     | map data for the group's meetups           | per-meetup visibility       |
| `GET /v1/meetups/:id`             | detail + attendees + meeting point         | 404 for outsiders           |
| `GET /v1/meetups/:id/attendees`   | attendee names                             |                             |
| `GET /v1/meetups/:id/map`         | the meeting point this member may see      |                             |
| `POST /v1/meetups`                | create                                     | 201; creator = session user |
| `POST /v1/meetups/:id/cancel`     | cancel (creator only, final)               | 403 for other members       |
| `PUT /v1/meetups/:id/rsvp`        | RSVP (idempotent)                          | 409 if cancelled/started    |
| `DELETE /v1/meetups/:id/rsvp`     | withdraw own RSVP                          | allowed after cancel        |
| `PATCH /v1/meetups/:id`           | bonus: edit (creator only)                 | 409 if cancelled            |

## Troubleshooting

- **`npm ci` or Expo complains about the Node version**: Expo SDK 58 needs Node ≥ 22.13.
- **npm 10 crashes with `Cannot read properties of null (reading 'edgesOut')`**: a known npm 10
  arborist bug with this workspace; npm 11 works (`npx npm@11 ci`).
- **`db push` cannot connect**: use the _Session pooler_ string (IPv4); check Database → Network
  restrictions; percent-encode special characters in the password (`@` → `%40`). `--dry-run`
  shows what would be applied without changing anything.
- **`db push` says a migration was already applied / the starter's tables exist**: the starter was
  applied some other way (e.g. pasted in the SQL editor). Never apply it twice; see
  ENGINEERING_NOTES.md → "If the starter was already applied".
- **App shows "App is not configured"**: `mobile/.env` is missing or incomplete; restart
  `npm run mobile` after editing it (`npx expo start -c` clears the cache).
- **App shows "Could not reach the server"**: `EXPO_PUBLIC_API_URL` is not reachable from the
  device (see the table above), or the API is not running.
- **Expo Go says the project is incompatible**: install Expo Go for SDK 58.

## Submitting as an archive

The history must travel with the code. Either zip the folder **including `.git`** (exclude
`node_modules`, `.tools` and `.env` files), or create a single-file bundle that `git clone` can read:

```bash
git bundle create altair.bundle --all     # recipient: git clone altair.bundle altair
```
