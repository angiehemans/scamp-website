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
DATABASE_URL='postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/db?sslmode=require' npx prisma migrate deploy
```

**Single quotes, not double.** Neon passwords frequently contain `$`, and inside
double quotes the shell expands it — `p4ss$word` silently becomes `p4ss`, and you
get an authentication failure with no clue why. Single quotes keep the string
literal.

It is one command on one line. If you copy the block above out of a rendered
markdown view, make sure the word `bash` (the syntax-highlighting tag) does not
come with it: `bash DATABASE_URL=...` makes bash look for a script by that name
and reports `No such file or directory`.

`migrate deploy` applies existing migrations and never generates new ones, which
is what you want against production. It does not need a shadow database.

Verify:

```bash
DATABASE_URL='<same url>' npx prisma migrate status
```

You should see 3 migrations applied, and these 8 tables: `user`, `session`,
`account`, `verification`, `rateLimit`, `Project`, `ProjectVersion`, `Blob`.

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
set them all as secrets for simplicity.

### Do all seven at once (recommended)

`wrangler secret put` is **interactive** — it prompts for a value and reads
stdin. Do not paste seven of them into a terminal together: the second line
becomes the *value* of the first secret, the third becomes the value of the
second, and so on. Nothing warns you, and you end up with secrets containing
wrangler commands.

Use `secret bulk` instead. Write a temporary JSON file:

```bash
cat > /tmp/scamp-secrets.json <<'JSON'
{
  "DATABASE_URL": "postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/db?sslmode=require",
  "BETTER_AUTH_SECRET": "<paste the generated secret>",
  "BETTER_AUTH_URL": "https://www.scamp.club",
  "R2_ACCOUNT_ID": "<cloudflare account id>",
  "R2_BUCKET_NAME": "scamp-project-blobs",
  "R2_ACCESS_KEY_ID": "<from the R2 API token>",
  "R2_SECRET_ACCESS_KEY": "<from the R2 API token>"
}
JSON

npx wrangler secret bulk /tmp/scamp-secrets.json
rm /tmp/scamp-secrets.json
```

The `<<'JSON'` quoting matters: the single quotes stop the shell touching `$` in
any of the values. **Delete the file afterwards** — it holds your database
password and R2 secret in plaintext. Put it in `/tmp`, never in the repo, where
a stray `git add -A` could commit it.

Then confirm all seven landed:

```bash
npx wrangler secret list
```

### Or one at a time

If you prefer the prompts, run them **individually**, waiting for each to
complete:

```bash
npx wrangler secret put DATABASE_URL           # Neon pooled connection string
npx wrangler secret put BETTER_AUTH_SECRET     # generate fresh, see below
npx wrangler secret put BETTER_AUTH_URL        # https://www.scamp.club
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
  scheme and any `www`. It is `https://www.scamp.club` — see
  [step 6.5](#65-canonical-host-consolidating-four-hostnames-onto-wwwscampclub).
  A mismatch produces `403 INVALID_ORIGIN` on every authenticated request, which
  reads like a broken deploy rather than a one-character config error.
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

`wrangler.jsonc` has no `routes` key, so hostnames are attached through the
dashboard. All four — `scamp.club`, `www.scamp.club`, `scampdesign.app` and
`www.scampdesign.app` — currently resolve to this Worker and serve the identical
build, so the bindings already exist and survive a redeploy.

Consolidating them onto one canonical host is
[step 6.5](#65-canonical-host-consolidating-four-hostnames-onto-wwwscampclub).

The Worker name (`scamp-website`) is unchanged, which is deliberate: a rename
would create a second Worker and orphan the domain.

`preview.*` is not needed yet — it appears in `plans/backend.md` for hosted
previews, which are not built.

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

## 6.5 Canonical host: consolidating four hostnames onto `www.scamp.club`

Two zones are in play, and **all four hostnames currently serve the same Worker
with no redirects between them**:

| Hostname | Now | Target |
|---|---|---|
| `www.scamp.club` | serves the site | **canonical — serves the site** |
| `scamp.club` | serves the site | redirect → `www.scamp.club` |
| `scampdesign.app` | serves the site | redirect → `www.scamp.club` |
| `www.scampdesign.app` | serves the site | redirect → `www.scamp.club` |

Four live origins for one site causes three distinct problems:

- **Auth breaks on three of them.** `BETTER_AUTH_URL` can only be one value, so
  the others return `403 { "code": "INVALID_ORIGIN" }` on sign-in.
- **Sessions do not span hostnames.** Cookies are host-scoped, so signing in on
  one host and landing on another silently signs you out.
- **Duplicate content.** Four copies of every page, differing only in hostname.

### Already done in the repo

`www.scamp.club` is already attached to the Worker — verified by all four hosts
serving the identical build — so no DNS or Worker binding work is needed. Two
code changes have been made:

- `lib/site.ts` — `FALLBACK_URL` is now `https://www.scamp.club`, which
  repoints every canonical tag, the sitemap, `robots.txt`, OG tags and JSON-LD.
- `public/llms.txt` — 34 hardcoded URLs updated.

> **Do not try to set `NEXT_PUBLIC_SITE_URL` as a Worker secret.** `NEXT_PUBLIC_*`
> variables are inlined into the bundle at **build** time; secrets are
> runtime-only, so it would be silently ignored. Changing the default in
> `lib/site.ts` is the reliable route.

### Step 1 — update the auth origin

```bash
npx wrangler secret put BETTER_AUTH_URL
# value: https://www.scamp.club
```

Must be exactly the canonical host, with scheme and `www`, no trailing slash.

### Step 2 — deploy and verify the destination *before* redirecting

Redirect rules point traffic at `www.scamp.club`, so confirm that host is fully
working first. Redirecting into a broken host turns one broken page into four.

```bash
npm run deploy

# canonical should now be www.scamp.club
curl -s https://www.scamp.club/ | grep -o '<link rel="canonical"[^>]*>'

# origin check should pass: 401 (bad credentials), not 403 (bad origin)
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://www.scamp.club/api/auth/sign-in/email \
  -H 'Content-Type: application/json' -H 'Origin: https://www.scamp.club' \
  -d '{"email":"nobody@example.invalid","password":"x"}'
```

Then create a real account at `https://www.scamp.club/sign-up` and confirm you
land on `/dashboard`. **Do not proceed until this works.**

### Step 3 — redirect rules, in both zones

Cloudflare Redirect Rules are **per-zone**, and these are two separate zones. You
need rules in each.

**Zone `scamp.club`** — Rules → Redirect Rules → Create rule:

| Field | Value |
|---|---|
| Rule name | `apex to www` |
| When incoming requests match | Custom filter expression |
| Expression | `http.host eq "scamp.club"` |
| Then | Dynamic redirect |
| URL expression | `concat("https://www.scamp.club", http.request.uri.path)` |
| Query string | Preserve |
| Status code | `302` (see below) |

**Zone `scampdesign.app`** — one rule covering both its hostnames:

| Field | Value |
|---|---|
| Rule name | `scampdesign to scamp.club` |
| Expression | `http.host in {"scampdesign.app" "www.scampdesign.app"}` |
| URL expression | `concat("https://www.scamp.club", http.request.uri.path)` |
| Query string | Preserve |
| Status code | `302` |

Using `http.request.uri.path` and preserving the query string means deep links
survive: `scampdesign.app/docs/canvas?x=1` lands on
`www.scamp.club/docs/canvas?x=1`. A rule that redirects everything to `/` would
break every existing inbound link.

### 302 rather than 301, deliberately

You said "for now", which argues for a **302 (temporary)**:

- **301 is cached hard by browsers**, often indefinitely. If you later decide
  `scampdesign.app` should be canonical again, visitors who saw the 301 keep
  being redirected until they clear their cache. You cannot undo it for them.
- **301 transfers SEO equity** to `scamp.club` and tells search engines
  `scampdesign.app` has permanently moved. That is what you want *eventually*,
  but not while the decision is provisional.

Switch the status to 301 once the choice is settled. That is a one-field edit in
each rule.

### Step 4 — verify all four

```bash
for h in scamp.club www.scamp.club scampdesign.app www.scampdesign.app; do
  printf '%-24s ' "$h"
  curl -sI "https://$h/pricing" | head -1
done
```

Expect `www.scamp.club` to return `200` and the other three `302` with a
`location` of `https://www.scamp.club/pricing`. Check the path survived — a
redirect to `/` means the URL expression dropped it.

Also confirm the redirect does not catch the API, since the desktop client will
call the canonical host directly:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://www.scamp.club/api/auth/get-session   # expect 200
```

**Use a GET, not `curl -I`.** `-I` sends a `HEAD` request, and Next only
auto-implements `OPTIONS` for route handlers — never `HEAD`. Better Auth's route
exports `GET` and `POST` only, so `HEAD` correctly returns `404`. Static pages
answer `HEAD` fine, which makes the inconsistency look like a broken API when it
is not.

### Step 5 — housekeeping

- Search Console: add `www.scamp.club` as a property. Once you move to 301, use
  the Change of Address tool for `scampdesign.app`.
- Any Calendly, Gumroad or social links pointing at `scampdesign.app` still work
  via the redirect, but are worth updating.
- `BOOKING_URL` and `GUMROAD_URL` in `lib/site.ts` are external and unaffected.

---

## 6.6 Resend — transactional email

Needed for email verification. The code is wired; this is the provisioning.

### Create the account and verify a domain

1. Sign up at [resend.com](https://resend.com).
2. **Domains → Add Domain**, and add `scamp.club`.
3. Resend gives you DNS records — typically a `TXT` for DKIM and an `MX` plus
   `TXT` for the return path. Add them **in the `scamp.club` Cloudflare zone**.
4. Set those records to **DNS only** (grey cloud), not proxied. Proxying mail
   records breaks verification.
5. Wait for Resend to show the domain as Verified. Usually minutes.

**Until a domain is verified, Resend will only send from `onboarding@resend.dev`
and only to the address that owns the Resend account.** That is enough to prove
the plumbing works, but not enough to sign anyone else up — so verify the domain
before inviting real users.

### Create the API key

**API Keys → Create API Key**, with **Sending access** only. Copy it once.

### Set the secrets

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put EMAIL_FROM        # Angie from Scamp <angie@scamp.club>
```

`EMAIL_FROM` must use the verified domain, or Resend rejects the send. The
mailbox part is free — Resend verifies the *domain*, so any address at
`scamp.club` works with no extra setup.

### Sending from a personal address means handling replies

`angie@scamp.club` reads better than `noreply@` for a founder-led product, and
`noreply@` addresses tend to be filtered more aggressively. The catch is that a
human From invites human replies, and **Resend only sends — it does not receive**.
If nothing is listening at `angie@scamp.club`, replies bounce, which is a worse
experience than a `noreply@` that at least sets expectations.

Since `scamp.club` is already on Cloudflare, the cheapest fix is **Email Routing**
(free):

1. Cloudflare dashboard → `scamp.club` → **Email → Email Routing**
2. Add a custom address: `angie@scamp.club` → forward to your real inbox
3. Verify the destination address from the confirmation email
4. Enable Email Routing, which adds the MX records for receiving

**Watch for an MX conflict.** Email Routing puts MX records on the root
(`scamp.club`); Resend's return-path MX usually goes on a subdomain such as
`send.scamp.club`. Those coexist fine. If Resend asks for an MX on the **root**,
it will collide with Email Routing — use a Resend sending subdomain instead,
which they recommend anyway for reputation isolation. You can still send *from*
`angie@scamp.club` while the sending infrastructure lives on a subdomain.

If you already have a mail provider on `scamp.club` (Google Workspace,
Fastmail), skip Email Routing entirely — it already receives, and the same MX
conflict caveat applies.

### Verification is not enforced yet, on purpose

`lib/auth.ts` has:

```ts
const REQUIRE_EMAIL_VERIFICATION = false;
```

Emails **are** sent on sign-up regardless, so the flow is fully exercised — this
flag only controls whether an unverified user is blocked from signing in.

It is off because every account that exists today has `emailVerified: false`,
including yours. Turning it on before mail is confirmed working in production
locks everyone out of the deployed site, with no route back in except editing
the database.

**To turn it on, in this order:**

1. Deploy with the Resend secrets set, sign up with a real address, and confirm
   the email arrives and the link works.
2. Backfill the accounts that predate verification:
   ```bash
   DATABASE_URL='<neon url>' node scripts/verify-existing-users.mjs --dry-run
   DATABASE_URL='<neon url>' node scripts/verify-existing-users.mjs
   ```
3. Set `REQUIRE_EMAIL_VERIFICATION = true` and redeploy.

### Local development needs none of this

With no `RESEND_API_KEY`, `lib/email.ts` prints the message — including the
verification link — to the dev server console instead of sending it. Copy the
link into a browser to complete the flow offline. In production a missing key is
logged as an error instead, since it is a genuine fault there.

---

## 7. After the first deploy: verify these specifically

Two code paths have **never run**. Do not assume they work.

### a. The Neon adapter

`lib/prisma.ts` switches from `@prisma/adapter-pg` to `@prisma/adapter-neon`
when it detects the Workers runtime, because Workers have no TCP sockets. That
branch has only ever been type-checked.

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://www.scamp.club/api/auth/get-session \
  -H 'Origin: https://www.scamp.club'
```

`200` means the Worker booted, but it does **not** prove the database works —
with no session cookie, Better Auth answers `null` without querying.

The cheapest honest probe is a sign-in with deliberately wrong credentials,
which forces a lookup and creates nothing:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://www.scamp.club/api/auth/sign-in/email \
  -H 'Content-Type: application/json' -H 'Origin: https://www.scamp.club' \
  -d '{"email":"nobody@example.invalid","password":"x"}'
```

| Result | Meaning |
|---|---|
| `401` | Database reachable, credentials simply wrong — **this is the pass** |
| `500` | The query failed. See below |
| `403` | Origin mismatch — you called a non-canonical host, or `BETTER_AUTH_URL` is wrong |

An empty `500` here means the database call failed, and the response body will
tell you nothing. Get the real error from the Worker's logs:

```bash
npx wrangler tail --format pretty
```

Then repeat the request. Look for the `[prisma] runtime=… adapter=…` line that
`lib/prisma.ts` logs when it creates a client:

- `runtime=workers adapter=neon` — correct.
- `runtime=node adapter=pg` — **wrong, and this is the likely cause.** The TCP
  adapter cannot work on Workers. Runtime detection checks both
  `navigator.userAgent` and the Workers-only `WebSocketPair` global, because
  `nodejs_compat` can shadow `navigator` with Node's own (Node 21+ reports
  `Node.js/<version>`).

Other things that produce a `500` on this endpoint: `DATABASE_URL` unset or
wrong in the Worker, migrations never run against Neon (the `user` table would
not exist), or an unpooled Neon connection string.

### If you see `Cannot perform I/O on behalf of a different request`

```
Error: Cannot perform I/O on behalf of a different request. I/O objects ...
created in the context of one request handler cannot be accessed from a
different request's handler. (I/O type: Native)
```

...usually followed by the Worker hanging until the runtime cancels it.

Workers bind I/O objects to the request that created them. The Prisma client in
`lib/prisma.ts` is module-scoped, so it outlives any single request — and the
**WebSocket-pooled** Neon adapter (`PrismaNeon`) holds exactly such an object.
The first request an isolate serves works; later ones fail, so it presents as
intermittent.

The fix is already applied: the Workers path uses **`PrismaNeonHttp`**, which
issues each query as an independent fetch and keeps no socket, making a cached
client safe.

```ts
new PrismaClient({ adapter: new PrismaNeonHttp(connectionString, {}) })
```

**Do not switch back to `PrismaNeon` on Workers.** If interactive transactions
are ever needed — the one thing the HTTP driver cannot do, since it has no
session state — the client must be constructed per request instead, which means
building the Better Auth instance per request too.

### If you see `Wasm code generation disallowed by embedder`

```
CompileError: WebAssembly.Module(): Wasm code generation disallowed by embedder
```

Prisma 7 compiles queries with a WebAssembly query compiler, and by default
loads that Wasm at runtime — which Workers forbid. The fix is in
`prisma/schema.prisma` and must not be removed:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../lib/generated/prisma"
  runtime  = "workerd"      // emits the Wasm as a statically imported file
}
```

Re-run `npx prisma generate` after changing it. The generated client then
includes `query_compiler_fast_bg.wasm` as a real file that the bundler imports
statically, which Workers allow.

This one client works in **both** runtimes — Node for `next dev` and workerd in
production — so there is no second build to maintain. All four checkpoint
scripts pass against it.

**Reproducing Workers-only failures locally.** This class of bug cannot appear
under `next dev`, which runs in Node. Run the real Worker instead:

```bash
npx opennextjs-cloudflare build
npx opennextjs-cloudflare preview --port 8788
```

Secrets come from `.dev.vars` rather than `.env`. A fake but well-formed
`DATABASE_URL` is enough to surface Wasm and bundling problems, because they
occur when Prisma compiles a query, before it connects — an authentication
error is therefore a *pass*.

Wrangler's local logs are queryable, which is easier than reading scrollback:

```bash
curl -s -X POST http://localhost:8788/cdn-cgi/local/explorer/api/local/observability/query \
  -H 'Content-Type: application/json' \
  -d '{"sql":"SELECT message FROM logs ORDER BY rowid DESC LIMIT 10"}'
```

### b. Presigned R2 uploads

The `direct` field in a prepare response tells you which path is live:

```bash
# after signing in and creating a project
curl -X POST https://www.scamp.club/api/projects/<id>/push/prepare \
  -H 'Content-Type: application/json' -H 'Origin: https://www.scamp.club' \
  -b 'better-auth.session_token=...' \
  -d '{"manifest":{}}'
```

- `"direct": true` — presigned R2 URLs, correct
- `"direct": false` — **the R2 credentials are missing or wrong.** Uploads are
  being routed through the Worker. It will appear to work.

### c. A real round trip

The strongest check is the reference client against production:

```bash
export BASE_URL=https://www.scamp.club
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
| ~~Rate limiting is in-memory~~ | **Fixed.** Now `storage: "database"` with the client IP read from `cf-connecting-ip` | `lib/auth.ts` |
| **Email verification not enforced** | Emails send, but unverified users are not blocked. Needs Resend provisioned, then the flag flipped — see [6.6](#66-resend--transactional-email) | `lib/auth.ts` |
| **No billing** | `assertCanSync()` returns `true` for everyone, so cloud backup is free to all signups | `lib/api-auth.ts` |
| **No storage quotas** | History is unlimited and nothing is ever deleted, so an account can grow without bound | `plans/cloud-backup.md` |
| **No password reset** | A locked-out user has no self-service path | — |

Email verification is the one I would not launch without, and it is now one flag
away — see [step 6.6](#66-resend--transactional-email).

---

## Quick reference

| What | Where | Value |
|---|---|---|
| Database | Neon | pooled connection string |
| Blob storage | R2 bucket | `scamp-project-blobs` |
| Presigned URLs | R2 API token | Object Read & Write, bucket-scoped |
| Cache (optional) | R2 bucket | `scamp-next-cache`, binding `NEXT_INC_CACHE_R2_BUCKET` |
| Worker name | `wrangler.jsonc` | `scamp-website` — do not rename |
| Secrets | `wrangler secret bulk` | 7 values in one JSON file, see step 3 |
| Build-time env | CI | `DATABASE_URL` as well |
| Migrations | one-off | `prisma migrate deploy` |
| Email | Resend | verify `scamp.club`, then `RESEND_API_KEY` + `EMAIL_FROM` |
| Deploy method | manual for now | `npm run deploy`; pause any Cloudflare git integration first |
| Canonical host | `www.scamp.club` | other 3 hostnames 302 to it, rules in both zones |
