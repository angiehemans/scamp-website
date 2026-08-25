# Pay-what-you-want downloads — Phases 0, 1 and the marketing flow built ✅

Take over distribution of the desktop app from Gumroad, and put an optional
payment in front of it for signed-in users.

**Definition of done:** a signed-in user clicks a download button on
`/dashboard`, is shown a pay-what-you-want form, and either pays through Stripe
or chooses $0. Either way they get the installer for their platform, served from
our own R2 bucket over a short-lived signed URL. What they paid is recorded, and
the total shows up on `/admin`.

Related: [backend.md](./backend.md) (the overall shape),
[cloud-backup.md](./cloud-backup.md) (the R2 and presigning machinery this
reuses wholesale).

---

## 1. Decisions already made

| Question | Answer |
|---|---|
| Where do installers live? | **Self-hosted on R2**, presigned like project blobs |
| Can someone pay $0? | **Yes.** $0 skips Stripe entirely |
| Do the marketing pages change? | **No** — they keep linking to Gumroad for now |
| What does paying buy? | **Nothing extra.** One optional payment per account; downloads are never gated |

That last one is worth restating because it simplifies a lot: **the download
endpoint checks that you are signed in, and nothing else.** There is no
entitlement, no licence key, no "did they pay" branch. The `Purchase` row exists
for your bookkeeping and for the admin page, not as a gate. Anything that reads
a purchase before serving a file is out of scope and should stay that way.

---

## 2. Two things to decide with open eyes

Neither blocks the build. Both get materially harder to reverse later.

### 2.1 Leaving Gumroad makes you the merchant of record

This is the big one, and it is easy to miss because it is not a code problem.

Gumroad sells as **merchant of record**: it is legally the seller, and it
calculates, collects, and remits VAT/GST on digital goods for you. Selling the
same download through your own Stripe account makes **you** the seller. For
digital products sold to consumers, a number of jurisdictions — the EU, the UK,
Norway, Australia, and others — expect registration and remittance from the
first sale, with no small-seller threshold for cross-border digital sales.

Options, roughly in order of effort:

- **Stripe Tax** — calculates and reports, but you still register and file.
  Costs a percentage per transaction.
- **A merchant-of-record provider** (Paddle, Lemon Squeezy, Polar) — they take
  the liability like Gumroad did, at a higher cut than raw Stripe.
- **Accept the exposure while volume is tiny**, and revisit at a threshold you
  set now rather than discover later.

I am not qualified to tell you which is correct for your situation, and this
plan does not depend on the answer — Stripe Checkout can have Tax switched on
later without touching the flow below. But "pay what you want, mostly $0" plus
international VAT registration is a genuinely bad ratio, so decide it
deliberately.

### 2.2 (resolved) The marketing flow — guest first, account after

Superseded by §4.5. Marketing pages get their own public download flow rather
than pushing people into sign-up, so signing in never becomes the slower route.

The original text is kept below because the tension it describes is what §4.5
exists to remove.

### 2.2 The logged-in experience was about to become the worse one

You chose to leave the marketing pages on Gumroad, which is a reasonable way to
ship this without a rewrite. The consequence:

- An anonymous visitor: click Download on `/pricing` → Gumroad → file. No
  account, no payment prompt.
- A signed-in user: click Download on `/dashboard` → a payment form.

Signing in makes the download *harder*. Anyone who notices is incentivised not
to have an account, which works directly against the sign-up metrics we just
built. It also means **two distribution channels with two copies of every
binary**, which will silently drift the first time you ship a release to one and
not the other.

Suggested follow-up once this works: point the marketing buttons at a public
version of the pay-what-you-want page (guest checkout, no account), and retire
the Gumroad product. Tracked in §9.

---

## 3. Data model

Four new models. Nothing existing changes.

```prisma
/// One shipped version of the desktop app.
model Release {
  id          String    @id @default(cuid())
  version     String    @unique          // "1.4.0", sorts via publishedAt not this
  notes       String?                    // optional, shown on the dashboard
  publishedAt DateTime?                  // null = staged, never served
  createdAt   DateTime  @default(now())
  assets      ReleaseAsset[]

  @@index([publishedAt])
}

/// One platform's installer within a release.
model ReleaseAsset {
  id        String  @id @default(cuid())
  releaseId String
  release   Release @relation(fields: [releaseId], references: [id], onDelete: Cascade)
  platform  String                       // "macos" | "windows" | "linux"
  key       String                       // R2 object key, never sent to a client
  filename  String                       // what the browser should save it as
  sizeBytes Int
  sha256    String                       // published so people can verify

  @@unique([releaseId, platform])
}

/// What someone chose to pay. Bookkeeping, not an entitlement.
model Purchase {
  id                    String    @id @default(cuid())
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  amountCents           Int                       // 0 is valid and expected
  currency              String    @default("usd")
  status                String                    // free | pending | paid | refunded
  stripeSessionId       String?   @unique
  stripePaymentIntentId String?   @unique
  createdAt             DateTime  @default(now())
  paidAt                DateTime?

  @@index([userId])
  @@index([status, createdAt])
}

/// Seen Stripe event ids, so a redelivered webhook is a no-op.
model StripeEvent {
  id         String   @id                          // Stripe's evt_… id
  type       String
  receivedAt DateTime @default(now())
}
```

**`publishedAt` nullable rather than a `draft` boolean**: you can upload all
three installers, verify their hashes, and only then make the release live in a
single write. A half-uploaded release is never reachable.

**Amounts in integer cents**, never floats. `$19.99` as a float is a rounding
bug waiting for a reconciliation that does not balance.

**`status` as a string, not an enum**: Better Auth's CLI regenerates
`prisma/schema.prisma` from `lib/auth.ts` and drops enum declarations it does
not know about. This bit us three times already with `runtime = "workerd"`. A
string plus a validated constant in `lib/purchase-status.ts` survives
regeneration.

---

## 4. The flow

```
dashboard  ─ click Download (macOS) ─→  PWYW form (client component)
                                          │
                     ┌────────────────────┴────────────────────┐
                   $0                                        ≥ $1
                     │                                          │
        POST /api/download/claim                POST /api/download/checkout
        { platform, amountCents: 0 }            { platform, amountCents }
                     │                                          │
        Purchase status="free"                  validate + clamp server-side
                     │                          Stripe Checkout Session
                     │                          Purchase status="pending"
                     │                                          │
                     │                          303 → checkout.stripe.com
                     │                                          │
                     │                          ┌───────────────┴──────────────┐
                     │                   success_url                    webhook (truth)
                     │              /dashboard?paid=1                 checkout.session.completed
                     │                          │                     Purchase → "paid"
                     └──────────┬───────────────┘
                                │
                   GET /api/download/macos
                   (signed in — that is the only check)
                                │
                   latest published Release → ReleaseAsset
                   presign R2 GET, 15 min
                                │
                            302 → R2
```

### Why the webhook is the source of truth

`success_url` is a redirect the browser may never follow — the user can close
the tab the moment Stripe takes payment. Marking a `Purchase` paid there means
losing real revenue records. The redirect only updates the UI optimistically;
`checkout.session.completed` on the webhook is what writes `status = "paid"`.

### The $0 branch exists because Stripe cannot do it

Stripe Checkout cannot process a zero-amount payment, and card networks impose a
practical floor around $0.50 anyway. So $0 is not "a Checkout session for $0" —
it bypasses Stripe completely and writes a `Purchase` with `status = "free"`.

Recording the $0 choice rather than skipping the write is deliberate: "how many
people chose to pay nothing" is the single most useful number this feature
produces, and it only exists if we write the row.

### Never trust the amount from the client

The posted `amountCents` is user input. Server-side: reject non-integers,
reject negatives, clamp to `[100, 50_000]` for the paid path (`$1` – `$500`),
and build the Checkout session from the clamped value. A client that posts
`amountCents: 1` must not create a one-cent charge that costs more in fees than
it collects.

---

## 4.5 The marketing flow — email, pay, then offer an account ✅ **built**

`/download` (static, public), `/api/download/guest`, `Purchase.userId` made
nullable with `email` and `ipHash` added (migration `20260824165241_guest_purchases`),
and every download CTA on the site repointed. `scripts/check-guest-download.mjs`
— 34 assertions, passing.

**Six of the CTAs were hardcoded Gumroad URLs, not `GUMROAD_URL`** — in `Nav`,
`Hero` and the `Download` component. A grep for the constant missed all of them,
including the "Download Now" button in the nav on every page, which is what a
visitor is most likely to click. Worth remembering the next time a link is
"fully removed".


The dashboard flow assumes a session. Marketing pages have no such luxury, and
requiring sign-up before download would make an account the price of the free
tier — which contradicts "No account required" on the pricing page and makes
signing in strictly worse than not.

So: **no account needed to download, and the account is offered afterwards,
while the file is already transferring.**

```
marketing CTA ──→ /download  (public, static shell + client form)
                     │
        step 1   email + platform + amount
                     │
                     ├─ $0 ─→ POST /api/download/guest
                     │           records a Purchase with email, no userId
                     │           returns a presigned R2 URL
                     │
                     └─ ≥$1 → Stripe (Phase 2; disabled for now)
                     │
        step 2   download starts, and the SAME page swaps to:
                     │
                 "Want an account?"  name + password + role
                 (email already known, shown but not re-typed)
                     │
                 normal Better Auth sign-up
                     │
                 databaseHooks.user.create.after links the guest
                 Purchase rows by email
```

**Why the upsell lands after the download, not before.** The moment the file is
transferring is the only point where the person has what they came for and is
waiting anyway. Asking beforehand trades a download for a form; asking during
costs them nothing. Nobody is blocked either way — closing the tab still leaves
them with the installer.

**Why the download does not navigate.** The response is served with
`Content-Disposition: attachment`, so setting `window.location.href` starts a
download without unloading the page. That is what makes "download and upsell at
the same time" possible in one page with no popup.

**Why guests get the presigned URL directly** rather than going through
`/api/download/<platform>`: that route requires a session, and adding a
guest branch to it would put the "is this person allowed" decision in two places.
The guest endpoint mints its own URL, and the capability still expires in 15
minutes.

### What this costs in the data model

`Purchase.userId` becomes nullable and `email` is added, so one table still
holds every download decision — guest and signed-in alike. Splitting guests into
their own table would mean every revenue figure on `/admin` became a UNION that
someone eventually forgets to update.

A guest row is also the lead record. "How many people downloaded without an
account, and how many later made one" falls out of the same table.

### The open-endpoint problem

`POST /api/download/guest` takes an email and writes a row, with no session
behind it. Two mitigations, both cheap:

- **Per-IP rate limiting**, on a hash of the address rather than the address
  itself — enough to stop a script filling the table, without keeping a
  plaintext IP against an email address indefinitely.
- **Nothing is emailed on claim.** The endpoint cannot be used to send mail to a
  third party, so it is not a spam relay.

Downloads themselves being free means there is no financial abuse to worry
about: R2 egress costs nothing, so the worst case is junk rows.

### Deliberately not done here

- **No verification before download.** The email is unverified and that is fine
  — it buys a lead and a receipt address, not access. Verification happens the
  usual way if they create an account.
- **No email is sent.** A "here is your download link again" mail is an obvious
  follow-up and is not in this phase.

---

## 5. Stripe on Workers — the parts that will bite

Verified against the OpenNext Cloudflare guide and stripe-node's own issue
tracker, not assumed. Getting these wrong produces runtime-only failures that
pass locally, exactly like the Prisma Wasm and Neon-HTTP failures earlier in
this project.

**1. The default HTTP client does not exist on workerd.** stripe-node reaches
for `node:https`. Workers do not have it:

```ts
const stripe = new Stripe(requireStripeKey(), {
  httpClient: Stripe.createFetchHttpClient(),
});
```

**2. Webhook verification must be async.** `constructEvent` is synchronous and
uses Node crypto. WebCrypto is async, so on Workers it throws
"SubtleCryptoProvider cannot be used in a synchronous context":

```ts
const event = await stripe.webhooks.constructEventAsync(
  rawBody,
  signature,
  requireWebhookSecret(),
  undefined,
  Stripe.createSubtleCryptoProvider(),
);
```

**3. The webhook needs the raw body.** Signature verification runs over the
exact bytes Stripe sent. Read `await request.text()` and parse *nothing* before
it — and never read the body twice, which throws "Body has already been used".

**4. Build the client per request.** Same rule as `getPrisma()` and `getAuth()`:
a module-scoped client pins one request's I/O context for the isolate's
lifetime, which is what produced `Cannot perform I/O on behalf of a different
request`. `lib/stripe.ts` exports `getStripe()`, following the existing pattern.

**5. The webhook route is unauthenticated by design.** Stripe has no session.
The signature *is* the authentication — so a missing or unverifiable signature
must be a hard 400, never a "process it anyway" fallback.

**6. Return 2xx fast.** Stripe retries on non-2xx and on timeouts. Record the
event, do the small write, respond. Anything slow belongs elsewhere.

---

## 6. R2 layout and publishing a release

Installers go in the existing bucket under a separate prefix, so nothing
collides with project blobs:

```
releases/<version>/<platform>/<filename>
releases/1.4.0/macos/Scamp-1.4.0-universal.dmg
releases/1.4.0/windows/Scamp-1.4.0-setup.exe
releases/1.4.0/linux/Scamp-1.4.0.AppImage
```

Content-addressed storage is right for project blobs and wrong here: there are a
handful of these, they are large, and a human needs to look at the bucket and
understand it.

**Uploading.** `wrangler r2 object put` caps at **300 MiB** and does not do
multipart. A universal macOS build can exceed that. Use the S3-compatible API —
`rclone` or the `aws` CLI both do multipart against R2 with the credentials you
already created for presigning. `scripts/publish-release.mjs` should:

1. take a version and a directory of installers
2. compute each `sha256`
3. upload each to its key (multipart, resumable)
4. verify the uploaded size and hash by reading back
5. write `Release` + three `ReleaseAsset` rows
6. set `publishedAt` **only after** all of the above succeeds

Step 6 last is the whole point of the nullable column.

**Downloads never expose the key.** `/api/download/[platform]` looks up the
asset server-side and 302s to a freshly signed URL with the existing
`BLOB_URL_TTL_SECONDS` (15 min). Presigned R2 GETs support
`response-content-disposition`, so the browser saves `Scamp-1.4.0.dmg` rather
than a hashed key.

**Egress is free on R2.** A 200 MB installer downloaded 10,000 times costs
nothing in bandwidth — about $0.003/month to store. Cost is not a factor here.

---

## 7. Phases

Ordered so the risky external dependency comes last, and every phase ships on
its own. Same shape that worked for auth → cloud backup.

### Phase 0 — serve the file ourselves, no payment at all ✅ **built**

`Release` / `ReleaseAsset` (migration `20260824155706_releases`), `lib/platforms.ts`,
`lib/releases.ts`, `scripts/publish-release.mjs`, and `/api/download/[platform]`
gated on sign-in only. The dashboard buttons point at it instead of Gumroad.
No Stripe, no form, no `Purchase`.

`scripts/check-releases.mjs` — 18 assertions, passing.

Two things worth knowing about how it came out:

- **`presignGet` gained an optional `filename`.** On R2 it signs
  `response-content-disposition`; locally the `/api/blobs/direct` route sets the
  header itself. Without it a download saves under the R2 key rather than
  `Scamp-0.6.0.dmg`.
- **Uploads are S3 multipart, not the R2 binding.** `wrangler r2 object put` caps
  at 300 MiB with no multipart, and a universal macOS build exceeds that. The
  script uploads in 64 MiB parts and aborts the upload on failure, because an
  abandoned multipart upload keeps its parts and is billed for them.

**Not yet done:** no real installers are in R2. Phase 0 is proven against
fixtures; the first real `publish-release.mjs` run is still ahead.

### Phase 1 — the form, $0 only ✅ **built**

`Purchase` (migration `20260824163237_purchases`), `lib/purchase-status.ts`,
`lib/purchases.ts`, `/api/download/claim`, and `DownloadPanel.tsx` on the
dashboard. `scripts/check-purchase.mjs` — 25 assertions, passing.

**The security property this phase turns on:** `/api/download/claim` writes a
revenue row with no money involved, so it refuses any non-zero `amountCents`
outright, and `recordFreeClaim` hard-codes the 0 as a second line of defence.
Without both, anyone with an account could POST `{ amountCents: 50000 }` and add
$500 to the figures on `/admin` — numbers that would look authoritative and be
fiction. The checkpoint asserts 5000, 100 and 1 cents are all refused *and* that
no row was written.

Two decisions that came out of building it:

- **Asked once per account, not per download.** `hasResponded` counts `free` and
  `paid` rows — but deliberately not `pending`, so an abandoned Checkout session
  cannot silence the prompt forever.
- **Selecting a paid amount must not trap you.** The pay button is disabled
  until Phase 2, so a "Download without paying" action sits beside it. Without
  that, picking $25 leaves the only route out as *Back* then *$0*, which reads
  as a paywall the moment someone tries to give you money.

### Phase 2 — Stripe

`lib/stripe.ts` with the fetch client, `/api/download/checkout`,
`/api/stripe/webhook` with `constructEventAsync` and the `StripeEvent`
idempotency table, and the success/cancel returns to `/dashboard`.

Locally, Stripe's CLI forwards real test events:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger checkout.session.completed
```

*Checkpoint* `scripts/check-stripe.mjs`: an unsigned webhook is 400; a valid one
flips `pending` → `paid`; **the same event delivered twice writes once**; a
client-supplied amount outside the clamp is rejected before a session is created.

### Phase 3 — surface it

Revenue on `/admin` — total, last 30 days, share who paid $0, average of those
who paid — as stat tiles beside the existing sign-up numbers. Same single-hue
treatment; no second chart unless the distribution turns out to be interesting.

Also: a "Downloads" section on the dashboard showing the current version, and
receipts. Stripe emails its own receipt if configured, which is likely enough.

---

## 8. New configuration

| Name | Where | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Worker secret + `.env` | test key locally, live key in production |
| `STRIPE_WEBHOOK_SECRET` | Worker secret + `.env` | **different value** for the CLI-forwarded local endpoint and the deployed one |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | build-time | only if the form ever moves to Stripe Elements; redirect-to-Checkout does not need it |

`NEXT_PUBLIC_*` is inlined at build time, so setting it as a Worker secret does
nothing — the same trap already documented for `NEXT_PUBLIC_SITE_URL` in
`lib/site.ts`.

The secret count in `api-docs/deployment.md` goes 8 → 10, and the bulk-secrets
JSON needs both new entries.

---

## 9. Still open

- **§2.1, VAT / merchant of record.** Decide before the first live charge.
- **§2.2, the two-channel problem.** Retire Gumroad and make the PWYW page
  public, or accept the drift.
- **Refunds and chargebacks.** `status = "refunded"` exists in the model;
  nothing writes it. A `charge.refunded` handler is one more webhook case.
- **Currency.** Everything assumes USD. Multi-currency changes the admin
  aggregates from a `SUM` into something that needs conversion rates.
- **Auto-update.** If the desktop app ever self-updates, it needs a public
  version manifest — which is a *different* endpoint from this one, because it
  cannot require a session.
- **Platform detection.** Phase 0 keeps the three explicit buttons. Guessing
  from the user agent is a nice touch and gets Apple Silicon vs Intel wrong.
- **Does the $0 option cannibalise?** Expect the large majority to pay nothing.
  That is the deal with pay-what-you-want, and it is the right call while the
  goal is adoption — but it means this feature's revenue should not be load
  bearing for a while.
