# Phase 1 — Auth foundation (Prisma + Postgres + Better Auth)

Implementation plan for the first slice of the cloud backend described in
[backend.md](./backend.md). Scope is deliberately narrow: get the ORM, the
database, and the login system standing up, and prove them by running the
signup and login flow on a local machine.

**Definition of done:** on `localhost:3000` you can create an account, sign in,
land on a protected page that says you are signed in, sign out, and be blocked
from that page again. A row exists in Postgres for the account you created.

Everything else in backend.md — Stripe, R2, Inngest, previews, hosting, the
Electron `scamp://` callback — is explicitly out of scope here. See
[Out of scope](#out-of-scope).

---

## Status: implemented ✅

Phases 0–4 are done and verified end to end on 2026-08-11. The signup and login
flow works locally. What follows is the plan as executed — three things differed
from the original assumptions, recorded here rather than silently corrected.

### What differed from the plan

**1. No Neon account needed for local development.** Prisma 7 ships a local
Postgres server (`npx prisma dev`), so there is no Docker, sudo, or cloud
signup in the loop. `.env.example` documents the commands. Neon is still the
production target.

**2. Prisma 7 requires a driver adapter — always, not just on Workers.** The
plan said `@prisma/adapter-neon` was "not required for local `next dev`". That
is wrong for Prisma 7: it dropped the Rust query engine, so bare
`new PrismaClient()` throws at construction. `lib/prisma.ts` uses
`@prisma/adapter-pg`, which speaks plain Postgres over TCP and covers both the
local server and Neon. The Workers swap to `@prisma/adapter-neon` is still
required, because Workers have no TCP sockets.

**3. No proxy/middleware file was needed.** Route protection lives in the page
(`redirect()` on a null session), so the Next 16 `middleware.ts` → `proxy.ts`
rename never came up. The warning is kept below for when a proxy is genuinely
wanted.

### Verified

| Check | Result |
|---|---|
| `/dashboard` signed out | `307` → `/sign-in` |
| Sign up | `200`, user row created |
| `/dashboard` with session | `200`, renders name/email/id read from Postgres |
| Sign in again | same user id, no duplicate row |
| Database after both | 1 user, 2 sessions, 1 account (`credential`, password set) |
| Marketing routes | still `○`/`●`, identical to the Phase 0 baseline |
| Dynamic routes | only `ƒ /dashboard` and `ƒ /api/auth/[...all]` |

Test data was deleted afterwards, so the database starts empty.

### Files added

```
app/(marketing)/layout.tsx          static boundary — no session reads
app/(app)/layout.tsx                dynamic boundary
app/(app)/sign-up/page.tsx          signup form
app/(app)/sign-in/page.tsx          signin form
app/(app)/dashboard/page.tsx        protected success page
app/(app)/dashboard/SignOutButton.tsx
app/(app)/auth.module.css           deliberately plain styling
app/api/auth/[...all]/route.ts      Better Auth handler
lib/auth.ts                         server instance + Prisma adapter
lib/auth-client.ts                  browser client
lib/session.ts                      getCurrentUser()
lib/prisma.ts                       client singleton + pg adapter
prisma/schema.prisma                generated auth models
prisma/migrations/…_auth_init/
.env.example                        committed; .env is gitignored
```

---

## 0. The blocker: this site is a static export

This is the single most important thing in this document, and it needs a
decision before any code is written.

`next.config.ts` currently sets `output: "export"`, and `wrangler.jsonc` is an
assets-only deployment with no Worker in the request path. Per the Next.js
static export docs bundled in this repo
(`node_modules/next/dist/docs/01-app/02-guides/static-exports.md`), a static
export **cannot** use:

- Route Handlers that rely on `Request`
- Cookies
- Proxy (the file convention formerly called middleware)
- Server Actions
- Redirects and headers

That is precisely the entire surface an auth system needs. The docs also state:

> Attempting to use any of these features with `next dev` will result in an
> error, similar to setting the `dynamic` option to `error` in the root layout.

So this does not merely fail at deploy time — it fails in local development,
which is the environment this plan targets. `output: "export"` has to go before
step one.

### Removing it does NOT make the marketing pages dynamic

This is the important correction, and it makes the decision much easier than it
first appears.

`output: "export"` is a **global** switch that forces every route to be static.
Without it, the App Router classifies **each route independently** at build
time. A route that never touches a dynamic API (cookies, headers, `auth()`) is
prerendered to static HTML at build time exactly as it is today. Only routes
that genuinely need a server become server-invoked.

The adapter reference in this repo
(`node_modules/next/dist/docs/01-app/03-api-reference/07-adapters/09-output-types.md`)
makes the mechanism explicit. Build outputs are split into separate buckets —
`prerenders` ("ISR-enabled routes and static prerenders"), `staticFiles`
("static assets and auto-statically optimized pages"), and `appPages` /
`appRoutes` for server-invoked routes — and then:

> When `config.output` is set to `'export'`, only `outputs.staticFiles` is
> populated. All other arrays will be empty since the entire application is
> exported as static files.

So the all-or-nothing behaviour is caused *by* the export flag. Remove it and
the intended split appears:

| Route | After removing `output: "export"` |
|---|---|
| `/`, `/pricing`, `/about`, `/trust`, `/faq`, `/alternatives`, … | Prerendered static HTML, unchanged |
| `/docs/[slug]` | Still SSG via `generateStaticParams` (already `●` in the build output) |
| `/dashboard`, `/sign-in`, `/sign-up` | Dynamic, server-rendered |
| `app/api/*` | Server route handlers |

You already see this classification on every build — the summary prints `○`
(Static), `●` (SSG), and `ƒ` (Dynamic) per route. Today every row is `○` or `●`
because the export flag forces it. After Phase 0 the marketing rows should
*stay* `○`/`●`, and only the new auth routes should appear as `ƒ`.

**So: one Next.js app, marketing and docs stay static, auth routes are dynamic.
No second deployment, no subdomain split.** This is the standard App Router
model and it is what backend.md assumed.

### On "CSR for the other pages"

Worth separating two things, because you get a better outcome than the one you
asked for:

- **Client-side rendering the dashboard** would mean shipping an empty HTML
  shell and fetching auth state in the browser. That is the only option *if*
  you keep `output: "export"` — but it cannot give you `app/api/*` route
  handlers at all, so the Electron app and every other backend endpoint in
  backend.md would still need to live somewhere else. It defers the problem
  rather than solving it.
- **Per-route dynamic rendering** (above) keeps the marketing site static
  *and* lets the dashboard check the session on the server before a single
  byte reaches the browser — no flash of signed-out UI, no client round trip.

Recommend per-route dynamic. Individual pieces of the dashboard can still be
client components where interactivity calls for it; that is an independent
choice from how the route is rendered.

### Keeping marketing static is easier with Better Auth

A hosted SDK like Clerk wants a `<ClerkProvider>` in `app/layout.tsx`, wrapping
**every** page including the marketing ones. If that provider reads cookies
during render it opts the whole tree into dynamic rendering and silently turns
every `○` into `ƒ` — quietly undoing the thing you are trying to preserve.

Better Auth has no equivalent global React provider. Session reads are explicit
server-side calls inside the routes that actually need them, so nothing touches
the marketing tree by default. The risk is much lower, but still verify it: the
Phase 2 checkpoint diffs the build's static/dynamic markers against the Phase 0
baseline. If a marketing route does flip to `ƒ`, something is reading cookies
or headers higher up the tree than it should be.

---

## 1. Why Better Auth, and not Clerk

backend.md picks Clerk, with the reasoning "in TypeScript there is no Devise".
That was true when written, but it is worth revisiting precisely because auth is
the hardest dependency to swap out later.

**Better Auth** (MIT, `better-auth`, v1.6.26 at time of writing) is a
TypeScript auth *library* rather than a service. It runs inside this Next.js
app and stores users in **your** Postgres via an official Prisma adapter.

Why it fits this project specifically:

| Constraint from backend.md | Why Better Auth suits it |
|---|---|
| "One repo, one deployment" | A library, not a service. Nothing extra to deploy or monitor — unlike Keycloak, Ory, Zitadel, Logto or SuperTokens, which all need a separate server running alongside |
| Cloudflare Workers runtime | Workers-compatible; the ecosystem includes dedicated Cloudflare integrations |
| Prisma + Neon | Official Prisma adapter; its CLI generates the auth tables into your existing schema |
| Auth is hard to swap | **The user rows are already in your database.** Replacing the library later does not mean migrating accounts out of someone else's system |
| Enterprise tier (SSO, orgs) | Organizations, RBAC, and 2FA ship as first-party plugins |
| Electron app JWT flow | Bearer-token and API-key plugins cover the desktop client |
| Per-seat pricing at scale | No per-MAU cost. At ~100k MAU this is reportedly ~$24k/year cheaper than Clerk |

### What you give up

Self-hosting auth means owning the operational surface. Be honest about this
before committing:

- **No drop-in hosted UI.** Clerk gives you `<SignIn />` and a styled flow for
  free. With Better Auth you build the sign-in and sign-up forms yourself. For
  this project that is arguably a plus — the forms will match the site's design
  system rather than fighting it — but it is real work that Phase 4 now carries.
- **Email deliverability is yours.** Verification and password-reset emails need
  a real sender. backend.md already picked Resend, so this is planned work
  rather than new work, but it is now on the critical path for signup.
- **Rate limiting and brute-force protection are yours** to configure.
- **Security patching is yours.** A CVE in the library is your upgrade to apply,
  not a vendor's to silently fix.
- **Younger project.** Better Auth launched in 2024 and hit v1.6 in May 2026.
  Clerk has more production years behind it.

### Alternatives considered

- **Auth.js / NextAuth** — free and self-hosted, with a mature Prisma adapter.
  But the stable npm release is still `4.24.x`; v5, which is the App
  Router-native rewrite, has been in pre-release for an extended period. Fine
  choice, less pleasant ergonomics than Better Auth for a greenfield build.
- **Keycloak, Ory, Zitadel, Logto, SuperTokens** — all genuinely open source and
  self-hostable, and all require running a separate service (usually a JVM or Go
  process plus its own database). That directly contradicts the one-deployment
  architecture, and this machine has no container runtime to run one locally.
  Ruled out on architecture, not on quality.
- **Supabase Auth** — open source, but pulls in the Supabase platform and
  conflicts with the Neon choice already made.

**If you would rather stay with Clerk**, the phases below still apply; only
Phase 2 and Phase 3 change materially. Say so and this document can be
reverted to the Clerk version.

---

## 2. Prerequisites

### Accounts to create

- **Neon** — the Postgres host (backend.md's choice). Free tier is sufficient.

That is the whole list. Better Auth is a library, not a service, so there is no
auth vendor to sign up with and no API keys to provision — a meaningful part of
why it was chosen. See [Why Better Auth](#why-better-auth-and-not-clerk).

### Local tooling note

This machine has no Docker, no Podman, and no local Postgres install, so
"run Postgres in a container" is not available without setup work.

**Recommendation: use a Neon database for local development too**, rather than
installing Postgres locally. Reasons:

- Zero local install; a connection string is all that is needed.
- Development uses the same database engine and driver path as production,
  which removes an entire class of "worked locally, broke on Cloudflare" bugs.
- Neon branches let you throw away and recreate a dev database cheaply.

Use a dedicated Neon **branch** for local dev so migrations run against
something disposable rather than against what will become production data.

If a fully offline loop is important, the alternative is
`sudo apt install postgresql` and a local connection string. The plan works
either way — only `DATABASE_URL` changes.

---

## 3. Phases

### Phase 0 — Unblock the config

- [ ] Remove `output: "export"` from `next.config.ts`.
- [ ] Remove `images.unoptimized` **only if** you want the image optimizer back;
      leaving it set is harmless and avoids a visual change. Prefer leaving it
      for now — one change at a time.
- [ ] Confirm `npm run dev` still boots and the marketing pages render.
- [ ] Confirm `npm run build` still succeeds. Note that the build output moves
      from `out/` to `.next/` — **`wrangler.jsonc` now points at a directory
      that will no longer be produced.** Leave it broken for now and fix it in
      the deployment follow-up, but be aware `npm run deploy` is unsafe until
      then.
- [ ] **Diff the route markers against the baseline below.** Every row must
      still be `○` or `●`. A row flipping to `ƒ` at this stage means something
      opted into dynamic rendering unintentionally, and it is far cheaper to
      find now than after auth is layered on top.

Baseline captured from `npm run build` before any of this work:

```
┌ ○ /                  ├ ○ /faq
├ ○ /_not-found        ├ ○ /figma-alternative
├ ○ /about             ├ ○ /for-teams
├ ○ /alternatives      ├ ○ /pricing
├ ○ /changelog         ├ ○ /roadmap
├ ○ /docs              ├ ○ /robots.txt
├ ● /docs/[slug]       ├ ○ /sitemap.xml
│   (33 paths)         └ ○ /trust
```

`○` Static · `●` SSG · `ƒ` Dynamic
- [ ] Sanity check that `scripts/build-dither-snapshots.mjs` is unaffected. It
      reads CSS modules and writes to `public/`, so it should be, but the
      `predev`/`prebuild` chain runs on every dev boot.

**Checkpoint:** the site runs in dev exactly as before, with no static-export
restriction.

### Phase 1 — Postgres + Prisma

- [ ] Create the Neon project and a `dev` branch. Copy the connection string.
- [ ] Add `DATABASE_URL` to `.env.local`. Confirm `.env.local` is gitignored
      before pasting a real credential into it.
- [ ] Install Prisma: `npm i -D prisma` and `npm i @prisma/client`.
- [ ] `npx prisma init` — this creates `prisma/schema.prisma`.
- [ ] Create `lib/prisma.ts` with a singleton client. In development Next.js
      hot-reloads modules, and a naive `new PrismaClient()` per reload will
      exhaust the connection pool — cache it on `globalThis`.
- [ ] **Do not hand-write the auth models.** Better Auth's CLI generates them
      (`user`, `session`, `account`, `verification`) into `schema.prisma` in
      Phase 2. Leave the schema empty for now beyond the datasource and
      generator blocks.
- [ ] Confirm the connection works: `npx prisma db pull` should succeed against
      an empty database without erroring on credentials.

Application models such as `Project` and `Share` will live alongside the
generated auth models in the same schema and the same database — that is the
point. The `user` table is yours, not a mirror of somebody else's.

**Note on the Neon driver adapter:** backend.md specifies
`@prisma/adapter-neon` because the Cloudflare Workers runtime cannot use
Prisma's default engine. That adapter is **not required for local `next dev`**,
which runs in Node. Write `lib/prisma.ts` so the adapter can be swapped in by
environment rather than hardcoding either path, and defer the Workers wiring to
the deployment follow-up. Getting this wrong is a deploy-time problem, not a
local one — do not let it block this phase.

**Checkpoint:** Prisma connects to Neon and `npx prisma studio` opens against an empty database.

### Phase 2 — Better Auth

> **Verify every API name below against the current Better Auth docs.** The
> shape of the setup is stable, but exact import paths, CLI invocations, and
> option names move between minor versions, and this plan was written against
> documentation rather than a working install. Treat the code sketches as the
> architecture, not as copy-paste.

- [ ] `npm i better-auth`.
- [ ] Generate a server secret and add `BETTER_AUTH_SECRET` and
      `BETTER_AUTH_URL=http://localhost:3000` to `.env.local`.
- [ ] Create `lib/auth.ts` — the server instance, wired to Prisma:

```ts
// shape only — confirm import paths against the current docs
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
});
```

- [ ] Run Better Auth's CLI generator to write the auth models into
      `prisma/schema.prisma`, then `npx prisma migrate dev --name auth`.
- [ ] Mount the handler at `app/api/auth/[...all]/route.ts`. **This is the first
      route handler in the codebase** — it is what `output: "export"` made
      impossible, so its existence is itself the proof that Phase 0 worked.
- [ ] Create `lib/auth-client.ts` for the browser-side helpers used by the forms.

**On `proxy.ts` / middleware:** Better Auth reads sessions in server components
and route handlers, so a proxy file is *optional* — route protection can live in
the page itself. Prefer that for this phase: fewer moving parts, and it sidesteps
the Next 16 rename entirely. Keep the note below for when a proxy is genuinely
wanted.

> ### ⚠️ Next 16 renamed `middleware.ts` to `proxy.ts`
>
> Most auth tutorials will tell you to create `middleware.ts`. In Next 16 that
> file convention is **deprecated and renamed to `proxy`**, confirmed in
> `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`:
>
> > **Note**: The `middleware` file convention is deprecated and has been
> > renamed to `proxy`.
>
> Next ships a codemod for the migration. If a library's docs assume
> `middleware.ts` and it still works, use it and leave a TODO; otherwise
> `proxy.ts` exporting the same handler is the equivalent.
>
> This is exactly the class of problem `AGENTS.md` warns about — read the
> bundled Next docs before trusting any external tutorial.

**Checkpoint:** `npx prisma studio` shows the generated auth tables, and
`npm run build` still shows every marketing route as `○`/`●`, matching the
Phase 0 baseline. Only the new auth routes may be `ƒ`.

If a marketing route flipped to `ƒ`, stop and fix it here rather than pressing
on. The fix is route groups, so anything auth-aware is scoped away from the
marketing tree:

```
app/
  (marketing)/layout.tsx   ← / /pricing /docs … stay static
  (app)/layout.tsx         ← /dashboard, /sign-in, /sign-up
```

Route groups do not affect URLs, so no public path changes.

### Phase 3 — Session helper

Much smaller than it would be with a hosted provider. There is no external user
id to reconcile and no webhook to sync, because Better Auth writes to the same
database Prisma already owns — signup *is* the database write.

- [ ] Write a `getCurrentUser()` helper that reads the session server-side,
      roughly `auth.api.getSession({ headers: await headers() })`, and returns
      the user or `null`.
- [ ] Have it return the Prisma row so downstream code has the full record to
      join `Project` and `Share` to later.

**What this replaces:** with Clerk this phase was a `clerkId` join column plus a
lazy upsert, plus eventual webhooks to propagate deletions and email changes.
None of that exists here. That deleted complexity is the concrete form of "auth
is the hardest dependency to swap out" — there is simply no second system to
keep in sync.

**Checkpoint:** the helper returns a real user object after signing in.

### Phase 4 — The success page

- [ ] Build `/sign-up` and `/sign-in` forms as client components calling the
      auth client. **This is the work Clerk would have given you for free** —
      budget for it. Keep them deliberately plain for now; styling to match the
      design system is a follow-up, not part of proving the flow.
- [ ] Create `app/dashboard/page.tsx` (or `/account` — naming is yours) as a
      server component.
- [ ] Redirect unauthenticated visitors to `/sign-in`.
- [ ] For authenticated visitors, call `getCurrentUser()` and render the success
      state: "Signed in as {email}" plus the database row's `id` and
      `createdAt`. Reading those straight from Postgres proves the ORM, the
      database, and the session in one glance.
- [ ] Add a sign-out control.

**Checkpoint:** the full definition of done at the top of this document.

---

## 4. Verification script

Run through this by hand. It is the acceptance test for the phase.

1. `npm run dev`, open `http://localhost:3000/dashboard` while signed out
   → redirected to `/sign-in`.
2. Go to `/sign-up` and create an account. Email verification is **off** for
   this phase — turn it on once Resend is wired up, otherwise signup blocks on
   an email that never arrives.
3. After verification → land on `/dashboard`, see the success message with the
   email and the database row id.
4. `npx prisma studio` → exactly one row in the `user` table, plus a matching `session` row.
5. Sign out → `/dashboard` redirects to `/sign-in` again.
6. Sign back in with the same credentials → same `user` row, **no duplicate**,
   and a second `session` row.
7. Restart `npm run dev` → still signed in (session persisted in a cookie).

---

## 5. Repo-specific gotchas

- **`predev` runs three build scripts.** `npm run dev` triggers
  `build-changelog`, `build-docs`, and the dither snapshots. If auth work
  breaks one of them, dev will not boot at all — the failure will look
  unrelated to auth.
- **`allowedDevOrigins` is already configured** for LAN testing. Sessions are
  cookie-based, and `BETTER_AUTH_URL` must match the origin the browser actually
  used — a LAN IP will not match `http://localhost:3000`. **Test on `localhost`
  first**, and treat phone-on-LAN testing as a separate question.
- **`app/layout.tsx` is shared with the marketing site.** Anything auth-aware
  added there affects public pages. Better Auth needs nothing in the root
  layout, so keep it that way.
- **`lib/site.ts` holds shared config.** New public URLs (sign-in, dashboard)
  belong there rather than being hardcoded, matching the existing pattern.
- **Environment variables.** `.env.local` for local; Cloudflare dashboard for
  production. Never commit either. `BETTER_AUTH_SECRET` is a server secret and
  must never be prefixed `NEXT_PUBLIC_` or it will be bundled into client JS.

---

## 6. Out of scope

Named explicitly so the phase does not creep:

- Stripe, subscriptions, and the Pro tier gate
- Cloudflare R2, file sync, previews, hosting
- Inngest and any background job
- The Electron `scamp://` OAuth callback
- OAuth providers (GitHub, Google)
- Email verification and password reset (needs Resend)
- Rate limiting and brute-force hardening
- Any `Project`, `Share`, `Comment`, or `Snapshot` model
- **Production deployment** — see the follow-up below

---

## 7. Required follow-up before any deploy

Phase 0 breaks production deployment. This is not optional cleanup:

### ⚠️ `npm run deploy` currently succeeds and publishes the wrong thing

This is worse than failing. `next build` now writes `.next/`, but `out/` still
exists from the last static-export build and `wrangler.jsonc` still points at
it. So `npm run deploy` runs, reports success, and publishes a stale snapshot —
no auth, none of the current work. Delete `out/` so it fails loudly instead.

### Repo changes — DONE ✅

Completed. `npx opennextjs-cloudflare build` produces a Worker bundle
(`.open-next/worker.js`, 53 MB of output) and the local dev auth flow still
passes end to end afterwards.

Four things came up that the plan had not anticipated:

**1. Next had to be upgraded.** `@opennextjs/cloudflare@1.20.2` requires
`next >=15.5.21 <16 || >=16.2.11`. The project was on `16.2.3`, which sits in
the explicitly excluded gap — those versions are known-incompatible, so
`--force` was not an option. Upgraded to `16.2.12`, the smallest bump that
satisfies it. Build, route markers, and the auth flow were all re-verified
afterwards.

**2. `opennextjs-cloudflare migrate` refuses to run alongside an existing
wrangler config**, since that implies a static site. The old `wrangler.jsonc`
was deleted and the command regenerated it — importantly preserving
`name: "scamp-website"`, so the existing domain binding is not orphaned.

**3. node-postgres cannot be in the Worker build.** `pg` requires
`pg-cloudflare`, whose `workerd` export condition Next's file tracer does not
follow, so the traced copy arrives without its `dist/` and esbuild fails to
resolve it. Fixed with `outputFileTracingIncludes` in `next.config.ts`.
Two other approaches were tried and rejected: `serverExternalPackages` makes
Turbopack emit a hash-suffixed specifier (`@prisma/adapter-pg-994324666b79ccf3`)
that esbuild cannot resolve, and hiding the specifier behind a variable to
defeat static analysis produced the same mangling.

**4. The migrate command duplicated an existing rule in `public/_headers`** and
appended a bare `import(...)` after `export default` in `next.config.ts`. Both
cleaned up.

### Remaining repo changes

- **Incremental cache is not configured.** `open-next.config.ts` still has
  `incrementalCache` commented out, and the migrate command warned about it.
  Without it, prerendered pages have no durable cache backing in production.
  Enable `r2IncrementalCache` and add the R2 bucket binding before deploying —
  see https://opennext.js.org/cloudflare/caching
- **Neon.** Provision the production database and run `prisma migrate deploy`
  against it. Local migrations were applied to the `prisma dev` server only, so
  production currently has no tables.
- **Verify the Neon adapter actually works on Workers.** `lib/prisma.ts`
  branches to `@prisma/adapter-neon` when `navigator.userAgent` is
  `Cloudflare-Workers`. That branch has never executed — there is no Neon
  database to point it at yet. It is the highest-risk untested piece.

### Cloudflare settings

- **Three secrets**, set as encrypted secrets rather than plaintext `vars` in
  the committed `wrangler.jsonc`:
  ```
  npx wrangler secret put DATABASE_URL
  npx wrangler secret put BETTER_AUTH_SECRET
  npx wrangler secret put BETTER_AUTH_URL   # production origin, not localhost
  ```
  Generate a **new** `BETTER_AUTH_SECRET` for production — do not reuse the
  local one.
- **Custom domain / route.** The current config has no `routes` key, so confirm
  how `scampdesign.app` is attached before switching from an assets-only
  deployment to a Worker.

Track this as its own phase.

---

## 8. Open questions

- ~~**Does the Cloudflare adapter serve prerendered pages without invoking the
  Worker?**~~ **Answered by inspecting a real build: no, not the HTML.**
  Cloudflare's guide says prerendered pages are served from the `ASSETS`
  binding, but the actual `.open-next/` output tells a different story:

  | Output | Where it lands | Worker invoked? |
  |---|---|---|
  | `/_next/static/*` JS + CSS (69 files) | `.open-next/assets` | no |
  | `/dither/*.webp`, images, `llms.txt` | `.open-next/assets` | no |
  | **Prerendered HTML** (51 pages) | `.open-next/cache/*.cache` | **yes** |

  There are zero `.html` files in the assets directory. Prerendered pages are
  stored as incremental-cache entries that the Worker reads and serves. So
  every page request bills a Worker invocation, including `/` and `/pricing`.
  Static sub-resources are still free CDN hits, which is most of the bytes but
  not the request count.

  This does not change the architecture — the `○`/`ƒ` split still matters, since
  a static page is a cheap cache read rather than a full React render — but the
  "marketing pages cost nothing" assumption was wrong. Budget for a Worker
  request per pageview.
- **Should route groups be adopted up front?** Splitting `app/(marketing)` and
  `app/(app)` in Phase 0, before auth is added, guarantees the static/dynamic
  boundary rather than verifying it after the fact. Cost is one extra layout
  file and moving existing route folders. yes
- **backend.md still says Clerk.** That document is your strategy notes, so it
  has been left alone — but its Auth row and its "Why Clerk over building auth"
  section now contradict this plan. Worth reconciling before it misleads
  someone later. weve decided to go with better auth so you can update any docs to match
- **Email verification on signup** — deferred here to keep the loop local. It
  needs Resend, which is already in backend.md. Decide whether the real product
  requires verification before first use or defers it. we definitely will need to set this up before 
- **OAuth providers.** backend.md wants GitHub and Google. Better Auth supports
  both; they were left out of this phase only to avoid redirect-URL setup. we will have to work on these as a follow up story.
