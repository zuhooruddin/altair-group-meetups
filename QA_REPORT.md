# QA report

Status legend: **PASS** = actually verified · **FAIL** = tested and failed · **BLOCKED** = could not
be verified, with the reason · **NOT IMPLEMENTED**.

Environment: Windows 11, portable Node 22.23.4 (npm 11.21.1) in `.tools/`; hosted Supabase
(Postgres 17.11, Session pooler, us-west-2); Expo SDK 58 / React Native 0.88.1; Android 37 emulator
(x86_64, 4 GB) with Expo Go. Offline database verification on **PGlite (Postgres 17)** running the
real migrations and the provided seed over a Supabase shim.

## Commands executed and results

| Command / action                                                          | Result                                                                                              |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run test --workspace @altair/shared`                                 | **18 passed**                                                                                       |
| `cd server && npx vitest run --project unit`                              | **17 passed**                                                                                       |
| `cd server && npx vitest run --project offline`                           | **140 passed** (DB/RLS 55 · API suite · Realtime auth 12)                                           |
| `cd mobile && npx jest`                                                   | **49 passed** (8 suites)                                                                            |
| `npm run typecheck` · `npx eslint .` · `npx prettier --check .`           | 0 errors · 0 problems · formatted                                                                   |
| `npm run db:inspect` (before)                                             | empty project: PG 17.11, no public tables, no migration history                                     |
| `npm run db:push`                                                         | 6 migrations applied in order (starter first); see E-5 for how                                      |
| `npm run db:seed`                                                         | provided seed unchanged + PART 2: 8 accounts/identities, 8 profiles, 2 groups, 8 memberships, 3/3/3 |
| password grant for all 8 seed accounts; wrong password                    | 8 × HTTP 200 with token; wrong password HTTP 400                                                    |
| `npm run test:hosted` (full)                                              | **85 passed** (2 files, 347 s)                                                                      |
| hosted edit-RLS tests added afterwards (`-t "edit authorization"`)        | **4 passed**                                                                                        |
| real server process `/health`, no/bad token, malformed JSON without token | 200 / 401 / 401 / 401                                                                               |
| on-device E2E (below), API probes as real users, Realtime channel probes  | all as expected                                                                                     |
| `npx expo install --check`                                                | up to date (after 6871c72)                                                                          |
| `npm audit --omit=dev`                                                    | findings only in Expo CLI/build tooling (accepted risk, below)                                      |

**Offline total: 224 passed, 0 failed. Hosted: 89 passed, 0 failed.** Mutation checks (each
reverted): weakening the exact-point RLS policy + service check → 12 failures; weakening the edit
policy → 1 failure; removing `"type": "module"` from shared → startup test fails; un-awaiting a
`render` → lint error.

## On-device end-to-end (Android emulator, Expo Go, hosted backend)

| Step                                                   | Observed                                                                                                        | Result |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------ |
| Sign in as Sam (member, no RSVP)                       | home shows only Maple Street Walkers                                                                            | PASS   |
| Saturday loop in the list                              | "Approximate area · RSVP to see the spot", no place name                                                        | PASS   |
| Detail before RSVP                                     | 400 m circle on the map, "Somewhere in the highlighted area", no place name/coordinates; no Edit/Cancel         | PASS   |
| RSVP                                                   | map switches to the exact pin, "North gate, Linden Park 40.01205, -99.98452"; Who's going (3) incl. "Sam (you)" | PASS   |
| Withdraw                                               | "Your RSVP was withdrawn", back to the approximate circle, no place name, 2 going                               | PASS   |
| Sign in as Avery (creator)                             | exact point without RSVP; "You're hosting"; Edit meetup + Cancel meetup shown                                   | PASS   |
| Cancel (with confirmation dialog)                      | "Cancel this meetup? … can't be undone" → Cancelled badge + banner; stays visible                               | PASS   |
| Sam after cancel                                       | marked cancelled in list and detail; "Cannot RSVP"; API RSVP → 409 MEETUP_CANCELLED                             | PASS   |
| Withdraw after cancel (Jordan, API)                    | 200, attendees 2 → 1                                                                                            | PASS   |
| Edit a cancelled meetup (Avery, API)                   | 409 MEETUP_CANCELLED                                                                                            | PASS   |
| Sign in as Taylor (outsider)                           | "You're not in any walking groups yet"                                                                          | PASS   |
| Taylor via API: detail / attendees / map / group list  | 404 / 404 / 404 / 404, generic messages                                                                         | PASS   |
| Taylor via PostgREST: meetups / rsvps / meeting points | `[]` / `[]` / `[]`; users: only her own id + name                                                               | PASS   |
| Bonus B: Jordan → Live walk + simulator (12 walkers)   | channel "Live"; "12 walkers · 9 on screen"; the 3 culled are the simulator's 3 far-away walkers; 0 dropped      | PASS   |
| Bonus B: private channel on hosted Realtime            | Jordan, Avery SUBSCRIBED; Sam, Quinn, Taylor "Unauthorized … Channel topic"                                     | PASS   |

Reference meetups were restored afterwards (`npm run db:reset-reference`).

## Section results

| Section           | Status   | Evidence                                                                                                                                         | Remaining                                            |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Database          | **PASS** | offline + hosted: migrations, seed counts, constraints, triggers, area properties                                                                | —                                                    |
| Authentication    | **PASS** | seed sign-in (8/8), wrong password refused, invalid/missing tokens 401 (inject, real HTTP, hosted)                                               | —                                                    |
| Authorization     | **PASS** | roles × meetups at DB, API and PostgREST level, offline and hosted; edit RLS on hosted (4 new tests)                                             | —                                                    |
| Meetups           | **PASS** | create/list/detail/cancel incl. validation; on device                                                                                            | —                                                    |
| RSVPs             | **PASS** | RSVP/withdraw/idempotency/cancelled/started; hosted race (RSVP blocked behind an uncommitted cancel is rejected); on device                      | —                                                    |
| Maps              | **PASS** | approximate circle vs exact pin, switch after RSVP and back after withdraw, on device                                                            | —                                                    |
| Privacy           | **PASS** | no home location in any response; `home_lat`/`select *` denied (offline + PostgREST); exact point/name absent before RSVP; outsiders see nothing | —                                                    |
| Mobile UI         | **PASS** | 49 Jest tests; full journey on device                                                                                                            | small-screen layouts only checked on one device size |
| Backend           | **PASS** | validation, auth hook, error mapping, real process                                                                                               | —                                                    |
| Code quality      | **PASS** | typecheck, lint, format, 0 import cycles, secret scans                                                                                           | audit findings in Expo tooling (accepted)            |
| End-to-End        | **PASS** | table above                                                                                                                                      | —                                                    |
| Bonus A: edit     | **PASS** | contract, DB, API, Jest; hosted DB-level creator-only test; on device: Edit shown to creator only                                                | edit form itself not driven on device                |
| Bonus B: live map | **PASS** | engine/hook/channel-auth tests; live on device over hosted Realtime with culling                                                                 | **no FPS, latency or battery numbers measured**      |

## Investigation: "a non-creator can edit a meetup"

Reported during QA. The hosted Saturday loop's meeting point had indeed been changed (name
"Fountain plaza, Town Green" with coordinates that are not Fountain plaza's, i.e. a manual edit in
the app). Findings: as `altair_api_writer` only the creator (Avery) can update the meetup or its
meeting point; Jordan, Sam, Riley (both groups), Quinn and Taylor change 0 rows; the app shows Edit
only when `viewer.canEdit` (creator and scheduled) and the Edit screen re-checks it; the API returns
403 (member) / 404 (outsider). **No authorization defect was found**; the database cannot say who
made the earlier edit (no audit log). The genuine gap was **coverage**: hosted tests exercised edit
authorization only through the API, whose 403 would mask a database hole. Four hosted DB-level tests
now cover it (e1b4b7d).

## Defects and process issues

| #   | Severity             | Issue                                                                                                                               | Resolution                                                                                   |
| --- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| D-1 | Critical             | `npm run server` crashed on import (shared loaded as CommonJS); tests masked it                                                     | `"type": "module"` (9e227bb); startup regression test (11606fd)                              |
| D-2 | High (test validity) | Testing Library 14 async `render`/`fireEvent`; tests silently not rendering                                                         | awaited; `no-floating-promises` rule                                                         |
| D-3 | High                 | two rules-of-hooks violations                                                                                                       | fixed before first run                                                                       |
| D-4 | Critical (process)   | mutation-test restore missed an untracked file; permissive policy left on disk                                                      | detected, restored, grep-verified                                                            |
| D-5 | Low                  | test asserting "title immutable" became wrong after the edit bonus                                                                  | rewritten                                                                                    |
| D-6 | Medium               | `react-native` pin: 103443d set 0.88.0 following a transient `expo install --check` result; Expo now (and expo 58.0.21) pins 0.88.1 | corrected to 0.88.1 (6871c72); manifest, lock, install and Expo pin agree                    |
| D-7 | Low                  | Jest open handles; a racing loading-state test                                                                                      | `gcTime: Infinity`; deterministic promise                                                    |
| D-8 | Low                  | hosted edit authorization covered only through the API                                                                              | 4 hosted DB-level tests (e1b4b7d)                                                            |
| E-1 | Environment          | npm 10 arborist crash                                                                                                               | npm 11 in `.tools/`                                                                          |
| E-2 | Environment          | first npm 11 install changed the user-global npm                                                                                    | reverted exactly                                                                             |
| E-3 | Environment          | Expo Go killed by the low-memory killer on a 2 GB AVD                                                                               | AVD 4 GB                                                                                     |
| E-4 | Process              | commit message truncated by PowerShell quoting                                                                                      | full text in `git notes`, history not rewritten                                              |
| E-5 | Process              | `npm run db:push -- --dry-run` in PowerShell **applied** the migrations: PowerShell strips the bare `--`                            | target was the intended, verified-empty project; `db:push:dry` script + README warning added |
| E-6 | Environment          | an API server from a previous session kept port 4000                                                                                | stopped; restarted under control                                                             |

**Unresolved:** none blocking. **Cosmetic, not changed** (in the in-progress redesign): a cancelled
meetup's card still says "RSVP to see the spot"; `SplashScreen.setOptions` logs a warning in Expo Go
(supported only in development builds). **Accepted risk:** `npm audit --omit=dev` findings
(`zod@3` in `@expo/cli`, `deepmerge` in `@expo/config`) are dev-server/build tooling only; the app,
API and contract use `zod@4.6.7`; npm's fix is a breaking downgrade to Expo 54.

## Requirements traceability

| Requirement                                                                | Implementation                                         | Test / evidence                                   | Status                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------- | ---------------------------------------- |
| Timestamped migrations, starter first                                      | `supabase/migrations/*`                                | offline harness; hosted `db push` history         | PASS                                     |
| Members read group meetups + attendees; outsiders nothing                  | RLS `…120200_access_control.sql`                       | DB, API, PostgREST (hosted), device               | PASS                                     |
| Creator-only cancel                                                        | `meetups_update_creator` + service                     | DB, API, device                                   | PASS                                     |
| Cancelled visible, final, no new RSVP, withdraw allowed                    | guard triggers                                         | DB, API, device + API probe                       | PASS                                     |
| No RSVP once started                                                       | `guard_rsvp_insert`                                    | DB + API "started meetup"                         | PASS                                     |
| All writes through server code with shared Zod; app cannot write directly  | routes + `parseInput`; `authenticated` read-only       | API validation; PostgREST write attempts (hosted) | PASS                                     |
| Reject non-future start on create                                          | Zod + `insert_meetup` AL006 + RLS                      | shared, DB, API                                   | PASS                                     |
| One shared contract imported by server and app                             | `packages/shared`                                      | typecheck; bundle; device                         | PASS                                     |
| Four-role access tests incl. multi-group + map data                        | `api-access.suite.ts`                                  | offline + hosted                                  | PASS                                     |
| Screens: sign-in, list (loading/empty/error), create, detail, RSVP, cancel | `mobile/src/features/*`                                | Jest + device                                     | PASS                                     |
| Map follows decision, updates after RSVP                                   | `MeetingPointMap`, cache update                        | Jest + device                                     | PASS                                     |
| Approximate ≥ 300 m, not centred, no coords/name before RSVP               | `app.approximate_area`, split table                    | DB, API, device                                   | PASS                                     |
| Home location never exposed                                                | column grants, explicit selects, response shaping      | DB, API scan, PostgREST                           | PASS                                     |
| Note + run instructions                                                    | `README.md`, `ENGINEERING_NOTES.md`                    | followed against the hosted project               | PASS                                     |
| Screen recording, exported AI log, developer review section                | —                                                      | —                                                 | NOT IMPLEMENTED (developer deliverables) |
| Bonus A edit                                                               | `…140000_edit_meetup.sql`, PATCH, Edit screen          | contract, DB (offline + hosted), API, Jest        | PASS                                     |
| Bonus B realtime map                                                       | `…150000_live_walk_realtime.sql`, `features/live-walk` | tests + live on device                            | PASS (performance not measured)          |

## Starter README compliance

| Instruction                                  | Verification                                                                                                                                                | Result |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Hosted path; starter applied exactly once    | migration history shows the starter once, first                                                                                                             | PASS   |
| Own migrations after the starter             | history order                                                                                                                                               | PASS   |
| Seed PART 1 as owner                         | `db:seed` over the owner connection; counts                                                                                                                 | PASS   |
| Adapt and load PART 2 after the tables exist | counts 3/3/3                                                                                                                                                | PASS   |
| Seed accounts sign in                        | 8/8 password grants                                                                                                                                         | PASS   |
| Expo app on one platform                     | Android emulator, Expo Go                                                                                                                                   | PASS   |
| 10.0.2.2 for the emulator API URL            | used in the E2E run                                                                                                                                         | PASS   |
| Service-role key never in the app            | not used anywhere; bundle and key-prefix checks                                                                                                             | PASS   |
| Shared Zod, one major, Metro resolves it     | `npm ls zod`; bundle; device                                                                                                                                | PASS   |
| Writes via validated server endpoints        | tests + PostgREST write attempts refused                                                                                                                    | PASS   |
| react-native-maps, no tokens in repo         | secret scans                                                                                                                                                | PASS   |
| Boot in under 30 minutes                     | migrations + seed + sign-in check took minutes once credentials were correct; the delay was the IPv6-only direct host and the `[YOUR-PASSWORD]` placeholder | PASS   |

## Final assessment

All mandatory requirements are implemented and verified against hosted Supabase and on an Android
device. Both bonuses work; the live-map performance characteristics are designed for but not
measured. The developer-owned deliverables (recording, exported AI log, the developer review section
of ENGINEERING_NOTES.md) remain.
