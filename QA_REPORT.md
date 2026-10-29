# QA report

Status legend: **PASS** = actually verified · **FAIL** = tested and failed · **BLOCKED** = could not
be verified, with the reason · **NOT IMPLEMENTED**.

Environment: Windows 11, portable Node 22.23.4 (npm 11.21.1) in `.tools/`, Expo SDK 58 /
React Native 0.88.0, Android 37 emulator (x86_64, 4 GB) with Expo Go. Database verification
offline on **PGlite (Postgres 17, WASM)** running the real migrations and the provided seed over a
Supabase shim (roles, `auth` tables, default grants, `realtime.messages`).

> **Current blocker:** no hosted Supabase credentials were available while this report was written
> (`.env` not yet created). Everything that needs real Supabase Auth, PostgREST, Realtime or the
> hosted database, and every on-device flow past the configuration screen, is **BLOCKED**, not
> passed. The hosted suite (`npm run test:hosted`) is written and type-checked but has **not been
> run**.

## Commands executed (final run) and results

| Command                                                                                             | Result                                                                                          |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run test --workspace @altair/shared`                                                           | 1 file, **18 passed**                                                                           |
| `cd server && npx vitest run --project unit`                                                        | 3 files, **17 passed**                                                                          |
| `cd server && npx vitest run --project offline`                                                     | 3 files, **140 passed** (DB/RLS 55 · API suite · Realtime auth 12)                              |
| `cd mobile && npx jest`                                                                             | 8 suites, **48 passed**                                                                         |
| `npm run typecheck` (shared, server, mobile)                                                        | 0 errors                                                                                        |
| `npx eslint .`                                                                                      | 0 problems                                                                                      |
| `npx prettier --check .`                                                                            | all files formatted                                                                             |
| `npx expo export --platform android`                                                                | Hermes bundle built; shared schemas present in bytecode; no `service_role` / `home_lat` strings |
| `npx expo install --check`                                                                          | dependencies match SDK 58 (after fix, see D-6)                                                  |
| real server process: `/health`, `/v1/me/groups` (no token, bad token), malformed JSON without token | 200 / 401 / 401 / 401                                                                           |
| Expo Go on Android emulator                                                                         | app bundle loads and renders its own configuration screen                                       |
| `npm run test:hosted`                                                                               | **not run (BLOCKED: no credentials)**                                                           |
| `npm audit --omit=dev`                                                                              | 8 findings, all in Expo CLI/build tooling (see Code quality)                                    |

**Total offline: 223 passed, 0 failed.** Mutation checks (each reverted afterwards): weakening the
exact-point RLS policy + service check → 12 failures; weakening the edit RLS policy → 1 failure;
removing `"type": "module"` from shared → startup test fails; un-awaiting a `render` → lint error.

## Section results

| Section           | Status                                               | Tests run                                                                                                                                                                                                                            | Issues found       | Issues fixed | Remaining                                                                                         |
| ----------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ------------ | ------------------------------------------------------------------------------------------------- |
| Database          | **PASS** offline · **BLOCKED** hosted                | migrations + provided seed + PART 2 applied on PG 17; counts (8 users, 8 memberships, 3 meetups, 3 points, 3 RSVPs); constraints, triggers, approximate-area properties (radius 400 ≥ 300, centre 120–280 m away, random per meetup) | none in SQL        | —            | `db push` to hosted not yet run                                                                   |
| Authentication    | **PASS** offline · **BLOCKED** hosted                | missing/invalid/malformed bearer → 401 on every route (inject + real HTTP); sign-in screen validation                                                                                                                                | none               | —            | real seed sign-in, wrong password, token verification via Supabase Auth: in hosted suite, not run |
| Authorization     | **PASS** offline                                     | outsider/member/attendee/creator/multi-group at DB level (as `authenticated` and `altair_api_writer`) and API level; app cannot write directly (42501 on insert/update/delete/execute)                                               | none               | —            | PostgREST bypass attempts are hosted-only                                                         |
| Meetups           | **PASS** offline                                     | create (trim, creator from session, future start, all validation cases), list order, detail, cancel (creator only, final, stays visible, no reopen)                                                                                  | none               | —            | —                                                                                                 |
| RSVPs             | **PASS** offline · **BLOCKED** race                  | RSVP/withdraw, idempotent, own-only, cancelled/started rejection, withdraw after cancel, membership required                                                                                                                         | none               | —            | RSVP-vs-cancel race test needs two real connections (hosted)                                      |
| Maps              | **PASS** logic · **BLOCKED** on-device               | server returns approximate (no name/coords) vs exact per meetup; map component draws circle vs marker; detail switches to exact after RSVP (component test)                                                                          | none               | —            | visual map on device with real data                                                               |
| Privacy           | **PASS** offline · **BLOCKED** PostgREST             | home coords never in any of 70+ API responses scanned; `home_lat`/`select *` denied at DB; exact point/name absent before RSVP; RSVP to one meetup reveals nothing else; identical 404s for outsiders; generic 500s                  | none               | —            | direct PostgREST checks (hosted)                                                                  |
| Mobile UI         | **PASS** components · **BLOCKED** flows              | 48 Jest tests (states, RSVP flow, creator-only actions, form validation, edit, live hook); app launches in Expo Go                                                                                                                   | D-2, D-3, D-6, D-7 | all          | sign-in → list → create → detail → RSVP → cancel on device needs backend                          |
| Backend           | **PASS**                                             | validation, auth hook, error mapping (SQLSTATE → HTTP), response shaping, real process startup                                                                                                                                       | D-1                | yes          | —                                                                                                 |
| Code quality      | **PASS**                                             | typecheck, lint, format, 0 import cycles (70 files), layer-boundary greps, secret scans before each commit                                                                                                                           | D-4                | yes          | audit findings in Expo tooling (accepted, below)                                                  |
| End-to-End        | **BLOCKED**                                          | —                                                                                                                                                                                                                                    | —                  | —            | needs hosted project + device run (see checklist below)                                           |
| Bonus A: edit     | **PASS** offline · **BLOCKED** on-device             | creator edits; others 403/0 rows; outsider 404; cancelled 409/AL004; future-start re-check; strict body; area recomputed on move; direct update denied                                                                               | D-5                | yes          | —                                                                                                 |
| Bonus B: live map | **PASS** logic + channel auth · **BLOCKED** live run | payload validation, interpolation, out-of-order, duplicates, stale, clock skew, culling, prune; channel allowed only for creator/attendees of scheduled meetups                                                                      | D-3 (hooks)        | yes          | real Realtime broadcast + on-device animation; **no FPS/latency/battery numbers measured**        |

## Defects found and resolved

| #   | Severity             | Defect                                                                                                                                | Resolution                                                                                    |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| D-1 | Critical             | `npm run server` crashed on import (`@altair/shared` loaded as CommonJS by Node); all tests passed because Vite/Metro masked it       | `"type": "module"` on shared (9e227bb); regression test spawns the real entry point (11606fd) |
| D-2 | High (test validity) | Testing Library 14 made `render`/`fireEvent` async; 18/23 tests silently not rendering                                                | tests awaited; `no-floating-promises` lint rule for app tests                                 |
| D-3 | High                 | Rules-of-hooks violations (hook after early return in detail screen; `useIsFocused() && useAppActive()` short-circuit in live screen) | fixed before first run                                                                        |
| D-4 | Critical (process)   | A mutation-test restore used `git checkout` on an untracked file; the permissive policy stayed on disk                                | detected, restored by hand, grep confirms no `using (true)` anywhere                          |
| D-5 | Low                  | Test asserting "writer cannot change title" became wrong once the edit bonus granted it                                               | rewritten to assert group/creator stay immutable                                              |
| D-6 | Medium               | `react-native` 0.88.1 vs 0.88.0 expected by SDK 58                                                                                    | `expo install --fix` (103443d)                                                                |
| D-7 | Low                  | Jest open handles from React Query GC timers; a loading-state test racing a resolved promise                                          | `gcTime: Infinity` in tests; deterministic promise                                            |
| E-1 | Environment          | npm 10 arborist crash on install                                                                                                      | npm 11 in the portable toolchain                                                              |
| E-2 | Environment          | first npm 11 install changed the user-global npm                                                                                      | reverted exactly; reinstalled into `.tools/`                                                  |
| E-3 | Environment          | Expo Go killed by Android low-memory killer on a 2 GB AVD                                                                             | AVD raised to 4 GB                                                                            |
| E-4 | Process              | a commit message truncated by PowerShell quoting                                                                                      | not rewritten; full text in `git notes`                                                       |

**Unresolved defects:** none known. **Accepted risk:** `npm audit --omit=dev` reports `zod@3.25.76`
(high) and `deepmerge` (low) **only inside `@expo/cli` / `@expo/config`** (dev server and build
tooling). The app, the API and the shared contract resolve `zod@4.6.7`. npm's suggested fix is a
downgrade to Expo 54 (breaking, and incompatible with Expo Go SDK 58), so it was not applied.

## End-to-end checklist (to run once hosted credentials exist)

Sign in as Sam → Maple → open Saturday → map shows approximate circle → RSVP → attendee list adds
Sam, map shows exact pin + "North gate, Linden Park" → withdraw → back to circle → sign in as Avery
→ cancel Saturday (confirm) → marked cancelled → Sam's RSVP rejected → sign in as Taylor → no
groups; direct API/PostgREST reads of the meetup return nothing. Each step: **BLOCKED** until run.

## Requirements traceability

| Requirement                                                                          | Implementation                                                    | Test                                                         | Status                                            |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| Timestamped migrations, starter first                                                | `supabase/migrations/*`                                           | offline harness applies all in order                         | PASS (offline) / BLOCKED (hosted push)            |
| Members read their group's meetups + attendees; outsiders nothing                    | RLS in `…120200_access_control.sql`                               | `database-rls.test.ts`, API suite "outsider"                 | PASS (offline)                                    |
| Creator-only cancel                                                                  | `meetups_update_creator` + service                                | DB "writer role…", API "creator"                             | PASS (offline)                                    |
| Cancelled visible, final, no new RSVP, withdraw allowed                              | guard triggers                                                    | DB "domain rules…", API cancel test                          | PASS (offline)                                    |
| No RSVP once started                                                                 | `guard_rsvp_insert`                                               | DB + API "started meetup"                                    | PASS (offline)                                    |
| All writes through server code with shared Zod                                       | routes + `parseInput`; `authenticated` has no write grants        | API validation tests; DB "app cannot write directly"         | PASS (offline); PostgREST variant BLOCKED         |
| Reject non-future start on create                                                    | Zod refine + `insert_meetup` AL006 + RLS check                    | shared, DB, API tests                                        | PASS                                              |
| One shared contract imported by server and app                                       | `packages/shared`                                                 | typecheck of both; bundle contains shared strings            | PASS                                              |
| Four-role access tests incl. multi-group + map data                                  | `api-access.suite.ts`                                             | offline run                                                  | PASS (offline) / BLOCKED (hosted run)             |
| Screens: sign-in, list (loading/empty/error), create, detail + RSVP + creator cancel | `mobile/src/features/*`                                           | Jest screen tests; launch on emulator                        | PASS (components) / BLOCKED (device flows)        |
| Map follows decision, updates after RSVP                                             | `MeetingPointMap`, `useRsvp` cache update                         | component + API tests                                        | PASS (logic) / BLOCKED (device)                   |
| Approximate ≥ 300 m, not centred on point, no coords/name before RSVP                | `app.approximate_area`, split table                               | DB + API leak tests                                          | PASS (offline)                                    |
| Home location never exposed                                                          | column grants; explicit selects; response shaping                 | DB 42501 tests; response scan                                | PASS (offline) / BLOCKED (PostgREST)              |
| Note, run instructions                                                               | `README.md`, `ENGINEERING_NOTES.md`                               | instructions followed offline; hosted steps not yet executed | PASS (written) / BLOCKED (clean-start hosted run) |
| Screen recording, exported AI log                                                    | —                                                                 | —                                                            | NOT IMPLEMENTED here (developer deliverables)     |
| Bonus A edit                                                                         | `…140000_edit_meetup.sql`, PATCH route, Edit screen               | contract, DB, API, Jest                                      | PASS (offline)                                    |
| Bonus B realtime map                                                                 | `…150000_live_walk_realtime.sql`, `features/live-walk`, simulator | engine + hook + channel-auth tests                           | PASS (logic/auth) / BLOCKED (live)                |

## Starter README compliance

| README instruction                                 | Where                                                              | How verified                               | Result                            |
| -------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------ | --------------------------------- |
| Hosted path, starter applied once (via migrations) | starter = first migration; README step 3 warns not to paste it too | file hash equals provided starter          | PASS (file) / BLOCKED (push)      |
| Own migrations after the starter                   | timestamps `2026102912…` > `20261001…`                             | sorted apply in harness                    | PASS                              |
| Seed PART 1 as owner (SQL editor)                  | README step 3                                                      | applied unchanged in harness               | PASS (offline) / BLOCKED (hosted) |
| Adapt and load PART 2 after tables exist           | `supabase/seed/part2_reference_meetups.sql`                        | applied after migrations                   | PASS (offline)                    |
| Seed accounts sign in                              | hosted test "signs in with the fixture password"                   | not run                                    | BLOCKED                           |
| Expo app, one platform                             | Android via Expo Go                                                | launched on emulator                       | PASS (launch)                     |
| 10.0.2.2 / LAN IP for API URL                      | `mobile/.env.example`, README table                                | —                                          | PASS (documented)                 |
| Service-role key never in the app                  | not used anywhere; bundle scan                                     | string scan                                | PASS                              |
| Shared Zod, one major, Metro resolves it           | zod 4.6.7 everywhere in app/server/shared; `metro.config.js`       | `npm ls zod`; `expo export`; device launch | PASS                              |
| Writes via server endpoints validated with Zod     | see traceability                                                   | tests                                      | PASS (offline)                    |
| react-native-maps, no tokens in repo               | `MeetingPointMap`, no keys                                         | secret scans                               | PASS                              |
| Run instructions, setup time note                  | README; ENGINEERING_NOTES §10                                      | —                                          | PASS (written)                    |

## Final assessment

The slice is implemented end to end and verified **against a real Postgres 17 running the real
migrations and seed**, through the real HTTP layer, and on-device up to the configuration screen.
It is **not yet verified against hosted Supabase** or as a full on-device user journey; both are
blocked only on credentials, and the hosted test suite and E2E checklist are ready to run.
