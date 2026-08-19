# Authentication

Handled by [Better Auth](https://www.better-auth.com), mounted at
`/api/auth/*`. Accounts live in Scamp's own Postgres — there is no external
identity provider.

Email and password only. OAuth, email verification, and password reset are not
built.

> Every request needs an `Origin` header. See
> [conventions.md](./conventions.md#the-origin-header-is-required) — it is the
> most common way to get stuck.

## Sign up

```http
POST /api/auth/sign-up/email
Content-Type: application/json
Origin: http://localhost:3000

{
  "name": "Angie",
  "email": "angie@example.com",
  "password": "correct-horse-battery",
  "role": "designer"
}
```

`role` is what the person does, asked once at sign-up. One of:

```
designer · developer · product-manager · marketer · student · other
```

Anything else is rejected:

```json
400
{
  "message": "Invalid option: expected one of \"designer\"|\"developer\"|...",
  "code": "VALIDATION_ERROR"
}
```

**It is optional at the API level** and nullable in the database, even though
the sign-up form requires it. `null` means the account was created before the
field existed and was never asked — distinct from someone choosing "other".
Anything reporting on roles should treat those as different, not merge them.

```json
200
{
  "token": "tNDPRHU5SAshtw1H0hMJhOgxXOXGNdeU",
  "user": {
    "id": "DJI3abgewqxUX7EiKs2KAVuYQYUqieuh",
    "name": "Angie",
    "email": "angie@example.com",
    "role": "designer",
    "emailVerified": false,
    "image": null,
    "createdAt": "2026-08-14T16:20:55.230Z",
    "updatedAt": "2026-08-14T16:20:55.230Z"
  }
}
```

Sets a `better-auth.session_token` cookie. The account is usable immediately —
`emailVerified` is always `false` because verification is deliberately switched
off until transactional email is wired up.

Minimum password length is 8 characters.

## Sign in

```http
POST /api/auth/sign-in/email
Content-Type: application/json
Origin: http://localhost:3000

{ "email": "angie@example.com", "password": "correct-horse-battery" }
```

Returns the same shape as sign up and sets the same cookie. Wrong credentials
return `401`.

## Current session

```http
GET /api/auth/get-session
Origin: http://localhost:3000
Cookie: better-auth.session_token=...
```

```json
200
{
  "session": {
    "id": "G6UGIQEt2ab0Li9wtoA1TIj1XKPdj0af",
    "token": "tNDPRHU5SAshtw1H0hMJhOgxXOXGNdeU",
    "userId": "DJI3abgewqxUX7EiKs2KAVuYQYUqieuh",
    "expiresAt": "2026-08-21T16:20:55.249Z",
    "ipAddress": "127.0.0.1",
    "userAgent": "node",
    "createdAt": "2026-08-14T16:20:55.249Z",
    "updatedAt": "2026-08-14T16:20:55.249Z"
  },
  "user": { "...": "as above" }
}
```

Returns `200` with `null` when there is no valid session — **not** a 401. Check
the body, not the status.

## Sign out

```http
POST /api/auth/sign-out
Content-Type: application/json
Origin: http://localhost:3000
Cookie: better-auth.session_token=...

{}
```

```json
200
{ "success": true }
```

Clears the cookie and invalidates the session server-side.

**Send the `{}` body.** This endpoint takes no parameters, so an empty body is
the obvious thing to write, and it fails:

| Request | Result |
|---|---|
| `Content-Type: application/json`, no body | `400 { "message": "Invalid JSON in request body", "code": "BAD_REQUEST" }` |
| No `Content-Type` header | `415 { "code": "UNSUPPORTED_MEDIA_TYPE" }` |
| `Content-Type: application/json` + `{}` | `200 { "success": true }` |

## Sessions

- Lifetime is **7 days** from creation
- Carried in the `better-auth.session_token` cookie
- Every sign-in creates a new session row; signing in on a second machine does
  not invalidate the first

## No bearer tokens yet

**The API accepts session cookies only.** There is no `Authorization: Bearer`
support.

This matters for the desktop client. `plans/backend.md` describes the intended
flow — the app opens a browser to sign in, the site redirects to
`scamp://auth/callback?token=…`, and the app stores a JWT in `safeStorage` and
sends it as a bearer token. **None of that exists.** Better Auth has a bearer
plugin that would slot in behind `lib/api-auth.ts` without changing any route,
but it has not been added.

Until then a desktop client has to hold the session cookie itself.

## Password storage

Passwords are hashed with **scrypt** (`N=16384, r=16, p=1, dkLen=64`) and a
16-byte random salt per password, stored as `salt:hash` hex. Plaintext is never
stored, and two accounts with the same password produce different hashes.

Two caveats worth knowing rather than discovering later:

- The work factor is roughly 4× below OWASP's recommended scrypt parameters.
  Strong, but not at the current recommended bar.
- Password comparison is not constant-time. A theoretical timing side channel,
  low practical risk.

## Error shapes

Auth errors come from Better Auth and do **not** use this API's `{ "error": … }`
shape:

```json
403  { "message": "Missing or null Origin", "code": "MISSING_OR_NULL_ORIGIN" }
```

Handle both shapes in client code.
