# Backup: push and pull

How a project gets to the cloud and back. This is the part worth understanding
properly before writing a client.

## The model

Two things are stored separately:

- **Content** — each file's bytes, keyed by the SHA-256 of those bytes.
  Immutable, written once, never modified.
- **Structure** — a **manifest**: a map of relative path to content hash. This
  is what a version *is*.

```json
{
  "home.tsx": "24a5869c567a43ccb99ee3036ff533d5fdce1e88bbd362dabedeb2268eaa73ed",
  "home.module.css": "5f9f4387102e507558f3edeb31ec94b6e408d6c85321c669b1a131d54f9815ee"
}
```

Three consequences that shape the whole API:

1. **Unchanged content is never re-uploaded.** The server already has the hash.
2. **A version costs one row**, not a copy of the project — which is why
   unlimited history is affordable.
3. **Identical files are stored once**, whether they are two paths in one
   project or the same file across fifty versions.

## What the client decides

**The server never decides what belongs in a project.** It validates shape and
limits; the client walks the directory and applies ignore rules.

The reference client (`scripts/fake-client.mjs`) uses `.gitignore` semantics via
the [`ignore`](https://www.npmjs.com/package/ignore) package, plus a hard floor
that is excluded no matter what `.gitignore` says:

```
node_modules  .git  .next  .open-next  .DS_Store
```

`node_modules` is non-negotiable: it is ~68,000 files, it is regenerable, and
Scamp already runs `npm install` on first preview, so a restored project rebuilds
it. Excluding it takes a typical project from 400 MB to a few MB.

Projects with no `.gitignore` fall back to a built-in default list.

> The reference client reads only the **root** `.gitignore`. Git also honours
> nested ones in subdirectories; that is not implemented.

Check what would be sent without pushing:

```bash
node scripts/fake-client.mjs scan ./my-project
#   ignore source : .gitignore
#   would upload  : 264 files, 4.64 MB
#   entries skipped: 11
```

---

## Push

Three steps: ask what is missing, upload it, commit.

### 1. Prepare

```http
POST /api/projects/{id}/push/prepare
Content-Type: application/json

{ "manifest": { "home.tsx": "24a5869c…", "home.module.css": "5f9f4387…" } }
```

```json
200
{
  "uploads": {
    "24a5869c…": "http://localhost:3000/api/blobs/direct?key=…&expires=…&sig=…",
    "5f9f4387…": "http://localhost:3000/api/blobs/direct?key=…&expires=…&sig=…"
  },
  "have": 0,
  "missing": 2,
  "direct": false
}
```

`uploads` contains a URL **only for content the server does not have**. Pushing
an unchanged project returns `{}` and the push transfers nothing.

- `have` / `missing` — counts, for progress reporting
- `direct` — whether those URLs point at object storage (`true`) or back at the
  API (`false`). Diagnostic only; the client behaves identically either way.

### 2. Upload

`PUT` the raw bytes to each URL. No auth header, no JSON — **the URL is the
credential**.

```js
await fetch(url, { method: "PUT", body: fileBytes });   // 201
```

Notes:

- URLs expire after **15 minutes**. On a slow connection, re-run prepare for
  what remains.
- Each URL is valid for exactly one content hash. It cannot be reused for
  another.
- Upload in parallel; the reference client uses 16 at a time.
- Content is addressed by hash, so two paths with identical content produce one
  entry in `uploads` and one upload.
- Uploading something already present is harmless.

### 3. Commit

```http
POST /api/projects/{id}/push/commit
Content-Type: application/json

{ "manifest": { "…": "…" }, "deviceId": "laptop-01" }
```

```json
201
{
  "versionId": "cmst5lxdh000ju8zodlkbkf8m",
  "createdAt": "2026-08-14T16:20:55.733Z",
  "fileCount": 2,
  "totalBytes": 53
}
```

`deviceId` is optional and free-form.

**Commit verifies every hash actually exists in storage first.** If any is
missing:

```json
409
{
  "error": "Cannot commit: some content was never uploaded",
  "missing": ["cccc…"],
  "missingCount": 1
}
```

This check exists so an incomplete backup fails now rather than at restore time,
which is the worst possible moment to discover it. On a `409`, upload the listed
hashes and commit again.

Sizes are read from storage, never taken from the request, so storage accounting
cannot be misreported by a client.

### Interruptions

Safe at any point. Content is immutable and content-addressed, so a failed push
leaves unreferenced content, never corruption. Re-running resumes: prepare will
report the already-uploaded content as `have`.

---

## Pull

Two steps: fetch a manifest, download what you are missing.

### Get a manifest

```http
GET /api/projects/{id}/manifest              # latest
GET /api/projects/{id}/manifest?version=cmst5lxdh000ju8zodlkbkf8m
```

```json
200
{
  "versionId": "cmst5lxdh000ju8zodlkbkf8m",
  "createdAt": "2026-08-14T16:20:55.733Z",
  "fileCount": 2,
  "totalBytes": 53,
  "deviceId": "laptop-01",
  "manifest": { "home.tsx": "24a5869c…", "home.module.css": "5f9f4387…" }
}
```

Omitting `version` gives the newest. Passing one restores that exact point in
history — this is the same endpoint for "restore my project" and "roll back to
last Tuesday".

Returns `404` if the project or version does not exist, or belongs to someone
else.

### Get download URLs

```http
POST /api/projects/{id}/pull/urls
Content-Type: application/json

{ "hashes": ["24a5869c…", "5f9f4387…"] }
```

```json
200
{ "downloads": { "24a5869c…": "https://…", "5f9f4387…": "https://…" }, "missing": [] }
```

Send only the hashes you do not already have on disk. Batched deliberately:
restoring a 300-file project is two API calls plus N transfers, not 300 API
calls.

`missing` lists any hash with no content behind it. It should always be empty —
if it is not, that version cannot be fully restored, and the server says so
rather than handing out a URL that 404s mid-transfer.

### Download

`GET` each URL for the raw bytes. Same 15-minute expiry.

**Verify the hash before writing.** The reference client hashes each download
and refuses to write on mismatch, rather than silently overwriting a good file
with corrupt content.

### Restore is resumable for free

Content addressing means a client can hash what is already on disk and skip
anything that matches. An interrupted restore continues instead of starting
over — which matters for a large project on a bad connection. The reference
client does this and reports it:

```
  11 file(s) already correct on disk
  restored 0 file(s) from 0 blob(s) in 0.1s
```

---

## Worked example

```js
import { createHash } from "node:crypto";

const ORIGIN = "http://localhost:3000";
const call = (path, init = {}) =>
  fetch(`${ORIGIN}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", origin: ORIGIN, cookie, ...init.headers },
  });

// 1. build a manifest
const manifest = {};
for (const [path, bytes] of files) {
  manifest[path] = createHash("sha256").update(bytes).digest("hex");
}

// 2. ask what is missing
const { uploads } = await (
  await call(`/api/projects/${projectId}/push/prepare`, {
    method: "POST",
    body: JSON.stringify({ manifest }),
  })
).json();

// 3. upload only that
for (const [hash, url] of Object.entries(uploads)) {
  await fetch(url, { method: "PUT", body: bytesForHash(hash) });
}

// 4. commit
const version = await (
  await call(`/api/projects/${projectId}/push/commit`, {
    method: "POST",
    body: JSON.stringify({ manifest, deviceId: "laptop-01" }),
  })
).json();
```

## Not yet supported

- **Two machines pushing the same project will not merge.** The second push
  records a newer version; nothing detects that it was based on stale state and
  nothing warns. Cross-machine sync is planned, not built — see
  `plans/cloud-sync.md`.
- **Deletions do not propagate on pull.** A file absent from the manifest is
  simply not written; an existing local copy is left alone.
- **No partial or subdirectory push.** A manifest is always the complete project.
- **No server-side compression or transformation.** Bytes come back exactly as
  they went in, binaries included — this is verified by `scripts/check-pull.mjs`
  using `diff -r`. Image optimisation belongs in the client, at import time,
  before a file is hashed.
