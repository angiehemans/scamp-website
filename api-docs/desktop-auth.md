# Desktop sign-in

How the Electron app gets a credential it can send to this API.

Answers items 1–4 of the checklist from the app side. Items 5 (macOS signing)
and 6 (OS routing on three platforms) are the app's, and nothing here changes
them.

---

## The flow

```
app                        browser                     this backend
 │
 │ verifier  = random 43-128 chars   (never leaves the app)
 │ challenge = base64url(sha256(verifier))
 │ state     = random
 │
 ├─ open ──────────────────►
 │   /sign-in?desktop=1
 │     &redirect_uri=scamp://auth/callback
 │     &state=…&code_challenge=…
 │                            │
 │                            ├─ user signs in ──────────►  session cookie
 │                            │
 │                            ├─ POST /api/desktop/authorize ──►
 │                            │      { redirectUri, state,
 │                            │        codeChallenge,
 │                            │        codeChallengeMethod:"S256" }
 │                            │◄───── { callbackUrl }
 │                            │
 │◄─ OS routes ───────────────┤  scamp://auth/callback?code=…&state=…
 │
 ├─ check state matches what it sent, else abort
 │
 ├─ POST /api/desktop/token ────────────────────────────────►
 │      { code, codeVerifier }
 │◄───── { token, user }
 │
 └─ every API call:  Authorization: Bearer <token>
```

---

## 1. Redirect allowlist ✅

`scamp://auth/callback` is permitted. So are
`http://localhost:8976/callback` and `http://127.0.0.1:8976/callback`, if a dev
build would rather run a loopback listener than register a scheme — easier to
iterate on, and it sidesteps OS routing while you are still building.

The list is exact string matching, not prefix. `scamp://other` and
`scamp://auth/callback/../elsewhere` are both refused. Adding a value means
editing `ALLOWED_REDIRECTS` in `lib/desktop-auth.ts` and deploying; there is no
wildcard and there will not be one, because a loose match here turns the sign-in
page into an open redirect that hands out auth codes.

## 2. `state` echoed back ✅

Returned verbatim on the callback. Must be 8–256 characters; the request is
refused otherwise, so a missing or trivial `state` fails loudly rather than
silently weakening the flow.

**But do not rely on `state` alone.** Your note said the callback is spoofable
without it, which is right, and it is still spoofable *with* it — `state` proves
the callback belongs to a request the app made, not that only the app can use
it. Any application on the machine can register `scamp://`, and on Windows and
Linux the last registrant generally wins.

So the callback carries a **code**, never a token, and the code cannot be
redeemed without the verifier. That is PKCE (RFC 7636), and it is why item 2 is
answered by more than an echo. An interceptor that reads the callback URL gets
something it cannot spend.

Verified in `scripts/check-desktop-auth.mjs`:

```
✓ callback carries NO session token
✓ cannot redeem with a different verifier
✓ cannot replay the challenge as the verifier
✓ a wrong guess burns the code for everyone
✓ the same code cannot be redeemed twice
```

## 3. The token contract

**It is not a JWT.** `/api/desktop/token` returns a Better Auth **session
token** — an opaque string backed by a row in the `session` table.

That is a deliberate choice over the JWT plugin, which is also available:

|  | session token (chosen) | JWT |
|---|---|---|
| Revocation | immediate, delete the row | not until expiry |
| Verification | database lookup | signature only |
| Key management | none | JWKS, rotation |
| Offline validation | no | yes |

Every API call already reaches our own database, so the lookup is free, and
being able to revoke a stolen desktop token *now* is worth more than offline
verification we have no use for. If you later need a third party to verify
without calling us, say so and the JWT plugin can be added alongside.

**Claims:** none — it is opaque. `/api/desktop/token` returns
`{ id, name, email, emailVerified }` alongside the token so the app can show who
is signed in without a second call. **Do not treat that as authority**; it is
display data. The server re-checks on every request.

**Lifetime:** Better Auth's default session expiry (30 days), refreshed on use.
There is no separate refresh token. A token used regularly keeps working; one
left unused past expiry stops, and the app should treat a `401` as "sign in
again" rather than trying to refresh.

**Revocation:** signing out on the web, or deleting the session row, kills the
desktop token too. Worth knowing before you wire a "sign out everywhere" button.

## 4. Sign-in URL per environment

Agreed on an env var with a production default, so a dev build cannot reach
production by accident:

```
SCAMP_AUTH_BASE_URL   default: https://www.scamp.club
```

Local development points it at `http://localhost:3000`. The full URL the app
opens is:

```
${SCAMP_AUTH_BASE_URL}/sign-in?desktop=1
  &redirect_uri=<one of the allowlisted values>
  &state=<random>
  &code_challenge=<base64url sha256 of verifier>
  &code_challenge_method=S256
```

`/sign-up` takes the same parameters, so someone without an account completes
the handoff in one pass instead of signing up and starting again.

---

## Testing locally

The backend needs `npm run dev` on port 3000. Then, from this repo:

```bash
node scripts/check-desktop-auth.mjs
```

That drives the whole flow the way the app will — verifier, browser sign-in,
code redemption, bearer call — and asserts the interception properties above.
Read it as a reference implementation; it is about eighty lines of the app's
logic in Node.

**Nothing here is deployed yet.** It exists on the `backend-setup` branch and
runs locally. Say when you want it live and it ships with the next deploy.

---

## An alternative worth considering

If the OS routing in item 6 turns out to be painful — and the already-running
case on Windows and Linux usually is — the **device authorization flow** removes
it entirely:

```
app shows:  "Go to scamp.club/link and enter  WDJB-MJHT"
app polls:  POST /api/desktop/poll  until approved
```

No custom scheme, no URL interception, no OS routing, identical on all three
platforms. Items 1, 2 and 6 stop existing. The cost is that the person types a
short code instead of the browser bouncing back automatically.

Better Auth ships a `device-authorization` plugin, so it is a comparable amount
of backend work to what is already here. Not building it unless you want it —
just do not spend a week on item 6 without knowing this exists.
