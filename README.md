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
node scripts/check-api-docs.mjs      # api-docs/ still describes reality
```

They create real accounts and clean up after themselves.

`scripts/fake-client.mjs` is the reference implementation of the backup
protocol, and what the Electron client should be modelled on:

```bash
node scripts/fake-client.mjs scan ./some-project      # what would sync
node scripts/fake-client.mjs push ./some-project --project <id>
node scripts/fake-client.mjs pull ./restored --project <id>
```

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
- **The Prisma client is module-scoped**, so on Workers it must use the HTTP
  driver. A pooled WebSocket cannot cross requests there.
- **Dither gradients need a `position: relative` parent** and content lifted to
  `z-index: 1`, or they escape and cover the viewport.
