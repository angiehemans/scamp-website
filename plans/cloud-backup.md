# Cloud backup — built ✅

Second slice of the cloud backend from [backend.md](./backend.md), following
[auth-setup-phase-1.md](./auth-setup-phase-1.md).

**Status: complete and working.** A project can be pushed to the cloud, restored
onto another machine byte-identically, and rolled back to any past version. Only
changed content transfers.

Cross-machine sync — two machines editing the same project — was deliberately
split out and is **not built**. See [cloud-sync.md](./cloud-sync.md), which is
blocked on the conflict-policy decision.

Run the checkpoints against `npm run dev`:

```
node scripts/check-blob-store.mjs   storage round trip
node scripts/check-projects.mjs     ownership and isolation
node scripts/check-push.mjs         ignore rules and dedup
node scripts/check-pull.mjs         byte-exact restore
```

Measurements that shaped this (taken from this repo, which is the same shape as
a Scamp project):

| | Size | Files |
|---|---|---|
| `node_modules` | 1.3 GB | **67,903** |
| Everything else | 5.8 MB | **274** |

A "400 MB project" is overwhelmingly `node_modules`. File *count* is what costs
— each file is a client-side hash and an R2 write — so excluding it is the
single biggest lever in the design. R2 storage is $0.015/GB-month with no
egress, which makes the dollar cost of storage a rounding error against a
$20/month tier; quotas are therefore about abuse, not economics.

---

## 1. What this is

backend.md describes this as the foundation layer: "Cloud backup + sync
(foundation layer — needed for everything else)". Preview links, comments, and
version history all sit on top of whatever storage model gets chosen here.
That is why the storage layout decision below matters more than it looks.

**Definition of done:** ✅ **met.**

A project on one machine can be pushed to the cloud, and pulled back down onto
a second machine — or the same machine after a wipe — landing byte-identical.
Only changed files transfer on subsequent pushes. Verified end to end by
`scripts/check-pull.mjs`, including restoring an arbitrary past version.

**Not in this document:** simultaneous editing, conflict handling, real-time
propagation. All of that is [cloud-sync.md](./cloud-sync.md);
[Decision A](#a-split-backup-from-sync-and-ship-backup-first) argues for why it
was separated.

---

## 2. Scope boundary — this repo is the API only

Worth stating plainly, because roughly half of this feature is not in this
codebase:

| Piece | Where it lives | In this plan? |
|---|---|---|
| Sync API endpoints | this repo (`app/api/…`) | ✅ |
| Data model, migrations | this repo (`prisma/`) | ✅ |
| R2 storage layout | this repo | ✅ |
| Watching files, debouncing writes | Electron app repo | ❌ described only |
| Auth token storage (`safeStorage`) | Electron app repo | ❌ |
| Sync status UI, conflict banner | Electron app repo | ❌ |

The plan below specifies the contract the Electron client must implement, so
the two can be built independently, but the client work is a separate effort in
a separate repo.

---

## 3. Prerequisites

- **The deploy phase from auth-setup-phase-1.md.** Neon provisioned, R2 bucket
  created, secrets set, incremental cache configured. Sync cannot ship without
  it.
- **An R2 bucket binding** in `wrangler.jsonc`.
- Auth, which is done.

Good news on local development: `initOpenNextCloudflareForDev()` (already wired
into `next.config.ts`) uses miniflare via `getPlatformProxy`, so **the R2
binding is emulated locally in `next dev`**. This can be built and tested
exactly the way auth was, with no cloud account in the loop.

---

## 4. Decisions to review

### A. Split "backup" from "sync", and ship backup first

backend.md treats "Cloud backup + sync" as one line item. They are two features
with very different costs:

|  | Backup | Sync |
|---|---|---|
| Direction | one-way push | bidirectional |
| Conflicts | impossible | the entire problem |
| Needs change detection on the server | no | yes |
| Delivers | "a dead laptop doesn't cost you work" | "laptop → desktop" |

Backup is roughly a third of the work and delivers the promise most people
actually buy the tier for. Sync is where the hard problems live, and every one
of them is easier once the storage layer already exists and is proven.

**Decided: build backup end to end first, then extend to sync.** The protocol
below is designed so sync is an extension rather than a rewrite — it needs a
precondition on commit and a merge policy, and nothing in the storage layer
changes. That extension is planned in [cloud-sync.md](./cloud-sync.md).

### B. Content-addressed blobs, not timestamped copies — SETTLED ✅

Confirmed in review: upload each file once, never re-upload unchanged content,
and treat removal as the only thing needing tracking. That is exactly what this
gives you.

backend.md proposes:

```
projects/[project-id]/versions/[timestamp]/app/page.tsx
projects/[project-id]/current/app/page.tsx
```

Every version stores a **full copy of every file**. A 200-file project synced
50 times stores 10,000 objects, nearly all identical. Storage grows with
`versions × project size` regardless of how little changed.

**Proposed instead:** store file *content* keyed by its own SHA-256, and store
*structure* as a manifest in Postgres.

```
blobs/<userId>/<projectId>/<sha256>   ← content, written once, never rewritten
```

```jsonc
// a manifest, in Postgres — this is what a version actually is
{ "app/page.tsx": "a3f2…", "app/page.module.css": "9c1b…" }
```

What this buys:

- **Deduplication is automatic.** An unchanged image across 50 versions is one
  object, not 50 copies.
- **Version history becomes nearly free** — a version is a manifest row, not a
  copy of the project. That converts backend.md's "version history (can come
  later, depends on storage costs)" from a cost question into a UI question.
- **Transfers shrink.** The client sends a manifest; the server replies with
  only the hashes it lacks. Unchanged files never leave the machine.
- **Integrity is checkable.** The key *is* the checksum.

Concretely: a 200-file project with 40 MB of images, synced 50 times, is ~2 GB
under backend.md's layout and ~40 MB under this one.

**Namespacing: per project.** Blobs are keyed:

```
blobs/<userId>/<projectId>/<sha256>
```

This was the decision that removed the design's main cost. Because content is
never deleted when a file is removed (see Decision F), and blobs are scoped to
one project, **there is no garbage collection to build at all** — deleting a
project or an account is a prefix delete. No reference counting, no sweep job,
no orphan accumulation.

The trade is losing dedup when one user reuses an image across two of their own
projects. Minor, and worth it to delete an entire category of background
machinery. Dedup *within* a project across versions — the case that actually
matters for images — is fully preserved.

It also closes the poisoning hole: a client can only ever write into its own
project's namespace, so a bad hash cannot corrupt anyone else's data. That
matters because Decision C removes server-side hash verification.

### C. Upload direct to R2 via presigned URLs — REVISED ✅

*The original draft said the opposite. It assumed projects were text-only,
which was wrong: images are already common, and a project can be hundreds of MB.*

backend.md's original instinct was right: the Route Handler issues a presigned
R2 PUT URL and the client uploads **directly to R2**, with no Worker in the data
path.

Pushing multi-MB images through a Worker would mean buffering them against a
128 MB isolate limit, and server-side hash verification would require reading
the whole body before knowing whether to keep it. Direct upload avoids both.

Verified against the platform:

- Single-part presigned PUT handles objects up to ~5 GiB; multipart goes to
  ~5 TiB. **No design project comes close**, so multipart is a "later, if ever"
  item rather than day-one work.
- CORS is likely a non-issue — the Electron main process is not a browser
  context, so presigned PUTs should not trigger preflight. Confirm with whoever
  builds the client.

**The cost: server-side hash verification is no longer possible.** The Worker
never sees the bytes. I checked whether R2 could enforce it instead, and it
cannot — R2 supports SHA-256 only as a COMPOSITE checksum, not FULL_OBJECT, so
there is no way to make it reject a mismatched upload.

This is fully mitigated by the per-project namespacing in Decision B: a client
can only write into its own project's prefix, so a wrong hash corrupts only that
project's own history and nobody else's.

**Open sub-decision: uniform or hybrid.** Uniform means every file goes by
presigned URL — one batched request returns N URLs, the client PUTs them all in
parallel. Hybrid batches small text files through the Worker and reserves
presigned URLs for large images. Uniform is one code path instead of two;
recommended unless there is an objection.

Setup cost either way: presigned URLs need R2 S3 API credentials (Access Key ID
+ Secret) as Worker secrets, separate from the bucket binding.

### D. No Inngest needed for this slice

backend.md lists a `files/sync` Inngest job. With the design above, the server
does no long-running work: it compares hashes, writes small objects, updates
rows. Inngest earns its place for preview builds, which genuinely need to run
`next build` outside the request path.

**Recommendation: no Inngest for backup/sync.** One less service to stand up.

### E. Image compression — SETTLED ✅ (not this repo's problem)

**Resolved: the Electron app handles compression. The sync path does not touch
file contents at all** — it stores and returns exactly what is on disk.

The reasoning is kept below because it constrains *when* the app may compress.

| | Where it happens | Effect on backup |
|---|---|---|
| **Compress at import** | the app, when a user adds an image; the file *on disk* becomes the optimised one | none — backup faithfully stores whatever is on disk |
| **Compress at upload** | inside the sync path | **breaks restore fidelity** |

Images are already compressed, so shrinking a JPEG or PNG means *re-encoding*
it, which is lossy. Doing that in the sync path means:

- The local file's hash no longer matches the stored blob's, so every image
  reads as "changed" on the next push, defeating the change detection this whole
  design is built on.
- A restore returns a **degraded copy**, and if the machine died, the original
  is gone. "A dead laptop doesn't cost you work" is the promise this tier sells;
  handing back a re-encoded image quietly breaks it.

**The constraint this leaves on the client:** compress *before the file lands
on disk* (at import), not between reading the file and hashing it. Compressing
inside the upload step would move the problem rather than solve it — the
manifest would record the hash of the compressed bytes, so a restore would hand
back the re-encoded image and the on-disk original would be unrecoverable.

Everything downstream of the on-disk file is byte-exact, which is what the
Phase 4 `diff -r` checkpoint verifies.

Also available if useful: the `IMAGES` binding is already in `wrangler.jsonc`
from the OpenNext migration, so previews can transform on the fly without
storing derivatives at all.

### F. Retention: unlimited history — SETTLED ✅

Unlimited version history is part of the paid plan. Content is therefore never
deleted when a file is removed from a project: an older version's manifest still
references it, and that version must remain restorable.

Consequences, accepted deliberately:

- Storage grows monotonically per project. At $0.015/GB-month this is
  affordable, but it is unbounded — a user iterating on large images accumulates
  every version of every one, forever.
- Deleting a file frees nothing. If usage is ever surfaced in the UI, it should
  be described as "stored", not "used by your current project", or it will look
  like a bug.
- Storage is only ever reclaimed by deleting a whole project or account, which
  is a prefix delete (Decision B).

### G. Exclusions: `.gitignore` semantics — SETTLED ✅

The project's `.gitignore` governs what syncs, implemented with the `ignore`
npm package so nested files, negation (`!`), and directory semantics behave
exactly as git does.

Two things it does not cover on its own:

1. **Projects with no `.gitignore`.** Scamp creates the project folder rather
   than running `git init`, so many will not have one. A built-in default list
   is needed as the fallback.
2. **`node_modules` and `.git` are excluded unconditionally**, whatever the
   `.gitignore` says. 67,903 files is not something a user should be able to
   opt into by accident.

Worth watching: `.gitignore` means "keep this out of version control", which is
not the same as "do not back this up". People gitignore large binaries
*precisely because* git handles them badly — and those are exactly the files
someone would most want backed up. If that turns out to bite, the escape hatch
is a `.scampignore` that defaults to mirroring `.gitignore`.

### H. Gating: an admin switch until Stripe — SETTLED ✅ (revised)

Originally: build and test locally ungated, Stripe comes after this works, and
production launch requires both.

Revised: the gate is now real. `User.cloudEnabledAt` is the entitlement, and
`checkCanSync()` in `lib/api-auth.ts` returns `no-subscription` (a 402) when it
is null. Nothing sells it yet, so the only writer is `POST /api/account/cloud`,
which lets an **admin** switch cloud on for **their own account** with no
payment plan, from the dashboard. Stripe becomes the second writer of the same
column when it lands — see `lib/cloud.ts`.

Every sync endpoint still routes through that single helper, which is why
turning the gate on was one function body rather than an audit of every route.

---

## 5. Proposed data model

```prisma
model Project {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  versions  ProjectVersion[]

  @@index([userId])
}

/// One push. The manifest is the whole state of the project at that moment,
/// which is what makes version history fall out for free.
model ProjectVersion {
  id         String   @id @default(cuid())
  projectId  String
  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  manifest   Json     // { "app/page.tsx": "<sha256>", … }
  fileCount  Int
  totalBytes Int
  createdAt  DateTime @default(now())
  /// Which machine pushed it — needed for the "changes from another machine"
  /// banner later.
  deviceId   String?

  @@index([projectId, createdAt])
}

/// Sizes only, so a user's storage total can be shown without listing R2.
/// No refCount: nothing is ever garbage collected (Decisions B and F).
model Blob {
  projectId String
  hash      String
  size      Int
  createdAt DateTime @default(now())

  @@id([projectId, hash])
}
```

Note there is no `ProjectFile` table. Files live in the manifest JSON, so a
push writes one row instead of N.

---

## 6. Proposed sync protocol

Three round trips, only changed content on the wire.

```
1. Client walks the project, applying .gitignore, and hashes what remains
   POST /api/projects/:id/push/prepare   { manifest }
   → 200 { uploads: { "a3f2…": "<presigned PUT url>", … } }
                                         only the hashes the server lacks

2. Client PUTs those blobs DIRECTLY TO R2, in parallel — no Worker involved
   PUT  <presigned url>                  body = raw file bytes

3. Client commits
   POST /api/projects/:id/push/commit    { manifest, deviceId }
   → 201 { versionId, createdAt }        manifest + blob sizes recorded
```

Pull is the mirror image:

```
GET /api/projects/:id/manifest?version=latest → { manifest }
GET /api/projects/:id/blobs/:hash             → 302 to a presigned GET url
```

Properties worth noting:

- **Interruption-safe.** Blobs are content-addressed and immutable, so a failed
  push leaves orphans, never corruption. Re-running resumes.
- **Idempotent.** Uploading a blob that exists is a no-op.
- **Hashes are not verified server-side** (Decision C — R2 cannot enforce
  SHA-256 on PUT). Per-project namespacing contains the blast radius to that
  project's own history.
- **Step 1 is the only place ignore rules are applied.** The server stores what
  the manifest says; deciding what belongs in a project is the client's job.

### How sync would extend this

Moved to [cloud-sync.md](./cloud-sync.md). In short: `push/commit` gains a
`baseVersionId` precondition and returns `409` when stale, and the client
reconciles. Nothing in the storage layer changes.

---

## 7. Phases

**Phase 1 — Storage layer. DONE ✅**
R2 binding (`BLOBS`) in `wrangler.jsonc`, the Prisma models above + migration,
and `lib/blob-store.ts`.

*Checkpoint passed* — `node scripts/check-blob-store.mjs` against `next dev`:
text, UTF-8, a 2 MiB random binary, a PNG-like binary and an empty file all
round-trip byte-identically, and the URL capability rejects signature reuse on
another key, unsigned URLs, and expired URLs.

**One thing the plan did not anticipate: presigning cannot work locally.**
Presigned URLs are an S3-API feature needing R2's real endpoint and
credentials, and miniflare emulates the Workers *binding*, not the S3 HTTP API.
So `blobStore` has two implementations behind one interface, both returning an
opaque URL the client PUTs to:

| | Upload URL points at | Bytes through the Worker? |
|---|---|---|
| Production (R2 S3 creds set) | R2 directly, genuinely presigned | no |
| Local dev (no creds) | `/api/blobs/direct`, HMAC-signed, 15 min TTL | yes |

The client cannot tell them apart, so it is written once. The local route
authorises on the URL token rather than the session, which mirrors
presigned-URL semantics exactly: the URL is the capability, it covers one key,
and it expires.

**Untested: the production presigning path.** It has never executed — there are
no R2 credentials yet. Same status as the Neon adapter branch from the auth
phase, and it needs a real bucket to verify.

Also needed before deploy: create the `scamp-project-blobs` bucket, and set
`R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID` and
`R2_SECRET_ACCESS_KEY` as Worker secrets. Absent those, `presignPut` silently
falls back to routing uploads through the Worker — correct, but not the
intended production behaviour.

**Phase 2 — Project CRUD. DONE ✅**
`GET`/`POST /api/projects`, `GET`/`PATCH`/`DELETE /api/projects/:id`, plus
`lib/api-auth.ts` holding the `assertCanSync()` gate from Decision H.

*Checkpoint passed* — `node scripts/check-projects.mjs` creates two real
accounts and has one attempt every verb against the other's project. 17 checks:
ownership, cross-user access, unauthenticated access, validation, and lifecycle.

Two things worth carrying forward:

- **Ownership is part of the query, not a check after it.** There is no code
  path that loads a project by id alone (`findFirst({ where: { id, userId } })`),
  so "forgot to check the owner" is not a mistake that can be made here.
- **Cross-user access returns 404, never 403.** A 403 would confirm the id
  exists. The checkpoint asserts the status code, not just the failure.

`DELETE` is the only operation that removes blobs, and it prefix-deletes R2
*before* deleting the row — a failure then leaves rows pointing at absent
objects, which a retry fixes, rather than objects with nothing pointing at
them, which would be an invisible leak.

**Found while testing, relevant to the Electron client:** Better Auth rejects
requests whose `Origin` header is present-but-null with
`MISSING_OR_NULL_ORIGIN`. Node's `fetch` sends exactly that, while `curl` sends
no `Origin` at all and is allowed. **The client must send a real `Origin`
matching `BETTER_AUTH_URL`.**

**Phase 3 — Push (backup). DONE ✅**
`POST /api/projects/:id/push/prepare` and `.../commit`, `lib/manifest.ts` for
validation, plus `scripts/fake-client.mjs` — the reference implementation of the
protocol, and where `.gitignore` handling lives.

*Checkpoint passed* — `node scripts/check-push.mjs`, 18 checks:

```
ignore layer   265 files pushed, not the 67,903 in node_modules
               no node_modules / .git / .env paths in the manifest
first push     263 blobs for 265 files  (identical content deduped)
second push    ZERO blobs transferred, new version still recorded
accounting     2 versions, storage not doubled
rejections     path traversal · absolute path · bad hash · oversized
               manifest · commit of never-uploaded content (409)
isolation      another user cannot push to this project (404)
cleanup        project delete removed all 263 blobs from R2
```

Worth noting the 265-vs-263 gap: `app/favicon.ico`, `public/favicon.ico` and
`public/scamp-icon.png` are byte-identical, so three paths share one blob. Dedup
works *within* a single push, not just across versions. The first draft of the
checkpoint asserted `uploaded === fileCount` and failed — the assertion was
wrong, not the code.

Design points established here:

- **Ignore rules are applied only by the client.** The server validates shape
  and limits, never decides what belongs in a project. The 20,000-file cap
  exists to catch a broken ignore layer, and its error message says so.
- **Paths are validated server-side** against traversal, absolute paths,
  backslashes and control characters. A manifest path is later written to disk
  by the client, so an unsafe path here becomes a path traversal there.
- **Commit verifies every blob exists in R2 first**, returning `409` otherwise.
  Without it a client could record a version referencing content it never
  uploaded, and the failure would surface at restore — the worst possible
  moment to learn a backup is incomplete.
- **Sizes come from R2, never the client**, so storage accounting cannot be
  misreported.

**Phase 4 — Pull (restore). DONE ✅**
`GET /api/projects/:id/manifest` (with `?version=`), `GET .../versions`,
`POST .../pull/urls`, plus `pull` in the fake client.

*Checkpoint passed* — `node scripts/check-pull.mjs`, 12 checks:

```
fixture         diff -r clean: 3 MB binary, unicode filename, empty file,
                CRLF content, duplicate content at two paths, gitignored
                files correctly absent
past version    old version returns the ORIGINAL text and the ORIGINAL 3 MB
                binary byte-for-byte, while latest returns the new content
resumability    re-pull downloads 0 blobs when content is already on disk
repository      diff -r clean across 269 files
rejections      another user cannot read the manifest or get download URLs;
                absent content is reported missing rather than signed for
```

`diff -r` returning clean on binaries is the concrete proof that no lossy step
exists anywhere in the sync path (Decision E) — it is the check that would fail
first if compression were ever added on the server side.

Design points established here:

- **Restoring a past version is tested, not assumed.** It is the actual product
  promise, so the checkpoint pushes, changes two files including a 3 MB image,
  pushes again, then restores the first version and compares bytes.
- **Download URLs are batched**, mirroring `push/prepare`. Restoring a 300-file
  project is two API calls plus N direct transfers, not 300 API calls.
- **Pull is resumable for free.** Content addressing means anything already on
  disk with the right hash is skipped, so an interrupted restore continues
  rather than starting over.
- **The client verifies every downloaded blob's hash before writing it.**
  Corrupt content is refused rather than silently written over a good file.
- **URLs are only signed for content that exists.** Signing for an absent blob
  would produce an unexplained 404 mid-transfer; the response names the missing
  hashes instead.

**Phase 5 — Sync.** Split out to [cloud-sync.md](./cloud-sync.md).

**Version history — API done.** `GET /api/projects/:id/versions` lists history
and `GET .../manifest?version=<id>` restores any point in it, both verified by
the Phase 4 checkpoint. What remains is browsing UI, which is Electron-side.

**Not needed: garbage collection.** Decisions B and F remove it entirely.
Nothing is ever orphaned, because nothing is ever unreferenced while its project
exists, and deleting a project is a prefix delete.

---

## 8. How this gets tested without the Electron app

The client half will not exist for a while, so the plan is a **`scripts/fake-client.mjs`** that takes a
directory, hashes it, and drives the real protocol over HTTP. Same approach
that verified auth end to end via curl, one level up.

It doubles as the reference implementation for whoever writes the Electron
side, and as a regression test.

---

## 9. Still open

1. **Quotas.** The one unresolved item for backup. Storage cost is negligible,
   so this is abuse prevention rather than economics — but unlimited history
   plus large images means an account can grow without bound, and nothing else
   ever frees space. A generous cap is far easier to set now than to impose on
   people already over it.
2. **Conflict policy** — moved to [cloud-sync.md](./cloud-sync.md), where it is
   the blocking decision.

### Before this reaches users

Not blockers for the code, but nothing here is usable in production without
them:

- **The deploy phase** in [auth-setup-phase-1.md](./auth-setup-phase-1.md):
  Neon, the Cloudflare adapter config, and secrets.
- **An R2 bucket** plus the four `R2_*` secrets. Without them uploads silently
  fall back to routing through the Worker — correct, but not the intended
  production path, and **the presigned-URL code has never executed**.
- **Stripe**, since the only way to get cloud today is the admin switch (H).
- **Rate limiting**, which is stored in memory by default and therefore does not
  work on Workers (see the auth plan).

**Settled in review:** backup ships before sync (A); content-addressed blobs
namespaced per project, no GC (B); uploads go direct to R2 via presigned URLs,
uniform path (C); no Inngest (D); compression is the client's job and the sync
path is byte-exact (E); unlimited history, nothing ever deleted (F);
`.gitignore` semantics with a hard `node_modules` / `.git` floor (G); gated on
`cloudEnabledAt`, which only the admin switch writes until Stripe (H).
