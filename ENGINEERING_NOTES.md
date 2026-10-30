# Engineering notes: Altair group meetups

**Scope.** The database, write layer, shared contract and React Native app for group meetups,
RSVPs and the meetup map, built from the provided schema starter, seed and feature spec. Both
optional bonuses are included.

**Status.** Verified against hosted Supabase (89 hosted tests), offline against the real
migrations on Postgres 17 (224 tests), and end to end on an Android emulator with Expo Go. Run
instructions are in [README.md](README.md); the evidence is in [QA_REPORT.md](QA_REPORT.md).

| Section                                                                        | What it answers                                     |
| ------------------------------------------------------------------------------ | --------------------------------------------------- |
| [1. Product decision](#1-product-decision-approximate-area-until-rsvp)         | The open question in the spec, and why              |
| [2. Architecture](#2-architecture)                                             | How the slice is put together                       |
| [3. Security model](#3-security-model)                                         | Where each access rule is enforced                  |
| [4. What I would refuse to build first](#4-what-i-would-refuse-to-build-first) | The refuse-first item                               |
| [5. Pushback on the spec](#5-pushback-on-the-spec)                             | What I would change in the spec                     |
| [6. How this was built](#6-how-this-was-built-direction-and-review)            | What was directed, what was caught, what I reviewed |
| [7. Verification](#7-verification)                                             | How the claims above are proven                     |
| [8. Trade-offs and next steps](#8-trade-offs-and-next-steps)                   | What I would change for production                  |
| [9. Assumptions](#9-assumptions)                                               | Where the spec was silent                           |
| [10. Setup notes](#10-setup-notes)                                             | Boot time, what slowed it, environment details      |

---

## 1. Product decision: approximate area until RSVP

**Decision.** Members who have not RSVP'd see an approximate area: a 400 m circle whose center is
offset from the meeting point, with a generic label instead of the place name. The creator and
members who have RSVP'd see the exact point and its name. RSVPing switches the map at once;
withdrawing switches it back.

**Why, in terms of the people using the app.** A meetup post says where a specific neighbor will
be at a specific time, usually early in the morning or in the evening, often alone with a dog.
Walking groups are "a handful to a few dozen neighbors" and membership is loose: people join, move
away, lose interest. "Everyone in the group" is therefore a wider and less known audience than
"the people who said they are coming". The decision a non-attendee actually makes, _is this walk
near me, and when_, needs only the area and the time. The exact spot is needed only by the people
who will walk there, and an RSVP is a light but visible commitment (attendees are listed by name),
which gives the host accountability for who knows the spot. The cost is one tap before seeing the
pin; the area is precise enough to decide whether to tap.

**How the area is computed** (in the database, `app.approximate_area`):

- **Offset, not centered.** The center is the exact point moved 120–280 m in a random direction;
  the radius is 400 m. The exact point is always inside the circle, so the area is honest.
- **Computed once and stored.** It is never re-randomized per request, so repeated reads cannot be
  averaged back to the spot. If the host moves the point (bonus edit), a new area is computed for
  the new point.
- **Random per meetup.** A fixed shift or grid would let anyone who RSVPs to one meetup learn the
  offset for all of them. A grid snap was also rejected because a spot near a cell's center yields
  an area centered almost exactly on the spot.
- **Place name withheld.** "North gate, Linden Park" pins the spot as precisely as coordinates, so
  it never leaves the server before RSVP; the app shows its own label.

**Where it is enforced.** The exact point lives in its own table, `meetup_meeting_points`, whose
row-level security policy admits only the creator and attendees who are still group members. RLS
is per row, not per column, so this split is what lets the database alone withhold the location;
the `meetups` row any member can read contains only the area. The service applies a second,
independent check (`meetingPointFor`), and every response is parsed through the shared schema,
which drops any field the contract does not declare.

## 2. Architecture

```
 Expo app (React Native) ──HTTPS + member JWT──▶ Fastify API (Node 22) ──▶ Supabase Postgres
 screens → hooks → gateway ports                 routes → services → ports ← repositories
           │                                     (parse with the shared Zod contract)
           └── sign-in only ──▶ Supabase Auth ◀── token verification
                         packages/shared: one Zod contract, imported by the API and the app
```

| Layer          | Server                                                       | App                                              |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| Presentation   | `http/` (app, auth hook, error handler), `features/*/routes` | `features/*/screens`, `components`, `ui/`        |
| Application    | `features/*/…service.ts` (rules, no SQL)                     | `features/*/hooks.ts` (React Query)              |
| Domain / ports | `domain/` (types, ports, pure rules, errors)                 | `core/ports.ts`                                  |
| Infrastructure | `infrastructure/` (SQL repositories, unit of work, verifier) | `core/api`, `core/supabase`; wiring in `App.tsx` |

Dependencies point inward, and `index.ts` / `App.tsx` are the only composition roots. That is what
lets the same services run against fakes, embedded Postgres and hosted Supabase, and lets the app
screens be tested with fake gateways. A mechanical check of the import graph found no cycles.

**Key choices**

- **One contract.** Request and response schemas live in `packages/shared`. The app validates with
  them for immediate feedback; the server validates with them authoritatively. Request schemas are
  strict, so an extra `createdBy` is a 400 rather than silently ignored.
- **Writes can only go through the API.** This is enforced by the database, not by convention
  (see §3).
- **Reads also go through the API**, although the database is built so that direct reads would be
  safe (the hosted tests prove it). One contract for everything means a meetup's viewer flags and
  meeting-point view are computed in one place.
- **Deliberately small.** One Fastify process, plain SQL in three repositories, no ORM, no DI
  container, no event bus. Plain SQL is easier to review against RLS policies than generated
  queries.

## 3. Security model

| Rule                                                    | Enforced by                                                                         |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Outsiders read nothing (meetups, attendees, locations)  | RLS on every table, via membership predicates                                       |
| Exact point only for the creator and attendees          | RLS on `meetup_meeting_points`; service check; response schema                      |
| Home location never exposed                             | Column-level grant: client roles may read only `id, display_name` from `users`      |
| Every write passes server-side Zod validation           | `authenticated` (the role a member's JWT maps to) has **no** write grants           |
| Creator-only cancel and edit                            | RLS update policies for the writer role                                             |
| RSVP only for yourself, only in your own group          | RLS insert/delete policies + membership trigger                                     |
| No RSVP to a cancelled or started meetup                | Trigger, with a `FOR SHARE` row lock that serializes it against a concurrent cancel |
| Cancellation is final; identity columns immutable       | Update trigger                                                                      |
| A changed start time must be in the future (edit bonus) | Zod schema + update trigger                                                         |

**How the API acts as a member.** After verifying the token with Supabase Auth and validating the
body, the API runs each request in a transaction with `SET LOCAL ROLE` (`authenticated` for reads,
`altair_api_writer` for writes) and a transaction-local `request.jwt.claims`. RLS therefore
applies exactly as for the member's own query, and a pooled connection never carries one member's
identity into the next request. `altair_api_writer` is a `NOLOGIN` role that PostgREST cannot
switch to, so the app cannot reach it.

**No information in errors.** An outsider gets the same `404 Meetup not found` for a real meetup
as for a random id (tested byte for byte). The RSVP trigger checks membership before status, so an
outsider cannot probe whether a meetup is cancelled. Unknown errors become a generic 500; SQL and
stack traces are only logged server-side, and the `Authorization` header is redacted from logs.

**Service-role key.** Not used anywhere and not in any `.env` template.

| Privileged function                                                                           | Security                  | Why it is safe                                                                            |
| --------------------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| `app.is_group_member`, `is_meetup_member`, `can_see_exact_meeting_point`, `shares_group_with` | DEFINER, `search_path=''` | Read memberships without recursing into their RLS; answer yes/no about the caller only.   |
| `app.guard_rsvp_insert` (trigger)                                                             | DEFINER                   | Locks the meetup row; returns nothing but an error code; checks membership first.         |
| `app.on_meeting_point_update` (trigger, edit bonus)                                           | DEFINER                   | Fires only for rows the caller's RLS already allowed them to update; recomputes the area. |
| `app.can_join_live_walk` (Realtime bonus)                                                     | DEFINER                   | Same audience as the exact point, and only while the meetup is scheduled.                 |

## 4. What I would refuse to build first

**Live location sharing of members during walks.** For a dog-walking group, a walk usually starts
at someone's front door, so a live track leaks the very home location this spec makes private,
along with routines and the times a person is out. I would not build it until there is per-walk
opt-in, sharing that starts only inside a geofence around the public meeting point and stops
automatically, no retention of tracks, and visibility limited to the attendees of that walk. The
Realtime bonus is scoped accordingly: synthetic positions only, on private channels that only the
host and attendees can join.

## 5. Pushback on the spec

1. **Meetups have no end time or duration.** "Started" is the only cut-off, so nothing is ever
   "past"; lists grow forever and the app cannot separate upcoming from past walks.
   _Recommendation:_ add a duration and default the list to upcoming.
2. **Cancelling or editing notifies nobody.** A 7 a.m. walk cancelled without anyone hearing about
   it is a real failure mode, and moving the meeting point after people RSVP silently changes their
   plans. _Recommendation:_ cancellation and location-change notifications should be the first
   follow-up, ahead of anything else on the roadmap.
3. **A creator who leaves the group orphans the meetup.** RLS requires membership, so they can no
   longer cancel it. _Recommendation:_ define ownership transfer or a group-admin role.
4. **The attendee list is visible before RSVP.** Reasonable inside a small group, but combined with
   the time and area it tells members who will be where. _Recommendation:_ make this a conscious
   product decision rather than a default.
5. **A fixed 300 m minimum is the wrong measure.** It protects little in dense areas and may still
   identify the spot in sparse ones where a circle contains one plausible public place.
   _Recommendation:_ express the requirement as ambiguity (how many plausible places the area
   contains), not meters.

## 6. How this was built: direction and review

The repository was built with an AI coding agent (Claude Code) under my direction, in sessions
whose exported log accompanies the submission. The agent ran every command reported in
QA_REPORT.md.

### What I directed

From my instructions in the session:

- **The product decision** (§1): members who have not RSVP'd see only an approximate area of at
  least 300 m that is not centered on the point; the creator always sees the exact point.
- **The stack and environment:** Expo React Native, a Fastify TypeScript API, Zod, and hosted
  Supabase rather than Docker; a portable Node 22 in the project folder rather than changing the
  system install.
- **Clean, feature-based architecture** with ports and adapters and no unnecessary abstraction.
- **Strict compliance with the starter README:** migrations through the Supabase CLI, the starter
  applied exactly once, no reset of the hosted database without my approval.
- **Security expectations:** RLS for every rule, no service-role shortcuts, home location never
  exposed, writes only through the validated API.
- **Testing and honesty rules:** tests against real authenticated sessions; nothing marked as
  passed unless it ran; unresolved issues reported, not hidden.
- **Git discipline:** history preserved, milestone commits, no history rewriting, nothing pushed
  without my approval.
- **Scope and order:** mandatory requirements first and verified, then the edit bonus, then the
  Realtime bonus.
- **A suspected authorization defect** (a non-creator editing a meetup), which I raised for
  investigation; see below.
- **The mobile redesign** (commits `a661d8d`, `1d8995f`) was committed by me; I describe how it was
  produced in my own review below.

### What the process caught and corrected

| Issue                                                                                                      | How it was found                       | Resolution                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run server` crashed on startup although every test passed: Node loaded the shared package as CommonJS | Starting the real server               | Shared package declared ESM; a regression test now starts the real entry point (`9e227bb`, `11606fd`)                                                     |
| Testing Library 14 made `render` and `fireEvent` asynchronous; app tests were not rendering anything       | 18 of 23 app tests failed on first run | Tests await them; a lint rule now rejects floating promises in app tests                                                                                  |
| Two React rules-of-hooks violations                                                                        | Code review while writing              | Fixed before the first run                                                                                                                                |
| A mutation-test restore missed an untracked file, leaving a permissive RLS policy on disk                  | Checking the result of the restore     | Policy restored by hand; a search confirms no permissive policy remains                                                                                   |
| A "dry run" of the migrations really applied them: PowerShell strips a bare `--`                           | The command's output                   | It reached the intended, verified-empty project; added `npm run db:push:dry` and a README warning                                                         |
| A `react-native` version pin followed a transient tool result                                              | The tool later reported the opposite   | Corrected in a follow-up commit, not rewritten (`103443d` → `6871c72`)                                                                                    |
| Reported: a non-creator could edit a meetup                                                                | My report                              | No defect: in the hosted database only the creator's update changes rows. The real gap was test coverage, so DB-level hosted tests were added (`e1b4b7d`) |
| A meetup whose creator left the group would vanish from lists with an inner join                           | Considered while writing the queries   | Left join with "Former member", so it never shipped                                                                                                       |

The privacy tests were checked by breaking what they protect: weakening the exact-point policy and
the service check made 12 tests fail; weakening the edit policy made its test fail.

### My own review and hand changes

My own review and hand changes

1. What I reviewed and verified myself

During development, I actively reviewed the application's functionality, user experience, and implementation progress rather than relying solely on the AI agent's completion reports.

My review included:

Application functionality: I launched the Expo React Native application on an Android emulator and inspected the authentication screen, group selection, meetup listings, meetup creation, meetup details, RSVP controls, maps, and cancellation states.

UI/UX quality: I identified issues with oversized group-selection cards, inconsistent layouts, spacing, visual hierarchy, and overall usability. I requested several design improvements to make the application more professional, consistent, and user-friendly.

Creator permissions: During manual testing, I raised a concern that editing might be available for a meetup created by another user. I requested an investigation covering frontend permissions, backend authorization, and PostgreSQL RLS rather than assuming the issue was only visual.

Project architecture: I inspected the monorepo structure and root package.json to confirm the separation of the React Native app, Fastify backend, shared Zod package, and Supabase migrations.

Git history: I inspected the actual Git commit history using git status and git log --oneline to confirm that development milestones were preserved.

Development environment: I tested the application's startup process on Windows and investigated issues involving Node.js versions, PowerShell execution restrictions, and the Android emulator.

I also reviewed the assignment requirements against the implementation and emphasized that access control must be enforced by the database, not merely by hiding buttons or screens.

These activities represent my manual functional and implementation review. I do not claim to have independently audited every source file line by line.

2. What I changed by hand, and why

My directly performed changes were primarily related to development setup, configuration, and application verification.

I configured and troubleshot my local development environment, including identifying the correct portable Node.js 22 installation, using it without replacing my system-wide Node.js 20 installation, and switching to npm.cmd to work around PowerShell script-execution restrictions.

I also inspected the running Android application, identified interface problems, and provided feedback and design references to guide subsequent improvements.

For implementation-level code changes, I used AI-assisted development and requested corrections through explicit instructions. I have not independently established which source-code changes, if any, I personally typed by hand, so I am not presenting AI-generated changes as manually written code.

My contribution included defining expectations, reviewing the working application, identifying issues, directing corrections, and checking development progress.

3. Where I disagreed with or challenged the AI agent

Database testing priorities

When the agent proposed building a custom offline PostgreSQL harness using PGlite and a Supabase compatibility shim, I questioned whether that additional infrastructure was required by the challenge.

My concern was that successful simulated tests would not necessarily prove authorization behavior in a real hosted Supabase environment.

I prioritized actual database-level security verification, especially creator-only permissions, multi-group isolation, outsider access, and meeting-point privacy. The final project retained offline testing while also adding hosted Supabase verification.

Creator-only editing

I challenged the apparent ability to edit meetups owned by other users.

Rather than accepting a frontend-only correction, I requested verification across the React Native interface, authenticated API endpoints, and database RLS policies.

The subsequent investigation did not establish an authorization defect. However, it identified insufficient direct hosted database test coverage for editing permissions.

Four additional hosted database-level authorization tests were added. This strengthened the verification of creator-only access.

UI/UX quality

I was not satisfied with the initial visual presentation, even though the application was functional.

I requested improvements to screen layouts, navigation clarity, group selection, form presentation, map usability, and visual consistency.

My objective was to make the application easier to understand and use without compromising its existing business rules or security requirements.

Scope and implementation quality

I emphasized completing the mandatory challenge requirements before investing effort in optional infrastructure or bonus features.

I also insisted that testing reports distinguish actual executed results from assumptions and that the original Git history be preserved.

4. What I learned from the review process

This project reinforced that AI-generated code still requires independent evaluation.

A successful build or a passing test suite does not automatically prove that the application is secure, usable, or complete.

The most valuable review activities were exercising the application on an emulator, questioning unexpected behavior, checking authorization at multiple layers, and requiring test evidence for critical security claims.

I treated AI assistance as an implementation accelerator rather than a replacement for engineering judgment.

My focus was on defining requirements, identifying potential failures, challenging questionable assumptions, and ensuring that the submitted work reflected the actual implementation and verification results.

## 7. Verification

| Evidence                                                                                                                             | Result               |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| Offline: shared contract, server unit tests, API and database tests on the real migrations and seed (PGlite, Postgres 17), app tests | 224 passed           |
| Hosted Supabase: real Auth tokens, API suite, direct PostgREST bypass attempts, RSVP-versus-cancel race, edit authorization          | 89 passed            |
| On-device journey (Android emulator, Expo Go, hosted backend): approximate → RSVP → exact → withdraw; host cancel; outsider          | Passed, step by step |
| `npm run demo:privacy`: outsider and non-RSVP results through the API and directly through Supabase                                  | As specified         |

The four roles from the brief (outsider, member without RSVP, member with RSVP, creator) and the
multi-group member (Riley, in both groups) are covered, including the map data per group. The
offline harness is a faithful Postgres, not Supabase: Auth, PostgREST, Realtime and the pooler are
covered only by the hosted suite.

## 8. Trade-offs and next steps

- **Least-privilege connection.** The API connects with the database owner's credentials and drops
  privileges per transaction. For production I would use a dedicated login role that is a member of
  only `authenticated` and `altair_api_writer`.
- **Token verification** calls Supabase Auth per request: simple, and correct for revoked sessions
  and both key types. At scale I would verify locally against the project's JWKS.
- **Area size** is a constant 400 m; it should eventually depend on place density (§5, item 5).
- **Randomness:** the offset uses `random()`, drawn once and unobservable; `gen_random_bytes` would
  be stricter.
- **Not yet built:** rate limiting, pagination (keyset on `starts_at, id`), notifications, and
  measured performance of the live map (no FPS, latency or battery figures are claimed; see
  [REALTIME_MAP_BONUS.md](REALTIME_MAP_BONUS.md)).

## 9. Assumptions

- A member may RSVP to their own meetup; it only adds them to the attendee list.
- RSVPing twice returns 200 and leaves one RSVP, even if the meetup has since been cancelled or
  started. Withdrawing without an RSVP is a 200 no-op.
- Cancelling an already-cancelled meetup is a 200 no-op. A host may cancel a meetup that has
  started.
- A member who leaves a group loses access to its meetups, including exact points they saw via RSVP.
- "Started" means `starts_at <= now()` on the database clock, which the app and the trigger share.
- Deleted users appear as "Former member".

## 10. Setup notes

- **Boot time.** Migrations, seed and a seed sign-in took minutes once the connection string was
  right. Two things slowed it down: the dashboard's direct connection host is IPv6-only and
  unreachable from an IPv4 network (the Session pooler string works), and the pooler string is
  shown with a literal `[YOUR-PASSWORD]` placeholder that must be replaced.
- **Environment.** No Docker was used, so only the hosted path was exercised. Expo SDK 58 needs
  Node ≥ 22.13; a portable, checksum-verified Node 22 lives in the git-ignored `.tools/` folder.
- **If the starter was already applied** through the SQL editor, `db push` would try to apply it
  again and fail. Mark only the starter as applied, then push the rest:

  ```bash
  npx supabase migration repair --db-url "$DATABASE_URL" --status applied 20261001000000
  npm run db:push
  ```
