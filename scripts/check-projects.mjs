// Phase 2 checkpoint for plans/cloud-backup.md.
//
// The point of this phase is isolation, so most of this file is attempts to
// reach another user's project. Two real accounts are created and A tries every
// verb against B's project. Every one must fail, and fail as 404 rather than
// 403 — a 403 would confirm the id exists.
//
// Requires `npm run dev`. Run: node scripts/check-projects.mjs

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

// Better Auth rejects requests whose Origin is present-but-null with
// MISSING_OR_NULL_ORIGIN — Node's fetch sends exactly that. A browser or the
// Electron client sends a real Origin, so mirror it here. Worth knowing for
// whoever builds the client: the API requires a matching Origin header.
const ORIGIN = BASE;

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
};

/** A user with its own cookie jar, so the two sessions cannot bleed together. */
async function signUp(email) {
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: ORIGIN },
    body: JSON.stringify({ name: email, email, password: "correct-horse-battery" }),
  });
  if (!res.ok) throw new Error(`sign-up failed for ${email}: ${res.status}`);
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  return {
    email,
    fetch: (path, init = {}) =>
      fetch(`${BASE}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", origin: ORIGIN, cookie, ...(init.headers ?? {}) },
      }),
  };
}

const stamp = Date.now();
const alice = await signUp(`alice-${stamp}@example.com`);
const bob = await signUp(`bob-${stamp}@example.com`);

console.log("\n  ownership:");

const created = await alice.fetch("/api/projects", {
  method: "POST",
  body: JSON.stringify({ name: "Alice's site" }),
});
check(created.status === 201, "alice creates a project", `(${created.status})`);
const { project } = await created.json();

const bobCreated = await bob.fetch("/api/projects", {
  method: "POST",
  body: JSON.stringify({ name: "Bob's site" }),
});
const bobProject = (await bobCreated.json()).project;

const aliceList = await (await alice.fetch("/api/projects")).json();
check(
  aliceList.projects.length === 1 && aliceList.projects[0].id === project.id,
  "alice's list contains only her project",
  `(${aliceList.projects.length} project(s))`,
);

const bobList = await (await bob.fetch("/api/projects")).json();
check(
  bobList.projects.length === 1 && bobList.projects[0].id === bobProject.id,
  "bob's list contains only his project",
  `(${bobList.projects.length} project(s))`,
);

console.log("\n  cross-user access — every one must be 404:");

const read = await bob.fetch(`/api/projects/${project.id}`);
check(read.status === 404, "bob cannot read alice's project", `(${read.status})`);

const rename = await bob.fetch(`/api/projects/${project.id}`, {
  method: "PATCH",
  body: JSON.stringify({ name: "pwned" }),
});
check(rename.status === 404, "bob cannot rename alice's project", `(${rename.status})`);

const del = await bob.fetch(`/api/projects/${project.id}`, { method: "DELETE" });
check(del.status === 404, "bob cannot delete alice's project", `(${del.status})`);

const stillThere = await alice.fetch(`/api/projects/${project.id}`);
check(stillThere.status === 200, "alice's project survived all of that", `(${stillThere.status})`);

console.log("\n  unauthenticated:");
for (const [label, init] of [
  ["list", {}],
  ["create", { method: "POST", body: JSON.stringify({ name: "x" }) }],
]) {
  const res = await fetch(`${BASE}/api/projects`, {
    ...init,
    headers: { "Content-Type": "application/json", origin: ORIGIN },
  });
  check(res.status === 401, `anonymous ${label} rejected`, `(${res.status})`);
}
const anonRead = await fetch(`${BASE}/api/projects/${project.id}`);
check(anonRead.status === 401, "anonymous read rejected", `(${anonRead.status})`);

console.log("\n  validation:");
const noName = await alice.fetch("/api/projects", { method: "POST", body: JSON.stringify({}) });
check(noName.status === 400, "missing name rejected", `(${noName.status})`);
const blankName = await alice.fetch("/api/projects", { method: "POST", body: JSON.stringify({ name: "   " }) });
check(blankName.status === 400, "blank name rejected", `(${blankName.status})`);
const longName = await alice.fetch("/api/projects", { method: "POST", body: JSON.stringify({ name: "x".repeat(201) }) });
check(longName.status === 400, "over-long name rejected", `(${longName.status})`);

console.log("\n  own project lifecycle:");
const renamed = await alice.fetch(`/api/projects/${project.id}`, {
  method: "PATCH",
  body: JSON.stringify({ name: "Renamed" }),
});
check(
  renamed.status === 200 && (await renamed.json()).project.name === "Renamed",
  "alice can rename her own project",
);

const deleted = await alice.fetch(`/api/projects/${project.id}`, { method: "DELETE" });
check(deleted.status === 200, "alice can delete her own project", `(${deleted.status})`);

const gone = await alice.fetch(`/api/projects/${project.id}`);
check(gone.status === 404, "deleted project is gone", `(${gone.status})`);

// Cleanup so repeated runs stay clean.
await bob.fetch(`/api/projects/${bobProject.id}`, { method: "DELETE" });

console.log(failures === 0 ? "\nPhase 2 checkpoint: PASS" : `\nPhase 2 checkpoint: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
