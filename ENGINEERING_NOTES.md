# Engineering notes

## 1. The product decision: approximate area until RSVP

**Decision.** Members who have not RSVP'd see an approximate area (a 400 m circle whose centre is
offset from the spot) and a generic label instead of the place name. The creator and members who
RSVP'd see the exact point and its name. RSVPing updates the map immediately; withdrawing turns it
back into the area.

**Why, in terms of the people using the app.** A meetup post says _where a specific neighbour
will be, at a specific time, usually early morning or evening, often alone with a dog_. Walking
groups are "a handful to a few dozen neighbours" and membership is loose (people join, move,
lose interest), so "everyone in the group" is a wider and less known audience than "the people
who said they are coming". The decision a non-attendee actually has to make, _is this walk near
me and when_, only needs the area and the time. The exact gathering spot is needed only by the
people who will walk there, and an RSVP is a light, visible commitment (attendees are listed by
name), which gives the organiser accountability for who knows the spot. The cost is one tap
before you see the pin; the area is precise enough to decide whether to tap.

**How the area is computed (in the database, `app.approximate_area`).**

- Centre = exact point moved **120–280 m in a random direction**; radius **400 m**. The exact
  point is always inside the circle (offset < radius), so the area is honest.
- **Computed once at creation and stored**, never re-randomised per request: repeated reads can't
  be averaged back to the spot. (When the creator moves the point with the bonus edit, a new area
  is computed around the new point.)
- **Random per meetup**, not a fixed shift and not a grid: learning one meetup's exact point by
  RSVPing tells you nothing about another meetup's offset. A grid snap was rejected because a spot
  near a cell centre gives an area centred almost on the spot.
- The **place name never leaves the server** before RSVP; the app shows its own label.

**Where it is enforced.** The exact point lives in its own table, `meetup_meeting_points`, whose
RLS policy admits only the creator and attendees who are still group members
(`app.can_see_exact_meeting_point`). RLS is per row, not per column, so the split is what lets the
database alone withhold it. The `meetups` row a member can read contains only the area. The service
layer applies a second, independent check (`meetingPointFor`), and every response is parsed
through the shared Zod schema, which drops anything not in the contract.

## 2. Architecture

| Layer          | Server                                                                     | App                                                          |
| -------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Presentation   | `http/` (Fastify app, auth hook, error handler), `features/*/…routes.ts`   | `features/*/screens`, `components`, `ui/`                    |
| Application    | `features/*/…service.ts` (business rules, no SQL)                          | `features/*/hooks.ts` (React Query)                          |
| Domain / ports | `domain/` (types, ports, pure rules, errors)                               | `core/ports.ts`                                              |
| Infrastructure | `infrastructure/` (pg repositories, unit of work, Supabase token verifier) | `core/api`, `core/auth` (Supabase), composition in `App.tsx` |
| Contract       | `packages/shared` (imported by both)                                       |                                                              |

Dependencies point inward: routes → services → ports ← repositories. `index.ts` (server) and
`App.tsx` (app) are the only composition roots. That is what lets the same services run against
fakes (unit tests), embedded Postgres (offline tests) and hosted Supabase (hosted tests), and lets
the app screens be tested with fake gateways.

**Kept deliberately small:** one Fastify process, no DI container, no ORM, no event bus, no
generic repository base class. Plain SQL in three repositories is easier to review against RLS
than an ORM's generated queries.

### Reads go through the API too

Reads may legally go straight to PostgREST under RLS, and the database is built so that would be
safe (the hosted tests prove it). I still route reads through the API so the app consumes **one
contract** for everything (a meetup's `viewer` flags and `meetingPoint` union are computed in one
place) and so a schema change can't silently break the app.

## 3. Security approach

- **Writes only through the API.** `authenticated` has `SELECT` only; no insert/update/delete
  grant on any table and no execute on the `app` functions (and `app` is not an exposed API
  schema). Writes run as `altair_api_writer`, a `NOLOGIN` role that PostgREST cannot switch to.
  The API binds the verified member to the transaction with `SET LOCAL ROLE` and a
  transaction-local `request.jwt.claims`, so pooled connections never leak identity between
  requests.
- **RLS on everything**, including writes: creator-only cancel/edit, RSVP/withdraw only for
  yourself, create only in your own group and only as yourself. The server's checks give good error
  messages; the database is the enforcement.
- **Home location**: `users` has a _column-level_ grant (`id, display_name`) for client-facing
  roles. `select home_lat …` and `select * from users` fail with "permission denied" even for your
  own row. No query in the server selects anything else from `users`.
- **Domain rules in triggers** (they hold for every writer, including the owner): no RSVP to a
  cancelled or started meetup, RSVP user must be a group member, cancellation is final, identity
  columns immutable. The RSVP trigger locks the meetup row `FOR SHARE`, which serialises it against
  a concurrent cancel (hosted test: an RSVP blocked behind an uncommitted cancel is rejected once
  the cancel commits).
- **No information leaks in errors.** Outsiders get the same `404 Meetup not found` for a real
  meetup as for a random id (tested byte-for-byte). The RSVP trigger checks membership _before_
  status, so an outsider can't probe whether a meetup is cancelled. Unknown errors become a generic
  500; SQL and stack traces are only logged server-side. The `Authorization` header is redacted
  from logs.
- **Never trust the client**: request schemas are strict (an extra `createdBy`, `groupId` on edit,
  or a body on RSVP is a 400). The creator is always `app.current_user_id()` from the verified
  token.
- **Service-role key**: not used anywhere. It is not needed and is not in any `.env` template.

### Privileged functions and their properties

| Function                                                                                      | Security                  | Why it is safe                                                                                                        |
| --------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `app.is_group_member`, `is_meetup_member`, `can_see_exact_meeting_point`, `shares_group_with` | DEFINER, `search_path=''` | Read `group_memberships` without recursing into its RLS; answer yes/no about the **caller** only.                     |
| `app.guard_rsvp_insert` (trigger)                                                             | DEFINER                   | Locks the meetup row regardless of the caller's RLS view; returns nothing but an error code; checks membership first. |
| `app.on_meeting_point_update` (trigger, bonus)                                                | DEFINER                   | Only fires for rows the caller's RLS already allowed them to update; recomputes the area (owner-only columns).        |
| `app.insert_meetup`                                                                           | INVOKER                   | Runs under the writer's RLS; the seed calls it as owner.                                                              |

## 4. Trade-offs and what I'd change for production

- The API connects with the database owner's credentials and _drops_ privileges per transaction.
  For production I'd create a dedicated `LOGIN` role that is a member of only `authenticated` and
  `altair_api_writer`, so a compromised API process can't bypass RLS.
- Token verification calls Supabase Auth (`getUser`) per request: simple, and correct for revoked
  sessions and for both legacy and asymmetric signing keys. At scale I'd verify locally against
  the project's JWKS and cache.
- The approximate area is a random draw stored per meetup. In very sparse areas a 400 m circle may
  contain only one plausible public place; the product should eventually size areas by place
  density, not a constant.
- `random()` (not a CSPRNG) chooses the offset. An attacker can't observe the generator, and the
  value is drawn once, so this is adequate; `gen_random_bytes` would be the stricter choice.
- "Started" is `starts_at <= now()` in the database clock (also used for `canRsvp`), so the app
  and the trigger never disagree.

## 5. One thing I would refuse to build first

**Live location sharing of members during walks** (the brief's optional realtime map, as a real
feature). For a dog-walking group, a walk usually _starts at someone's front door_, so a live
track leaks the very home location this spec makes private, plus routines and times when a person
is out. I would not build it until there is per-walk opt-in, sharing that starts only inside a
geofence around the public meeting point and stops automatically, no retention of tracks, and
visibility limited to attendees of that walk. (That is how the bonus work sample, if built, is
scoped: synthetic positions only, private channels restricted to attendees.)

## 6. What I would push back on in the spec

1. **No end time or duration.** "Started" is the only cut-off, so a meetup is never "over"; lists
   grow forever and the app can't separate _upcoming_ from _past_. I'd add a duration (or end
   time) and default the list to upcoming.
2. **Editing the place after people RSVP'd** (bonus) silently changes their plans. Attendees
   should be told, and possibly asked to re-confirm; notifications are out of scope, so today they
   only find out by opening the meetup.
3. **Cancellation is invisible to attendees** for the same reason. A cancelled walk at 7 am that
   nobody hears about is a real failure mode; this is the first notification I'd ship.
4. **Creators who leave the group.** RLS requires membership, so a creator who leaves can no
   longer cancel and the meetup is orphaned. The spec needs an owner-transfer or group-admin rule.
5. **The attendee list is visible before RSVP.** Fine inside a small group, but combined with time
   and area it says who will be where; worth a conscious decision rather than a default.
6. **A fixed 300 m minimum** protects little in dense areas and may still identify the spot in
   sparse ones (see trade-offs). The requirement should be about ambiguity (number of plausible
   places), not metres.

## 7. Assumptions

- A member may RSVP to their own meetup (they're a member; the creator already sees the exact
  point, so it only adds them to the attendee list).
- RSVPing twice returns 200 and leaves one RSVP, even if the meetup has since been cancelled or
  started (the existing RSVP simply stands). Withdrawing without an RSVP is a 200 no-op.
- Cancelling an already-cancelled meetup is a 200 no-op. A creator may cancel a meetup that has
  started.
- A member who leaves a group loses access to its meetups, including exact points they had via
  RSVP.
- Deleted users appear as "Former member".

## 8. If the starter was already applied

The Supabase CLI records applied migrations in `supabase_migrations.schema_migrations`. If the
starter was pasted into the SQL editor instead, `db push` will try to apply
`20261001000000_starter.sql` again and fail on "relation already exists". Do not drop anything:
mark only the starter as applied, then push the rest:

```bash
npx supabase migration repair --db-url "$DATABASE_URL" --status applied 20261001000000
npm run db:push
```

## 9. How this was built (AI-assisted)

The code, SQL, tests and documents in this repository were written by an AI coding agent
(Claude Code) under the developer's direction, in one session whose exported log accompanies the
submission. The agent ran every command shown in QA_REPORT.md. What it caught and corrected along
the way, from that log:

- **npm 10 crash** (`edgesOut` of null) during the first install: switched the portable Node's npm
  to 11. The agent's first attempt installed npm 11 into the _user-global_ prefix, which changed
  the machine's default npm; it noticed, removed exactly the files it had added, and installed
  npm 11 into the project's ignored `.tools/` instead.
- **Testing Library 14 made `render` and `fireEvent` async**: 18 of 23 app tests failed with
  "render has not been called". Fixed by awaiting them, and added a type-aware
  `no-floating-promises` lint rule for the app tests (then proved the rule fires).
- **Rules-of-hooks bug** in the detail screen (a hook called after early returns), spotted during
  writing and fixed before the first run.
- **Mutation checks** of the privacy tests: weakening the exact-point RLS policy and the service's
  entitlement check made 12 tests fail; weakening the bonus edit policy made the edit test fail.
  During the second check the restore step used `git checkout` on a then-untracked file, which
  silently did nothing; the agent detected the leftover `using (true)`, restored the policy by
  hand, and verified no permissive policy remains.
- A test that asserted "the writer role cannot change a title" became wrong by design once the
  edit bonus granted that column; it was rewritten to assert what must remain impossible
  (changing group or creator).
- **`npm run server` crashed on startup** although every test passed: the server is an ES module
  and `packages/shared` was loaded by Node as CommonJS ("does not provide an export named …").
  Vitest and Metro transform modules uniformly, so they masked it. Found by actually starting the
  server; fixed by declaring the shared package `"type": "module"`, and a regression test now
  spawns the real entry point under Node (it fails if the fix is reverted). The fix's commit
  message was truncated by PowerShell quoting; rather than rewrite history, the full message is
  attached as a `git notes` entry (`git log --notes`).
- A meetup whose creator's profile is not visible (left the group) would have disappeared from
  lists with an inner join; the queries use a left join and "Former member".

### Developer's own direction and review — TO BE COMPLETED BY THE DEVELOPER

> The challenge asks what _you_ directed and what _you_ reviewed or fixed by hand. Only you can
> state that accurately; nothing below has been filled in for you.
>
> - What I directed (key instructions and decisions I made):
> - What I reviewed line by line:
> - What I changed by hand, and why:
> - Where I disagreed with the agent:

## 10. Setup time and environment notes

- No Docker on the development machine, so the hosted path (README Path B) is the only one used.
- The machine had Node 20; Expo SDK 58 (the SDK current Expo Go runs) requires Node ≥ 22.13. A
  portable Node 22 was downloaded (SHA-256 verified) into the git-ignored `.tools/` folder rather
  than changing the system install.
- Offline verification uses PGlite (Postgres 17 compiled to WASM) with a small Supabase shim
  (`server/test/support/supabase-shim.sql`: the API roles, the `auth` tables the seed writes, and
  Supabase's default grants, so the migrations' revokes are exercised). It is a faithful Postgres,
  not Supabase: Auth, PostgREST and the pooler are only covered by the hosted suite.

## 11. Known limitations and remaining risks

See QA_REPORT.md for the verification status of each item. Summarised:

- Hosted verification and the on-device run depend on a configured Supabase project and an
  emulator/device; their status is recorded in QA_REPORT.md as run, not assumed.
- No rate limiting on the API (out of scope here; would sit in front of Fastify).
- No pagination on meetup lists (groups are small; add keyset pagination on `(starts_at, id)`).
- The RSVP-vs-cancel race is covered on hosted Postgres only (PGlite is single-connection).
