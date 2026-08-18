# Deployment runbook

Everything that has to be done **by hand** — accounts, dashboards, credentials —
to get this API from a laptop to production. The code side is finished; what is
left is provisioning and configuration.

> **Nothing has been deployed yet.** The presigned-URL upload path and the Neon
> database adapter have **never executed**, because there has never been an R2
> bucket or a Neon database to point them at. Expect the first deploy to surface
> problems in exactly those two places, and read
> [After the first deploy](#7-after-the-first-deploy-verify-these-specifically).

Rough order, top to bottom. **Start with [step 0.5](#05-deploy-method--check-this-before-pushing)** — if
Cloudflare is connected to GitHub, pushing this branch will trigger a build
before you are ready. Steps 1–5 are required; 6 is recommended; 9 is what still
is not solved.

---

## 0. Before you start

Two things about this deploy are unusual and worth knowing up front.

**The site currently deploys as static assets with no Worker.** `wrangler.jsonc`
used to point at `out/`, and every page was a plain CDN file. This deploy puts a
Worker in the request path for the first time. The marketing and docs pages are
still prerendered — they have not become server-rendered — but they are now
served *by* the Worker rather than straight from the edge. Ten routes genuinely
need the Worker:

```
ƒ /api/auth/[...all]          ƒ /api/projects/[id]/manifest
ƒ /api/blobs/direct           ƒ /api/projects/[id]/pull/urls
ƒ /api/projects               ƒ /api/projects/[id]/push/commit
ƒ /api/projects/[id]          ƒ /api/projects/[id]/push/prepare
ƒ /dashboard                  ƒ /api/projects/[id]/versions
```

**There is no rollback to the old setup once the domain is switched**, short of
reverting the repo and redeploying. Consider deploying to the `workers.dev`
subdomain first and only attaching the custom domain once step 7 passes.

---

## 0.5 Deploy method — check this before pushing

**Nothing in this repository deploys on push.** There are no GitHub Actions
workflows, and the deploy script has always been a manual command
(`wrangler deploy`, now `opennextjs-cloudflare deploy`).

But Cloudflare can be connected to a GitHub repo **from its own side**, in the
dashboard rather than in the repo. If that connection exists, a push to `main`
triggers a build there and this repo gives no sign of it.

### Check whether it exists

```bash
npx wrangler deployments list
```

The source of each deployment distinguishes a `wrangler` upload from a
git-triggered build. Or in the dashboard: **Workers & Pages → `scamp-website` →
Settings**, and look for Build / Git integration.

### If it is connected

Pushing this branch will **most likely fail the build**, because the build now
requires `DATABASE_URL` and Cloudflare's build environment will not have it. A
failed build leaves the currently deployed site running, so this is a safe
failure — but an alarming one if it is unexpected.

Two other things would also be stale in that build configuration:

- **The build command.** The old one produced `out/`. The new pipeline is
  `opennextjs-cloudflare build`, producing `.open-next/`. A Pages project with
  an output directory of `out` will find nothing.
- **Build environment variables.** `DATABASE_URL` has to be set as a *build*
  variable, not just a Worker secret. See [step 3](#3-worker-secrets).

### Recommended: deploy manually for the first release

For a first deploy with two never-executed code paths and a deliberately quiet
launch, manual is the right call — you decide exactly when production changes,
and a stray push cannot ship a half-configured backend.

1. **Pause or disconnect the git integration** in the Cloudflare dashboard
   before pushing these changes. On Workers Builds this is a toggle in the
   build settings; on Pages it is under the project's Git settings.
2. Deploy with `npm run deploy` from your machine.
3. Verify against [step 7](#7-after-the-first-deploy-verify-these-specifically).

### Reconnecting later

Once the deploy is proven, reconnecting is worthwhile — manual deploys from one
laptop are not a long-term answer. To do it, the Cloudflare build config needs:

| Setting | Value |
|---|---|
| Build command | `npm run deploy` (it builds *and* deploys) |
| Build environment variables | `DATABASE_URL`, plus anything else the build reads |
| Deploy command | none, if the build command already deploys |

The Worker secrets from step 3 are separate and stay as they are — they are
runtime values and are not visible to the build.

A safer middle ground: connect the integration to a **non-production branch**
first, confirm a green build, then point it at `main`.

---

## 1. Neon — the database

1. Create a Neon project. Region: pick the one closest to most users; Cloudflare
   Workers run everywhere, so the database location is what sets latency.
2. Create a database inside it (the default is fine).
3. Copy the **pooled** connection string. It looks like:
   ```
   postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require
   ```
   Use the pooled one — a Worker can open many short-lived connections, and the
   unpooled endpoint will exhaust them.
4. Keep the branch structure simple to start: one `main` branch. Neon branches
   are useful later for staging.

**Then run the migrations.** They have only ever been applied to a local
throwaway database, so production has no tables at all:

```bash
DATABASE_URL="<neon pooled url>" npx prisma migrate deploy
```

`migrate deploy` applies existing migrations and never generates new ones, which
is what you want against production. It does not need a shadow database.

Verify:

```bash
DATABASE_URL="<neon pooled url>" npx prisma migrate status
```

You should see 2 migrations applied, and these 7 tables: `user`, `session`,
`account`, `verification`, `Project`, `ProjectVersion`, `Blob`.

---

## 2. Cloudflare R2 — file storage

### Create the bucket

In the Cloudflare dashboard, **R2 → Create bucket**, named exactly:

```
scamp-project-blobs
```

This name is already in `wrangler.jsonc`. If you use a different one, change it
there too.

`wrangler.jsonc` also references `scamp-project-blobs-preview`. That is only
used by `wrangler dev --remote`; local development uses an emulated bucket and
needs nothing. Create it only if you want remote preview.

### Create the API token

The Worker binding is not enough. Generating presigned upload URLs requires
S3-compatible credentials, which are separate.

**R2 → Manage API tokens → Create API token**

- Permission: **Object Read & Write**
- Scope it to the `scamp-project-blobs` bucket, not the whole account
- Save the **Access Key ID** and **Secret Access Key** — the secret is shown
  once

You also need your **Cloudflare Account ID**, on the right of the dashboard
overview or in the R2 page URL.

### Why both a binding and a token

The binding (`BLOBS`) lets the Worker read and write objects directly. The token
lets it *sign URLs* that the desktop client uses to upload straight to R2
without the bytes passing through the Worker. Uploads are potentially hundreds
of MB, and a Worker isolate has 128 MB of memory — routing them through it is
not viable.

**If the token variables are missing, nothing errors.** `lib/blob-store.ts`
silently falls back to routing uploads through the Worker, which works and will
seem fine right up until someone uploads a large image. Step 7 has a check for
this.

---

## 3. Worker secrets

Seven values. All are secrets except arguably the two non-sensitive R2 ones —
set them all as secrets for simplicity:

```bash
npx wrangler secret put DATABASE_URL           # Neon pooled connection string
npx wrangler secret put BETTER_AUTH_SECRET     # generate fresh, see below
npx wrangler secret put BETTER_AUTH_URL        # https://scampdesign.app
npx wrangler secret put R2_ACCOUNT_ID          # Cloudflare account id
npx wrangler secret put R2_BUCKET_NAME         # scamp-project-blobs
npx wrangler secret put R2_ACCESS_KEY_ID       # from the R2 API token
npx wrangler secret put R2_SECRET_ACCESS_KEY   # from the R2 API token
```

Generate a **new** auth secret for production. Do not reuse the local one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Two things that will bite:

- **`BETTER_AUTH_URL` must exactly match the origin browsers use**, including
  scheme and any `www`. A mismatch produces `403 MISSING_OR_NULL_ORIGIN` on
  every authenticated request, which looks like a broken deploy rather than a
  config typo.
- **`BETTER_AUTH_SECRET` invalidates every session when changed.** Changing it
  later signs everyone out.

### DATABASE_URL is also needed at *build* time

This is the trap most likely to waste an afternoon. The build imports the API
route modules while collecting page data, and `lib/prisma.ts` throws on import
if `DATABASE_URL` is unset:

```
Error: DATABASE_URL is not set...
> Build error occurred
Error: Failed to collect page data for /api/projects/[id]
```

Worker secrets are **runtime only**. If you build in CI, `DATABASE_URL` has to
be in the build environment as well. Building locally is fine because `.env`
supplies it.

---

## 4. Custom domain

`wrangler.jsonc` has no `routes` key, so the current deployment's domain is
attached through the dashboard. Before deploying, check how `scampdesign.app`
is currently bound — as a **Workers custom domain**, a **route**, or via
**Pages** — because the assets-only Worker is being replaced by a full one and
that binding has to survive.

The Worker name (`scamp-website`) is unchanged, which is deliberate: a rename
would create a second Worker and orphan the domain.

Also confirm `preview.scampdesign.app` is not needed yet — it appears in
`plans/backend.md` for hosted previews, which are not built.

---

## 5. Deploy

```bash
npm run deploy
```

This runs the generation scripts, `opennextjs-cloudflare build`, then
`opennextjs-cloudflare deploy`.

### The first deploy may fail on the self-reference

`wrangler.jsonc` contains a service binding pointing the Worker at itself:

```jsonc
"services": [{ "binding": "WORKER_SELF_REFERENCE", "service": "scamp-website" }]
```

On a brand-new Worker this can fail, because the service it references does not
exist until the first successful deploy. If that happens: comment the `services`
block out, deploy, uncomment it, deploy again. It is only needed for cache
revalidation.

---

## 6. Incremental cache — recommended, not required

`open-next.config.ts` still has `incrementalCache` commented out, and the
OpenNext migration tool warned about it.

**This app has no time-based revalidation** — no `export const revalidate`, no
`revalidateTag`, no `unstable_cache` anywhere — so it will function without it.
What you lose is a durable cache for prerendered pages across Worker isolates.

To enable it, create a second R2 bucket (e.g. `scamp-next-cache`), add the
binding — **the name is fixed and must be exactly this**:

```jsonc
"r2_buckets": [
  { "binding": "BLOBS", "bucket_name": "scamp-project-blobs" },
  { "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "scamp-next-cache" }
]
```

and uncomment the override in `open-next.config.ts`:

```ts
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default defineCloudflareConfig({ incrementalCache: r2IncrementalCache });
```

Keep this bucket separate from the blob bucket. Mixing user file content and
framework cache in one bucket makes "delete this user's data" much harder to
reason about.

---

## 7. After the first deploy: verify these specifically

Two code paths have **never run**. Do not assume they work.

### a. The Neon adapter

`lib/prisma.ts` switches from `@prisma/adapter-pg` to `@prisma/adapter-neon`
when it detects the Workers runtime, because Workers have no TCP sockets. That
branch has only ever been type-checked.

```bash
curl -i https://scampdesign.app/api/auth/get-session -H 'Origin: https://scampdesign.app'
```

`200` means the Worker booted. Then create an account through the UI — a
successful sign-up is the first real proof the database is reachable, since it
writes a row.

### b. Presigned R2 uploads

The `direct` field in a prepare response tells you which path is live:

```bash
# after signing in and creating a project
curl -X POST https://scampdesign.app/api/projects/<id>/push/prepare \
  -H 'Content-Type: application/json' -H 'Origin: https://scampdesign.app' \
  -b 'better-auth.session_token=...' \
  -d '{"manifest":{}}'
```

- `"direct": true` — presigned R2 URLs, correct
- `"direct": false` — **the R2 credentials are missing or wrong.** Uploads are
  being routed through the Worker. It will appear to work.

### c. A real round trip

The strongest check is the reference client against production:

```bash
export BASE_URL=https://scampdesign.app
export SCAMP_EMAIL=... SCAMP_PASSWORD=...

node scripts/fake-client.mjs push ./some-project --project <id>
node scripts/fake-client.mjs pull ./restored     --project <id>
diff -r ./some-project ./restored
```

### d. The marketing pages are unchanged

Load `/`, `/pricing`, `/docs`. They should be byte-identical to before. If they
render but look wrong, suspect the dither gradient assets under
`/dither/*.webp` — those are static files and should come from the assets
binding.

---

## 8. The cloud tier is hidden, deliberately

Nothing on the public site links to `/sign-in`, `/sign-up` or `/dashboard`. That
is not an accident of the build — it is the current intended state, so the cloud
features can be deployed and tested without announcing them.

Four surfaces were checked and are all clean: the nav, the footer, `sitemap.xml`,
and `llms.txt`. On top of that, `app/(app)/layout.tsx` sets
`robots: { index: false, follow: false }`, so the three routes render:

```html
<meta name="robots" content="noindex, nofollow, nocache"/>
```

while every marketing page still renders `index, follow`.

`noindex` was used rather than a `Disallow` in `robots.txt` because a disallowed
URL is never crawled, so the tag would never be read — and Google can still list
a disallowed URL it finds linked elsewhere, with no description. Allowing the
crawl and refusing the index is the reliable combination.

**The pages are reachable by anyone who knows the URL.** This is obscurity, not
access control. Anyone who visits `/sign-up` can create a real account and use
cloud backup for free, since `assertCanSync()` returns true for everyone. If the
deployment needs to be genuinely closed rather than quiet, options are an invite
code at sign-up, an allowlist of email addresses, or Cloudflare Access in front
of those paths.

**To launch publicly**, remove the `metadata` export from
`app/(app)/layout.tsx`, add the routes to `app/sitemap.ts`, and add whatever nav
entry the design calls for.

---

## 9. Known gaps — decide before real users

These are not blockers for deploying, but each is a real problem once people
sign up.

| Gap | Consequence | Where |
|---|---|---|
| **Rate limiting is in-memory** | Better Auth's default store does not work across Worker isolates, so brute-force protection on sign-in is effectively absent | `plans/auth-setup-phase-1.md` |
| **No email verification** | Anyone can register any address, including one they do not control. Needs Resend | `lib/auth.ts` |
| **No billing** | `assertCanSync()` returns `true` for everyone, so cloud backup is free to all signups | `lib/api-auth.ts` |
| **No storage quotas** | History is unlimited and nothing is ever deleted, so an account can grow without bound | `plans/cloud-backup.md` |
| **No password reset** | A locked-out user has no self-service path | — |

The first two are the ones I would not launch without — though a quiet
deploy with no public links reduces the urgency of both.

---

## Quick reference

| What | Where | Value |
|---|---|---|
| Database | Neon | pooled connection string |
| Blob storage | R2 bucket | `scamp-project-blobs` |
| Presigned URLs | R2 API token | Object Read & Write, bucket-scoped |
| Cache (optional) | R2 bucket | `scamp-next-cache`, binding `NEXT_INC_CACHE_R2_BUCKET` |
| Worker name | `wrangler.jsonc` | `scamp-website` — do not rename |
| Secrets | `wrangler secret put` | 7 values, see step 3 |
| Build-time env | CI | `DATABASE_URL` as well |
| Migrations | one-off | `prisma migrate deploy` |
| Deploy method | manual for now | `npm run deploy`; pause any Cloudflare git integration first |
