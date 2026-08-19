# Scamp API

Developer documentation for the Scamp cloud API — accounts, projects, and
project backup.

> **Status: local development only.** Nothing here is deployed. There is no
> public base URL yet, and the API has only ever run against `localhost:3000`.
> See [Deployment status](#deployment-status).

| Document | Covers |
|---|---|
| [conventions.md](./conventions.md) | Errors, status codes, limits, ID formats — **read this first** |
| [authentication.md](./authentication.md) | Sign up, sign in, sessions |
| [projects.md](./projects.md) | Create, list, rename, delete projects |
| [backup.md](./backup.md) | The push/pull protocol — the interesting part |
| [deployment.md](./deployment.md) | **Manual setup**: Neon, R2, secrets, domain — what a human has to do |

## What exists

- **Accounts** — email and password. OAuth is not built.
- **Projects** — a named container owned by one user.
- **Backup** — push a project to the cloud, restore it onto another machine,
  roll back to any past version. Only changed content transfers.

## What does not exist yet

- **Cross-machine sync.** Backup is one-way per machine. Two machines pushing
  the same project will not merge; the second push simply records a newer
  version. See `plans/cloud-sync.md`.
- **Bearer token auth.** Sessions are cookie-based only, which matters for the
  desktop client — see [authentication.md](./authentication.md#no-bearer-tokens-yet).
- **OAuth**, email verification, password reset.
- **Billing.** The entitlement gate exists but lets everyone through; there is
  no subscription check yet.

Note that cloud backup **does** require a verified email address — see
[conventions.md](./conventions.md#unverified-accounts).

## Quick start

Against a local server (`npm run dev`):

```bash
# 1. create an account — note the Origin header, it is required
curl -c jar.txt -X POST http://localhost:3000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' \
  -d '{"name":"Me","email":"me@example.com","password":"correct-horse-battery"}'

# 2. create a project
curl -b jar.txt -X POST http://localhost:3000/api/projects \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' \
  -d '{"name":"My site"}'
```

To push and pull a real directory, use the reference client rather than curl:

```bash
export SCAMP_EMAIL=me@example.com SCAMP_PASSWORD=correct-horse-battery

node scripts/fake-client.mjs scan ./my-project
node scripts/fake-client.mjs push ./my-project --project <projectId>
node scripts/fake-client.mjs pull ./restored  --project <projectId>
```

## Reference implementation

**`scripts/fake-client.mjs` is the canonical client.** It implements the full
push and pull protocol — ignore rules, hashing, batched uploads, resumable
downloads, hash verification — and it is what the Electron app should be
modelled on. When this documentation and that file disagree, the file is right.

The checkpoint scripts double as executable examples of every endpoint:

```bash
node scripts/check-projects.mjs    # projects, ownership, isolation
node scripts/check-push.mjs        # push, ignore rules, deduplication
node scripts/check-pull.mjs        # restore, past versions, resumability
```

## Keeping these docs honest

Every response body here was captured from a running server, not written from
memory. `scripts/check-api-docs.mjs` re-verifies the specific claims — status
codes, cookie name, error shapes, URL lifetimes, limits:

```bash
node scripts/check-api-docs.mjs
```

Run it after changing an endpoint. It caught one wrong claim while these docs
were being written.

## Deployment status

The API runs only on a developer machine today. Getting it live is provisioning
work rather than code: a Neon database, an R2 bucket and API token, seven Worker
secrets, and a domain binding.

**[deployment.md](./deployment.md) is the runbook** — every manual step, in
order, plus the two code paths that have never executed and need verifying
specifically after the first deploy.
