# Projects

A project is a named container owned by exactly one user. It holds version
history and the content backing it.

All endpoints require a session. All of them scope by owner: a project belonging
to someone else returns `404`, never `403`
([why](./conventions.md#404-never-means-403)).

## List

```http
GET /api/projects
```

```json
200
{
  "projects": [
    {
      "id": "cmst5lx2u000iu8zo12reigmf",
      "name": "Docs demo",
      "createdAt": "2026-08-14T16:20:55.350Z",
      "updatedAt": "2026-08-14T16:20:55.350Z"
    }
  ]
}
```

Newest activity first (`updatedAt` descending). Not paginated — projects per
user are expected to be few.

## Create

```http
POST /api/projects
Content-Type: application/json

{ "name": "My site" }
```

```json
201
{ "project": { "id": "cmst5lx2u000iu8zo12reigmf", "name": "My site", "createdAt": "…", "updatedAt": "…" } }
```

`name` is required, trimmed, and capped at 200 characters. Names are **not**
unique — two projects may share one, so always key off `id`.

Errors: `400 { "error": "name is required" }`

## Get one

```http
GET /api/projects/{id}
```

```json
200
{
  "project": {
    "id": "cmst5lx2u000iu8zo12reigmf",
    "name": "Docs demo",
    "createdAt": "2026-08-14T16:20:55.350Z",
    "updatedAt": "2026-08-14T16:20:55.771Z",
    "versionCount": 1,
    "storedBytes": 53
  }
}
```

Two fields appear here that the list endpoint omits:

- **`versionCount`** — how many pushes this project has.
- **`storedBytes`** — bytes held in object storage for this project.

### storedBytes is "stored", not "used"

Label it carefully in any UI. Because history is unlimited and content is never
deleted when a file is removed, **this number only ever grows**. A user who
deletes a 50 MB image will see no change, because an earlier version still
references it and must stay restorable.

It is also *smaller* than the sum of each version's `totalBytes`, since
identical content is stored once no matter how many versions or paths reference
it. Calling it "used by your project" would read as a bug in both directions.

The only thing that reduces it is deleting the project.

## Rename

```http
PATCH /api/projects/{id}
Content-Type: application/json

{ "name": "Renamed" }
```

Returns the updated project. Same validation as create.

## Delete

```http
DELETE /api/projects/{id}
```

```json
200
{ "deleted": true, "blobsDeleted": 2 }
```

**Irreversible, and it removes everything**: every version, every stored file,
all history. There is no soft delete and no undo.

`blobsDeleted` is the number of stored objects removed, which is the count of
*unique content*, not files — identical files share one object, so this is
usually a little below the project's file count.

Object storage is cleared before the database row. A failure part-way leaves
rows pointing at content that is already gone, which retrying the delete
resolves — the reverse order would leave orphaned content with nothing pointing
at it, which nothing would ever clean up.

## Version history

```http
GET /api/projects/{id}/versions?limit=50&before=2026-08-14T16:20:55.733Z
```

```json
200
{
  "versions": [
    {
      "id": "cmst5lxdh000ju8zodlkbkf8m",
      "createdAt": "2026-08-14T16:20:55.733Z",
      "fileCount": 2,
      "totalBytes": 53,
      "deviceId": "laptop-01"
    }
  ]
}
```

Newest first. `limit` defaults to 50, maximum 100. `before` is an ISO timestamp
for paging backwards through history.

Manifests are excluded here because they can be large — fetch one at a time from
[the manifest endpoint](./backup.md#get-a-manifest).

- **`totalBytes`** is the size of that version's files as they exist on disk.
  Summing it across versions does **not** give storage used; use `storedBytes`
  from the project endpoint.
- **`deviceId`** is whatever the client sent at push time. It is free-form and
  entirely client-supplied, so treat it as a label rather than an identity.
  Nothing validates or assigns it yet.

History is unlimited by design. Nothing prunes it.
