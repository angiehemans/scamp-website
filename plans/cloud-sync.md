# Cross-machine sync — plan for review

Follows [cloud-backup.md](./cloud-backup.md), which is built and working. Backup
is one-way: a machine pushes, and can restore. Sync is the other half — two
machines editing the same project without losing each other's work.

**Nothing here is built.** It is also **blocked on one decision**: the
[conflict policy](#3-the-blocking-decision-conflict-policy). Everything else
follows from that answer, so it is worth settling before any code.

---

## 1. Why this was split off

The backup plan treated "cloud backup + sync" as one item, following backend.md.
Splitting them was the first decision made in review, and it held up:

|  | Backup (done) | Sync (this doc) |
|---|---|---|
| Direction | one-way push | bidirectional |
| Conflicts | impossible | the entire problem |
| Delivers | "a dead laptop doesn't cost you work" | "laptop → desktop" |

Backup was roughly a third of the work and delivers the promise most people buy
the tier for. Every hard problem below is easier now that the storage layer
exists and is proven.

---

## 2. What already exists

Sync is an extension, not a rewrite. Everything in this list is built, tested,
and unchanged by anything below:

- **Content-addressed blob storage** in R2, namespaced `blobs/<userId>/<projectId>/<sha256>`
- **Manifests as versions** — every push stores the project's complete state as
  a path→hash map. This turns out to be the single most useful thing for sync,
  for reasons in section 3.
- **Unlimited history**, so any past version is restorable
- **`deviceId` already recorded on every version** — the column exists and the
  client already sends it
- **Push protocol** (`push/prepare` → upload → `push/commit`) and **pull
  protocol** (`manifest` → `pull/urls` → download), both resumable
- **`scripts/fake-client.mjs`**, the reference client, which will need the
  changes below before the Electron app copies them

What sync adds is small in surface area and large in consequence: a precondition
on commit, and a policy for what happens when it fails.

---

## 3. The blocking decision: conflict policy

Push gains a precondition. The client sends the `versionId` it last saw; the
server rejects the commit with `409` if a newer version exists. The client then
has to reconcile. **How it reconciles is the decision.**

backend.md says "last-write-wins with a 'changes from another machine' banner".
That is under-specified in an important way, and the options are not equally
good.

### Option 1 — Project-level last-write-wins

The newer push replaces the older version wholesale.

**This one is actively harmful and I would rule it out.** If the desktop edited
`about.tsx` and the laptop edited `home.tsx`, whichever pushes second silently
discards the other's work on a file it never touched. Nothing warns anyone,
because from the server's point of view a complete manifest arrived. The data is
still in history and recoverable, but the user has no reason to look.

### Option 2 — Per-file last-write-wins

Merge the two manifests path by path; on a path both sides changed, the later
push wins.

Better — untouched files survive. But it can still produce a project state that
never existed on either machine: half of one machine's edits, half of the
other's. For code that compiles, that is how you get a build that fails in a way
neither developer can reproduce.

### Option 3 — Three-way merge on the manifest (recommended)

**This is available essentially for free, and I do not think it was on the table
when backend.md was written.** Because every version stores a *complete*
manifest, the common ancestor is known — it is the version both machines last
shared. That makes a real three-way merge possible on file identity:

| Changed since ancestor | Result |
|---|---|
| only on A | take A's hash |
| only on B | take B's hash |
| on both, to the **same** hash | no conflict — both did the same thing |
| on both, to different hashes | **genuine conflict**, surface it |
| deleted on one, untouched on other | take the deletion |
| deleted on one, edited on other | **genuine conflict** |

Most real cases auto-resolve, and the ones that surface are the ones a human
genuinely has to decide. This is what git does, minus the line-level merging —
we compare whole files, which is right for a design tool where a `.tsx` file is
generated output rather than hand-edited prose.

The cost is that the client needs UI for the residual conflicts. There is no way
around that: a real conflict is a real decision.

### Option 4 — Refuse and make the user choose

Server rejects; client shows "this project changed on another machine" and
offers *keep mine* / *keep theirs*. Simplest server, worst outcome — it forces a
whole-project choice for what is usually a single-file disagreement.

**Recommendation: Option 3**, with the conflict UI kept deliberately small —
list the conflicting paths, offer per-file *keep mine* / *keep theirs*, and
default to keeping both by writing the loser to a sidecar path
(`home.tsx` + `home.conflict-2026-08-12.tsx`) so nothing is ever destroyed.

---

## 4. Other questions, all downstream of that one

1. **Does deletion propagate?** If the laptop deletes `old-page.tsx`, should
   pulling on the desktop delete the local file? Manifests make it detectable,
   but deleting a user's local file is the most dangerous thing this feature
   could do. Options: propagate, never propagate (deleted files simply reappear),
   or propagate with a confirmation.
2. **What triggers a sync?** backend.md says debounced file writes. That covers
   push. Pull needs a trigger too — on app focus, on a timer, or pushed from the
   server. Polling is simplest and probably fine at this scale; the alternative
   is a websocket, and Pusher is already in backend.md for comments.
3. **How is `deviceId` generated and persisted?** The column exists and is
   populated, but nothing defines it yet. It needs to be stable across restarts
   and distinct per machine.
4. **What happens to an open canvas when a sync lands?** If the user is looking
   at `home.tsx` and a pull rewrites it, the app has to reconcile that with the
   editor state. This is Electron-side, but it is the part most likely to feel
   broken.
5. **Concurrent edits within one machine.** Scamp already has bidirectional sync
   between canvas and disk. A cloud pull writing files while the local watcher
   is running could ping-pong. Needs a suppression window.

---

## 5. Proposed phases

**Phase 1 — Precondition.** `push/commit` accepts `baseVersionId` and returns
`409` with the current head when it is stale. Client sends it. No merging yet:
a stale push simply fails and the client tells the user to pull. Small, and it
makes the failure visible instead of silent.

**Phase 2 — Three-way merge.** Server (or client — see below) computes the
merge against the common ancestor and returns either a merged manifest or a
conflict list.

**Phase 3 — Conflict resolution UI.** Electron-side, plus the sidecar-file
convention.

**Phase 4 — Pull triggers.** Whatever answers question 2.

**Open: where does the merge run?** Client-side keeps the server dumb and means
the merge can use local file state, which it needs anyway to write the result.
Server-side means one implementation rather than one per client. Leaning
client-side, since the client must touch the filesystem regardless.

---

## 6. Scope boundary

Same as backup: this repo is the API. Manifest diffing, conflict UI, file
watching, and the deviceId are Electron-side. The reference client
(`scripts/fake-client.mjs`) should implement the merge first so the Electron work
has something to copy — that is how push and pull were built.

---

## 7. Before starting

Answer [section 3](#3-the-blocking-decision-conflict-policy), and ideally
questions 1 and 2 in section 4. The rest can be settled as the work proceeds.
