# Scamp — Cloud & Pricing Strategy

This document captures early thinking on a potential paid cloud tier for Scamp.
The local version remains free forever. This is a notes document, not a PRD —
nothing here is committed to build yet.

---

## Core principle

Local is always the source of truth. The cloud is a mirror and a sharing layer
on top. Files never stop belonging to the user, even on a paid tier. The paid
version must feel like an enhancement of the local-first philosophy, not a
betrayal of it.

---

## Tiers

### Free — always
- Full local design tool, no feature limits
- No account required
- Unlimited projects
- Everything documented in the feature backlogs

### Pro — $16/month (annual) or $20/month (monthly)

Pricing aligns with Figma's per-seat model. Annual subscription at $16/seat/month,
month-to-month at $20/seat/month.

Includes everything in Free plus:
- Shareable preview links — send a URL to a client or stakeholder, they see the
  live prototype in a browser with no install required
- Password protected share links
- Comments on prototypes — stakeholders click anywhere to leave a note,
  designer sees them in the app
- Comment threads and resolution
- Cloud backup — automatic backup of project files, never lose work if a
  machine dies
- Version history — roll back to any previous state of a project
- Cross-machine sync — work on your laptop, continue on your desktop

### Enterprise — contact us
Pricing based on team size and needs. No public price listed.

Includes everything in Pro plus:
- SSO / SAML
- Audit logs
- Priority support
- Custom contracts
- SLA

---

## What to build first

The shareable preview link is the single most compelling paid feature and the
right wedge into the paid tier. It is:
- Self-contained — doesn't require multiplayer or complex real-time infrastructure
- Solves a real problem — sharing a Scamp prototype today means sending files
- Clear value — clients and stakeholders can view and comment in a browser,
  no Scamp install needed
- A natural foundation — the cloud infrastructure built to support it (auth,
  file sync, hosted preview rendering) becomes the base for everything else

Build sequence when the time comes:
1. ✅ Accounts — email/password done; GitHub and Google still to do.
   See [auth-setup-phase-1.md](./auth-setup-phase-1.md)
2. ✅ **Cloud backup** — done. Push, restore, and roll back to any past
   version. See [cloud-backup.md](./cloud-backup.md)
   - ⏸ **Cross-machine sync** — split out and paused, blocked on the
     conflict-policy decision. See [cloud-sync.md](./cloud-sync.md)
3. Shareable preview links
4. Comments on prototypes
5. ✅ Version history — arrived free with backup rather than "later, depending
   on storage costs". Content-addressed storage means a version is a row, not a
   copy of the project, so the cost concern did not materialise. API is done;
   browsing UI is Electron-side.
6. Enterprise features (SSO etc.) when there is enterprise demand

**Not yet in production.** All of the above runs locally only — Neon, R2,
Stripe, and the Cloudflare deploy config are still outstanding.

---

## Account and login model

The local app should always work fully offline with no account required. An
account is only needed when a cloud feature is used for the first time.

Preferred flow:
- User clicks "Share" (or any cloud feature) for the first time
- App prompts to sign in or create an account
- After sign in, the cloud feature activates
- Subsequent launches check for an existing session silently — no login prompt
  on every open

This preserves the no-friction download experience and keeps the free tier
genuinely frictionless.

---

## What not to do

**Multiplayer / real-time co-editing** — too complex to build correctly and goes
against the local-first ethos. Not planned, possibly ever. If collaboration is
needed, the agent + shared git repo workflow covers most of it.

**Feature gating on the free tier** — no "upgrade to unlock" prompts on
individual design features. Pro is purely about cloud, sharing, and backup.
The local tool stays whole.

**Forcing an account for local use** — the moment the local app requires an
account to open, Scamp loses its core identity.

---

## Cloud stack

### Decisions

| Layer | Choice | Reasoning |
|---|---|---|
| Framework | Next.js App Router (existing site) | API routes live in the same codebase as the marketing site and portal — one repo, one deployment, one language throughout |
| API routes | Next.js Route Handlers | `app/api/` folder, TypeScript, deployed to Cloudflare Pages alongside the site |
| ORM | Prisma | Best TypeScript ORM, type-safe queries, schema-first, first-class Neon support |
| Database | Neon | Serverless Postgres, generous free tier, scales to zero, works with Prisma's Neon adapter in the Workers runtime |
| Auth | Better Auth | Self-hosted MIT library, not a service. Users live in our own Postgres via its Prisma adapter, so there is no external identity provider to migrate off later. Handles email/password, GitHub and Google OAuth, organizations, and bearer tokens for the Electron client |
| Background jobs | Inngest | Serverless job queue built for Next.js and TypeScript. No Redis, no separate worker process, no Sidekiq equivalent to manage. Runs outside the Worker execution time limit |
| Payments | Stripe | Official TypeScript SDK, well documented, industry standard |
| File storage | Cloudflare R2 | No egress fees, native to Cloudflare, S3-compatible API, no cross-provider latency |
| Real-time | Pusher | Simple WebSocket events for comment notifications |
| Email | Resend | TypeScript-first transactional email, excellent Next.js integration |
| Deployment | Cloudflare Pages | One deployment for the marketing site, web portal, and API — already the plan |

### Why TypeScript over Rails

TypeScript throughout means one language across the Electron app, the
Next.js site, and the backend — no context switching, shared types,
and the fastest path to shipping. The co-founder is Rust-native and
can carry Rust if the backend needs to scale to it later. For now
TypeScript moves faster.

Consolidating the API into the existing Next.js codebase also means
one repo, one deployment, and one set of environment variables. The
Rails plan had a separate repo on a separate server — more
infrastructure to manage, more places for things to go wrong.

### Why Inngest over Sidekiq

Sidekiq requires Redis and a persistent worker process running
alongside the server. Inngest is a serverless job queue that
integrates directly with Next.js Route Handlers — jobs are TypeScript
functions, retries are handled automatically, and there is no separate
service to deploy or monitor. Long-running operations like preview
builds and snapshot uploads are handled by Inngest outside the Worker
execution time limit.

### Why Better Auth over Clerk

Auth is the hardest dependency to swap out later, so it is worth not
outsourcing the data. Better Auth is a library rather than a hosted
service: it runs inside the Next.js app and writes `user`, `session`,
`account`, and `verification` tables into our own Postgres through its
official Prisma adapter. If we ever replace it, the accounts are already
in our database — there is nothing to migrate out of somebody else's
system.

It also fits the rest of the stack better than a hosted provider:

- **One deployment.** It is a dependency, not a service. Keycloak, Ory,
  Zitadel, Logto, and SuperTokens are all genuinely open source but each
  needs its own server process running alongside, which contradicts the
  one-repo one-deployment principle above.
- **No per-MAU pricing.** Cost does not scale with signups.
- **Organizations and RBAC** ship as first-party plugins, which the
  Enterprise tier needs anyway.
- **No global React provider**, so the marketing and docs pages stay
  statically prerendered. A provider in the root layout would have opted
  the whole site into dynamic rendering.

What we take on in exchange: building the sign-in and sign-up UI
ourselves, owning email deliverability for verification and password
resets (Resend, already in this stack), and owning rate limiting and
security patching.

### Cloudflare Pages consideration

Next.js on Cloudflare Pages runs in the Workers runtime — not Node.js.
This requires two specific setup steps:

- **Prisma** needs the `@prisma/adapter-neon` driver adapter for the
  Workers runtime — standard Prisma does not work in Workers
- **Long-running operations** (preview builds, snapshot uploads) cannot
  run in a Route Handler due to Worker execution time limits — they
  must be offloaded to Inngest

Both are well-documented and have good community support. The Prisma
setup in particular is straightforward:

```typescript
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaNeon(pool);
export const prisma = new PrismaClient({ adapter });
```

### Full stack diagram

```
Electron app (local)
  ↕ REST API + session token
Next.js on Cloudflare Pages (one repo, one deployment)
  ├── Better Auth        — auth, OAuth, session/token verification
  ├── Prisma             — ORM for all metadata
  ├── Neon               — users, projects, shares, comments, snapshots
  ├── Inngest            — async jobs: builds, uploads, deploys, emails
  ├── Cloudflare R2      — project files + preview builds + snapshots
  ├── Stripe             — subscriptions, billing, invoices
  └── Pusher             — real-time comment notifications

Hosted previews
  └── Cloudflare Pages   — serves Inngest-triggered build output from R2
                            at preview.scampdesign.app/[token]

Marketing site + web portal
  └── Same Next.js codebase — same deployment
```

### Authentication with Better Auth

The Electron app authenticates via the same `scamp://` protocol handler
as before:

- User clicks "Sign in" in the Electron app
- A browser window opens to `scampdesign.app/sign-in`
- User signs in (email/password, GitHub, or Google)
- The site redirects to `scamp://auth/callback?token=...`
- The Electron app intercepts the callback, stores the JWT in
  `safeStorage`
- Every API call includes the token as a Bearer token
- Route Handlers verify by reading the session:

```typescript
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response('Unauthorized', { status: 401 });

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
  });

  return Response.json({ data: projects });
}
```

Note the join: `userId` is a direct foreign key to our own `user` table.
With a hosted provider this would have been a `clerkId` lookup against a
mirrored copy of somebody else's user directory, kept in sync by
webhooks.

### Background jobs (Inngest)

Long-running operations run as Inngest functions rather than blocking
Route Handler requests:

| Job | Trigger | What it does |
|---|---|---|
| `preview/build` | User clicks Share | Runs `next build` on project files, uploads output to R2, records share token |
| `snapshot/upload` | New local snapshot created | Zips snapshot files, uploads to R2, records in Postgres |
| `deployment/build` | User clicks Deploy | Promotes preview build to production, provisions Cloudflare subdomain |
| `files/sync` | Project file saved | Records sync metadata in Postgres, returns presigned R2 upload URL |
| `email/comment-notification` | New comment posted | Sends email notification to project owner via Resend |

```typescript
// Example Inngest job — preview build
export const previewBuildJob = inngest.createFunction(
  { id: 'preview-build', retries: 3 },
  { event: 'share/build.requested' },
  async ({ event, step }) => {
    const { shareId, projectFiles } = event.data;

    await step.run('build-project', async () => {
      // run next build on project files in a temp directory
    });

    await step.run('upload-to-r2', async () => {
      // upload build output to R2 at shares/[token]/
    });

    await step.run('update-share-record', async () => {
      await prisma.share.update({
        where: { id: shareId },
        data: { active: true, r2Key: `shares/${shareId}` },
      });
    });
  }
);
```

### Payments and subscriptions (Stripe)

| Product | Price | Billing |
|---|---|---|
| Scamp Pro | $16 / seat / month | Annual (billed yearly) |
| Scamp Pro | $20 / seat / month | Monthly recurring |
| Scamp Enterprise | Custom | Contact sales — manual invoice |

Key Stripe features:
- **Stripe Checkout** — hosted payment page for Pro signup
- **Stripe Customer Portal** — self-serve billing, cancel, update card
- **Stripe Webhooks** — received at `app/api/webhooks/stripe/route.ts`:
  - `checkout.session.completed` — activate Pro in Neon
  - `customer.subscription.updated` — update tier
  - `customer.subscription.deleted` — downgrade to Free
  - `invoice.payment_failed` — begin 7-day grace period
  - `invoice.payment_succeeded` — confirm renewal

Always verify the Stripe webhook signature using
`stripe.webhooks.constructEvent` before processing. Store
`STRIPE_WEBHOOK_SECRET` in Cloudflare Pages environment variables.

Grace period: 7 days before revoking Pro access. In-app banner
prompts the user to update their payment method. After 7 days
downgrade to Free and mark shared links as inactive.

### File sync architecture

- Debounced file writes in the Electron main process call the sync API
- The Route Handler returns a presigned R2 PUT URL — the Electron app
  uploads directly to R2 without passing files through the API server
- Metadata (project name, last synced, page list) is written to Neon
- Conflict resolution: last-write-wins with a "changes from another
  machine" banner if a sync arrives while local changes are unsaved

### Hosted preview architecture

When a user generates a share link:
1. The Electron app sends project files to the API
2. The Route Handler triggers an Inngest `preview/build` event
3. Inngest runs `next build` on the project files
4. Build output is uploaded to R2 at `shares/[token]/`
5. A Share record is created in Neon
6. Cloudflare Pages serves the build output at
   `preview.scampdesign.app/[token]`
7. The API returns the share URL to the Electron app

### Version history (snapshot approach)

On every sync, changed files are stored in R2 with a timestamp key:
```
projects/[project-id]/versions/[timestamp]/app/page.tsx
projects/[project-id]/versions/[timestamp]/app/page.module.css
```
Current files are stored separately:
```
projects/[project-id]/current/app/page.tsx
projects/[project-id]/current/app/page.module.css
```
Version metadata is a `Snapshot` record in Neon. Restoring a version
copies snapshot files back to `current/` via an Inngest job and
triggers a sync down to the local machine.

### Minimum viable cloud stack (first paid feature)

To ship shareable preview links as the first paid feature:

1. Better Auth — user accounts and session/token auth
2. Prisma + Neon — users, projects, share tokens, subscription state
3. Stripe — subscriptions and billing
4. Cloudflare R2 — project file storage + preview build output
5. Inngest — `preview/build` job for async builds
6. Next.js Route Handlers on Cloudflare Pages — all wired together

Add Pusher when comments ship. Add snapshot upload jobs when cloud
backup ships. The foundation is the same throughout.

### Scaling path

If the TypeScript/Next.js backend hits performance limits at scale
the natural migration is to extract the API into a standalone Rust
service (Axum) while keeping the Next.js site for the marketing and
portal pages. The API surface (endpoints, request/response shapes,
auth model) would be identical — a Rust rewrite is a re-implementation
not a redesign. The Prisma schema maps directly to Rust's SQLx models.
This decision can wait until there is a specific performance bottleneck
to solve.

---

## Public pricing page framing

```
Free                    Pro                       Enterprise
────                    ───                       ──────────

Full local              Everything in             Everything in
design tool             Free +                    Pro +

No account              Share preview links       SSO / SAML
Unlimited projects      Comments                  Audit logs
                        Cloud backup              Priority support
                        Version history           Custom contracts
                        Cross-machine sync        SLA
                        Hosting

                        $16/seat/mo (annual)      Contact us
                        $20/seat/mo (monthly)
```

---

## Hosting

A natural extension of the hosted preview feature already in the plan.
The infrastructure is nearly identical — the difference between a preview
link and a deployed website is a custom domain, persistent hosting that
does not expire, and automatic redeployment when files change.

**How it works:**

When a user is ready to go live from the preview review and sign-off
flow, they click "Deploy" from inside Scamp. The project's latest build
output is promoted from a preview URL to a live deployment at either a
Scamp-provided subdomain (`[project].scampdesign.app`) or a custom domain
the user brings. Subsequent file syncs to the cloud trigger a rebuild and
redeploy automatically.

**What this enables:**

The full loop from inside one tool — design in Scamp, share a preview
link for sign-off, deploy to production. No Vercel account, no Netlify,
no separate deployment pipeline. For landing pages, portfolios, and
content-driven sites this is a genuinely compelling end-to-end story.

**Constraints for the first version:**

- Static Next.js output only — no server-side rendering, no API routes,
  no server actions
- This is a reasonable first constraint since most Scamp projects at
  launch will be layout and UI work rather than full dynamic apps
- Dynamic hosting (with a runtime) is a later milestone if there is
  user demand for it

**Infrastructure:**

No new services needed. Cloudflare Pages already handles the hosting.
Custom domain support is built into Cloudflare Pages. The main work is:

- A deploy flow in the Scamp app (promote preview to production)
- Custom domain configuration UI in the web portal
- A production deployment record in Neon (separate from preview records)
- Automatic rebuild trigger on file sync

**Tier placement:**

Hosting belongs in the Pro tier. A Scamp-provided subdomain is included
with Pro. Custom domain support could be Pro or a separate add-on
depending on pricing strategy.

---

## Data layer (under consideration)

The idea: give users a managed database per project — so a design built
in Scamp can have real data behind it without leaving the platform.
Inspired by tools like Pocketbase but delivered as a managed service.

**The appeal:**

Closes the loop even further. Design it, deploy it, and give it real data,
all from Scamp. Particularly interesting for client portals, content-driven
sites, and prototypes that need dynamic data to feel real during sign-off.

**The complexity:**

Running isolated database instances per user is operationally heavier than
anything else in the cloud plan. It moves Scamp into backend infrastructure
territory which is a different kind of product and a different kind of
support burden.

**Status: research required**

Not added to the roadmap yet. Needs more research into:
- What database-as-a-service infrastructure makes sense at scale
  (per-schema Postgres, managed SQLite, or a purpose-built solution)
- Whether the target user actually needs this or already has a backend
  preference
- How it interacts with the Next.js API output (auto-generated Route Handlers, Prisma models, Inngest jobs)
- Competitive landscape: Webflow, Framer, Plasmic, and others who have
  attempted design-plus-data products

Revisit once hosting is live and there is signal from users about what
they need after their design is deployed.

---

## Open questions

- Do shared preview links require the viewer to create an account, or are they
  fully public by default with an optional password? Public by default is lower
  friction and more likely to drive word of mouth.
- How does version history interact with local files — is it a cloud-only
  history, or does it also track local saves? Cloud-only is simpler to start.
- What happens to shared links if a user downgrades from Pro to Free — do links
  expire, go read-only, or stay active? Need a clear policy before launch.
- For hosting: what happens to a live deployment if a user downgrades from Pro?
  A grace period before taking it offline is worth defining early.