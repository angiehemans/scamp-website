# Conventions

Everything that applies across the whole API. Worth reading before the endpoint
docs — two of these will otherwise cost you an afternoon.

## Base URL

Local development only:

```
http://localhost:3000
```

## The Origin header is required

**Every request must send an `Origin` header matching the configured
`BETTER_AUTH_URL`.** This is the single most common way to get stuck.

```
Origin: http://localhost:3000
```

Without it:

```json
403  { "message": "Missing or null Origin", "code": "MISSING_OR_NULL_ORIGIN" }
```

The subtlety: this triggers on an Origin that is *present but null*, which is
what a bare `fetch()` from Node sends. `curl` sends no Origin header at all and
is allowed through. So a request can work from curl and fail from Node with
identical-looking code.

```js
// fails with 403
await fetch(url, { method: "POST", body });

// works
await fetch(url, { method: "POST", body, headers: { origin: "http://localhost:3000" } });
```

The desktop client must set this explicitly.

## Content type

Request bodies are JSON. Send `Content-Type: application/json`. A malformed body
returns `400 { "error": "Body must be JSON" }`.

The auth endpoints are stricter than the rest of the API: they **require** the
header even when there is nothing to send, and reject an absent body rather than
treating it as empty.

| | Auth endpoints | Everything else |
|---|---|---|
| Missing `Content-Type` | `415 UNSUPPORTED_MEDIA_TYPE` | accepted |
| Empty body on a POST | `400 BAD_REQUEST` | `400 { "error": "Body must be JSON" }` |

So a parameterless call like sign-out still needs `Content-Type:
application/json` and a literal `{}`.

The exception is blob upload and download, which transfer raw bytes to a URL the
API hands you — see [backup.md](./backup.md).

## Errors

Errors from this API are:

```json
{ "error": "human readable message" }
```

Errors from the auth endpoints come from Better Auth and use a different shape:

```json
{ "message": "...", "code": "SOME_CODE" }
```

| Status | Meaning |
|---|---|
| `400` | Malformed request — bad JSON, missing field, invalid path or hash |
| `401` | No valid session |
| `402` | Scamp Cloud is not switched on for this account — see below |
| `403` | Origin rejected, an expired/invalid blob URL, or an **unverified email address** — see below |
| `404` | Not found **or not yours** — see below |
| `409` | Conflict — committing content that was never uploaded |

### Unverified accounts

Cloud backup requires a confirmed email address. An unverified account can sign
in and use the site normally, but every `/api/projects/*` endpoint returns:

```json
403
{
  "error": "Verify your email address before using cloud backup. ...",
  "code": "EMAIL_NOT_VERIFIED"
}
```

Check `code`, not the message. A client seeing `EMAIL_NOT_VERIFIED` should
prompt the user to check their inbox rather than treat it as a hard failure —
the block lifts as soon as they click the link, with no further action.

Sign-in itself is never blocked. Locking people out entirely would strand
anyone whose verification email went astray, with no way to request another.

### Accounts without Cloud

A verified account still needs Scamp Cloud switched on before any
`/api/projects/*` endpoint will serve it. Without it, every one of them returns:

```json
402
{
  "error": "Scamp Cloud is not switched on for this account. ...",
  "code": "PRO_REQUIRED"
}
```

There is no billing yet, so today the only way to get it is the switch on the
dashboard, which admin accounts can use for their own account with no payment
plan. A paid subscription will grant the same thing once Stripe exists; the
error code is already named for that world so clients need not change.

The switch itself is `POST /api/account/cloud` with `{ "enabled": true }` or
`{ "enabled": false }`, and it returns `{ "cloud": { "enabled", "since" } }`.
It is `404` for anyone who is not an admin — a `403` would confirm there is
something there — and `400` for a non-boolean `enabled`. It only ever changes
the caller's own account.

### 404 never means 403

**A resource belonging to another user returns `404`, not `403`.** A 403 would
confirm the ID exists, which leaks whether a given project is real. Client code
must not treat 404 as "definitely deleted" — it means "not available to you".

## Authentication

Session cookie, set at sign-in and sent automatically by browsers. See
[authentication.md](./authentication.md).

## IDs

| Thing | Format | Example |
|---|---|---|
| User | 32-char alphanumeric (Better Auth) | `DJI3abgewqxUX7EiKs2KAVuYQYUqieuh` |
| Project | cuid | `cmst5lx2u000iu8zo12reigmf` |
| Version | cuid | `cmst5lxdh000ju8zodlkbkf8m` |
| Content hash | sha256, lowercase hex, 64 chars | `24a5869c…73ed` |

Treat all of them as opaque strings.

## Timestamps

ISO 8601 with milliseconds, always UTC:

```
"2026-08-14T16:20:55.733Z"
```

## Byte counts

Byte totals are JSON numbers, not strings. They are stored as 64-bit integers
server-side and converted on the way out, so a project would need to exceed
`Number.MAX_SAFE_INTEGER` (~9 PB) before precision mattered.

## Limits

| Limit | Value | Applies to |
|---|---|---|
| Files per manifest | 20,000 | push and pull |
| Path length | 1,024 characters | manifest paths |
| Project name | 200 characters | create, rename |
| Versions per page | 100 (default 50) | version listing |
| Blob URL lifetime | 15 minutes | upload and download URLs |

The 20,000-file cap is an abuse limit, not a product limit — a real project is
hundreds of files. **Hitting it almost always means the client's ignore rules
are not working**, and the error message says so, since `node_modules` alone is
around 68,000 files.

## Path rules

Manifest paths are relative POSIX paths. These are rejected with `400`:

- absolute paths (`/etc/passwd`)
- drive letters (`C:\...`)
- backslashes
- any `..` segment
- empty or `.` segments
- control characters

The reason is not tidiness: these paths are later written to disk by a client,
so an unsafe path stored here becomes a path traversal there.

## Rate limiting

Better Auth's rate limiting is **disabled in development** and enabled in
production, where the sign-in endpoint allows 3 requests per 10 seconds. Its
default store is in-memory, which does not work across Workers isolates — this
is a known gap, tracked in `plans/auth-setup-phase-1.md`.

The project and backup endpoints have no rate limiting at all.
