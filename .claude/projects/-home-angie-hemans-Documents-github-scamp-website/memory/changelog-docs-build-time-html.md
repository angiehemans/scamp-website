---
name: changelog-docs-build-time-html
description: Why docs/changelog markdown is rendered to HTML at build time, not at request
metadata:
  type: project
---

The site deploys to Cloudflare Workers via `@opennextjs/cloudflare`. Rendering
markdown with `react-markdown` inside the page components ran at *request* time
on the worker and tripped the Cloudflare "Worker exceeded CPU time limit" error
on `/changelog` (and would on `/docs`), because the worker effectively
re-renders the RSC tree per request (no incremental cache configured — R2 is
commented out in `open-next.config.ts`).

Fix: markdown is now compiled to an HTML string at build time by
`scripts/build-changelog.mjs` and `scripts/build-docs.mjs` (shared pipeline in
`scripts/markdown.mjs`, using unified + remark-parse + remark-gfm +
remark-rehype + rehype-stringify). The generated JSON carries an `html` field
(not `content`), and the pages inject it with `dangerouslySetInnerHTML` into the
`.prose` (docs) / `.entryBody` (changelog) wrappers.

**Why / How to apply:** Do NOT reintroduce `react-markdown` or any per-request
markdown parsing in these pages — it must stay build-time only. Custom rendering
(changelog status badges, doc `.md`→`/docs/<slug>` link rewriting) lives as
small rehype plugins in `scripts/markdown.mjs`. Changelog badge styling is keyed
off global classes `.badge` / `.badge-shipped|to-do|upcoming` via `:global()` in
`changelog.module.css`. The markdown deps are devDependencies (build-only).
