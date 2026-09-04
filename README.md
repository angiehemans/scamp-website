# Scamp website

Marketing site, documentation, and the cloud API for [Scamp](https://www.scamp.club)
— a local-first design tool that saves your work as real TSX and CSS.

Next.js 16 (App Router) on Cloudflare Workers, with Postgres via Prisma and
Better Auth. One codebase serves three things:

| | Routes | Rendering |
|---|---|---|
| Marketing + docs | `app/(marketing)/` | prerendered static |
| Cloud app | `app/(app)/` | dynamic |
| API | `app/api/` | dynamic |

---

## Quick start

Requires **Node 20+** (developed on 24). No Docker, no cloud account.

```bash
npm install
npx prisma dev -n scamp -d      # local Postgres, ships with Prisma 7
npx prisma dev ls               # copy the DATABASE_URL it prints
cp .env.example .env            # paste it in, plus a generated auth secret
npm run dev
```

Then <http://localhost:3000>.

`npm run dev` regenerates the changelog, the docs index, and the Prisma client
first, so a fresh clone works without extra steps.

**Email is optional locally.** With no `RESEND_API_KEY`, verification emails are
printed to the dev console — link included — so the whole sign-up flow is
testable offline.

**To see `/admin`**, put your own address in `ADMIN_EMAILS` and verify the
account. Unset means nobody, including locally — a missing value must never be
the thing that opens the page up. `node scripts/verify-existing-users.mjs` marks
local accounts verified if you would rather not click the link.

**To use cloud backup**, switch Scamp Cloud on from the dashboard. Only admin
accounts can, and only for themselves — there is no billing yet, so this is how
the operator uses the product without a payment plan. Every `/api/projects/*`
call is a `402` until it is on.

Those same addresses get an email on every new sign-up **and every download**,
printed to the console locally like the verification email. Neither can fail the
thing it reports on — look for `[signup-notify]` and `[after-response]` in the
log.

The person who downloaded also gets a thank-you from `angie@scamp.club`, on
their **first** download only.

---

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build (also prints the `○ ● ƒ` route table) |
| `npm run preview` | Build and run the **real Worker** locally in workerd |
| `npm run deploy` | Build and deploy to Cloudflare |
| `npm run db:status` | Pending migrations (add `-- --prod` for production) |
| `npm run db:deploy` | Apply migrations (add `-- --prod`) |
| `npm run db:studio` | Browse the database |
| `npm run build:dither` | Regenerate the Safari gradient snapshots |
| `npm run format` | Prettier |

### `npm run dev` vs `npm run preview`

`dev` runs in **Node**. `preview` runs the actual Worker in **workerd**, with
the same restrictions as production — no TCP sockets, no runtime WebAssembly
compilation, per-request I/O isolation.

Several bugs are invisible under `dev` and obvious under `preview`. If something
works locally and breaks on Cloudflare, reach for `preview` before deploying
again. It reads secrets from `.dev.vars`, not `.env`.

---

## Database

Two environments, and the split is deliberate:

- **`.env`** — the local throwaway database. The dev server and every
  checkpoint script read it, and several of those **delete users** as cleanup.
- **`.env.production.local`** — Neon. Read only when you pass `--prod`.

```bash
npm run db:status               # local
npm run db:status -- --prod     # production
npm run db:deploy -- --prod     # apply migrations to production
```

Each run prints the host it is about to touch and refuses if the flag and the
URL disagree in either direction, so the test suite can never be pointed at
production by accident.

### Changing the schema

```bash
npx prisma migrate dev --name what_changed
```

⚠️ **After running `npx @better-auth/cli generate`, check
`prisma/schema.prisma`.** It overwrites the file and strips
`runtime = "workerd"` from the generator block. Without that line, every
database query on Cloudflare fails with a WebAssembly `CompileError`. The schema
carries a comment saying so.

---

## Testing

There is no unit test suite. Instead, scripts exercise the real HTTP API against
a running dev server and assert on actual behaviour:

```bash
npm run dev            # in one terminal, then:

node scripts/check-blob-store.mjs    # storage round-trips byte-identically
node scripts/check-projects.mjs      # ownership and isolation
node scripts/check-push.mjs          # ignore rules and deduplication
node scripts/check-pull.mjs          # restore, past versions, resumability
node scripts/check-signup-ui.mjs     # sign-up form in a real browser
node scripts/check-releases.mjs      # installer downloads and staging
node scripts/check-purchase.mjs      # pay-what-you-want claim and its limits
node scripts/check-guest-download.mjs # the public /download flow
node scripts/check-desktop-auth.mjs  # Electron sign-in handoff (PKCE)
node scripts/check-api-docs.mjs      # api-docs/ still describes reality
```

They create real accounts and clean up after themselves.

The admin page needs a throwaway address on the allowlist, so pass the same
override to both the server and the script — dotenv leaves an already-set
variable alone, so the inline value wins over `.env`:

```bash
ADMIN_EMAILS="admin-check@example.com" npm run dev
ADMIN_EMAILS="admin-check@example.com" node scripts/check-admin.mjs
```

It refuses to run unless that address ends in `@example.com`, so it can never
sign up as — or delete — a real admin.

**If every route under `/api/projects/[id]/…` suddenly 404s with an HTML body,
the dev cache is stale, not the code.** Stop the server, `rm -rf .next`, start
it again. The route handlers are fine; Turbopack just stopped seeing them.

`scripts/fake-client.mjs` is the reference implementation of the backup
protocol, and what the Electron client should be modelled on:

```bash
node scripts/fake-client.mjs scan ./some-project      # what would sync
node scripts/fake-client.mjs push ./some-project --project <id>
node scripts/fake-client.mjs pull ./restored --project <id>
```

---

## Publishing a release

Installers are self-hosted in R2 and served to signed-in users through
`/api/download/<platform>`. Getting a build online is two steps, deliberately:

```bash
# 1. upload — stages it, does NOT make it live
node scripts/publish-release.mjs --version 0.6.0 --dir ./builds --prod

# 2. go live, once you have checked it
node scripts/publish-release.mjs --version 0.6.0 --publish --prod
```

`--dir` needs one installer per platform, matched by extension (`.dmg` → macOS,
`.exe` → Windows, `.AppImage` → Linux). To pull them from the desktop app's
GitHub releases:

```bash
gh release download v0.6.0 --repo angiehemans/scamp \
  --pattern '*.dmg' --pattern '*.exe' --pattern '*.AppImage' --dir ./builds
```

### Testing the flow locally

`publish-release.mjs` needs R2's S3 credentials, which do not exist in
development — miniflare emulates the R2 binding, not the S3 endpoint. Use the
local seeder instead:

```bash
node scripts/seed-release.mjs                    # placeholder installers
node scripts/seed-release.mjs --dir ./builds     # real ones, to test a big download
node scripts/seed-release.mjs --clear            # remove them again
```

The pay-what-you-want prompt is shown once per account, so to see it a second
time:

```bash
node scripts/reset-purchase.mjs you@example.com
```

Both refuse to run unless `DATABASE_URL` is local.

A release with `publishedAt = null` is invisible everywhere — no download, no
dashboard entry — so a dropped upload on a 100 MB file can never be served
half-finished. Uploads go through S3 multipart because `wrangler r2 object put`
caps at 300 MiB.

---

## Layout

```
app/(marketing)/   public pages — must stay static, never read cookies
app/(app)/         sign-in, sign-up, dashboard — dynamic, noindex
app/api/           auth, projects, backup
components/        shared UI
content/           docs and changelog markdown, compiled at build time
lib/               auth, prisma, blob storage, email, schema helpers
prisma/            schema and migrations
scripts/           build steps, checkpoints, reference client
public/dither/     prerendered gradient snapshots for Safari
api-docs/          API reference and the deployment runbook
plans/             design docs, written before the code
```

The **route groups are load-bearing**. Anything in `app/(marketing)/` that reads
cookies, headers, or the session turns the whole public site dynamic. Check the
`○ ● ƒ` markers in the build output if you are unsure.

---

## Documentation

| | |
|---|---|
| [api-docs/](./api-docs/) | API reference — auth, projects, the backup protocol |
| [api-docs/deployment.md](./api-docs/deployment.md) | **Deployment runbook** — Neon, R2, secrets, DNS |
| [plans/](./plans/) | Design decisions and their reasoning |

Start with [api-docs/conventions.md](./api-docs/conventions.md) before touching
the API — two of the conventions there will otherwise cost you an afternoon.

---

## Things that will bite you

Hard-won, each one having cost real debugging time:

- **Every API request needs an `Origin` header** matching `BETTER_AUTH_URL`.
  `curl` sends none and is allowed; Node's `fetch` sends a null one and is
  rejected. Identical-looking code, different result.
- **`runtime = "workerd"` in `prisma/schema.prisma`** must survive any Better
  Auth CLI run. See above.
- **SVG backgrounds need explicit `width`/`height`/`viewBox`.** WebKit paints
  nothing without intrinsic dimensions — it has caused two separate
  Safari-only bugs here.
- **`DATABASE_URL` is needed at build time**, not just at runtime. Worker
  secrets are runtime-only, so CI needs it in the build environment too.
- **Never export a module-scoped Prisma or auth client.** Use `getPrisma()` and
  `getAuth()`. On Workers an I/O object cannot cross requests, so a cached
  client fails from the second request an isolate serves. The HTTP driver looks
  like an easier fix and is not — it cannot open transactions.
- **Dither gradients need a `position: relative` parent** and content lifted to
  `z-index: 1`, or they escape and cover the viewport.
