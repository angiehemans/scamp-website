// Verifies that api-docs/ still describes reality.
//
// Every check here corresponds to a specific claim in the documentation —
// status codes, cookie names, error shapes, limits. Docs drift silently, so
// this makes drift fail loudly instead.
//
// Requires `npm run dev`. Run: node scripts/check-api-docs.mjs

import { markVerified } from "./test-helpers.mjs";

const BASE="http://localhost:3000", ORIGIN=BASE, stamp=Date.now();
let bad=0; const ck=(ok,l,d="")=>{console.log(`  ${ok?"✓":"✗"} ${l}${d?"  "+d:""}`); if(!ok)bad++;};
const su=await fetch(`${BASE}/api/auth/sign-up/email`,{method:"POST",headers:{"Content-Type":"application/json",origin:ORIGIN},body:JSON.stringify({name:"V",email:`v-${stamp}@example.com`,password:"correct-horse-battery"})});
// Cloud backup requires a verified address; stand in for the emailed link.
await markVerified(`v-${stamp}@example.com`);
const cookie=(su.headers.getSetCookie?.()??[]).map(c=>c.split(";")[0]).join("; ");
const call=(p,i={})=>fetch(`${BASE}${p}`,{...i,headers:{"Content-Type":"application/json",origin:ORIGIN,cookie,...(i.headers??{})}});

// doc claim: cookie name
ck(cookie.startsWith("better-auth.session_token"), "cookie is better-auth.session_token");

// doc claim: get-session returns 200 + null when signed out (not 401)
const anon=await fetch(`${BASE}/api/auth/get-session`,{headers:{origin:ORIGIN}});
const anonBody=await anon.text();
ck(anon.status===200 && (anonBody==="null"||anonBody===""), "get-session signed out is 200 + null, not 401", `(${anon.status} body=${JSON.stringify(anonBody.slice(0,12))})`);

// doc claim: sign-out endpoint exists
const so=await call("/api/auth/sign-out",{method:"POST",body:"{}"});
ck(so.status===200, "POST /api/auth/sign-out works", `(${so.status})`);

// re-auth for the rest
const si=await fetch(`${BASE}/api/auth/sign-in/email`,{method:"POST",headers:{"Content-Type":"application/json",origin:ORIGIN},body:JSON.stringify({email:`v-${stamp}@example.com`,password:"correct-horse-battery"})});
ck(si.status===200,"POST /api/auth/sign-in/email works",`(${si.status})`);
const cookie2=(si.headers.getSetCookie?.()??[]).map(c=>c.split(";")[0]).join("; ");
const call2=(p,i={})=>fetch(`${BASE}${p}`,{...i,headers:{"Content-Type":"application/json",origin:ORIGIN,cookie:cookie2,...(i.headers??{})}});

// doc claim: password min length 8
const shortPw=await fetch(`${BASE}/api/auth/sign-up/email`,{method:"POST",headers:{"Content-Type":"application/json",origin:ORIGIN},body:JSON.stringify({name:"S",email:`s-${stamp}@example.com`,password:"short"})});
ck(shortPw.status>=400, "password shorter than 8 rejected", `(${shortPw.status})`);

const {project}=await (await call2("/api/projects",{method:"POST",body:JSON.stringify({name:"verify"})})).json();

// doc claim: names are NOT unique
const dup=await call2("/api/projects",{method:"POST",body:JSON.stringify({name:"verify"})});
ck(dup.status===201, "duplicate project names allowed", `(${dup.status})`);
const dupId=(await dup.json()).project.id;

// doc claim: versions limit max 100
const vs=await call2(`/api/projects/${project.id}/versions?limit=500`);
ck(vs.status===200, "versions accepts limit param", `(${vs.status})`);

// doc claim: manifest 404 for unknown version
const badVer=await call2(`/api/projects/${project.id}/manifest?version=nope`);
ck(badVer.status===404, "unknown version id returns 404", `(${badVer.status})`);

// doc claim: manifest 404 when project has no versions yet
const noVer=await call2(`/api/projects/${project.id}/manifest`);
ck(noVer.status===404, "manifest 404 when no versions exist", `(${noVer.status})`);

// doc claim: bad JSON body
const badJson=await call2("/api/projects",{method:"POST",body:"{not json"});
const bj=await badJson.json();
ck(badJson.status===400 && bj.error==="Body must be JSON", "malformed JSON -> 400 'Body must be JSON'", `(${badJson.status} ${bj.error})`);

// doc claim: no Authorization bearer support
const bearer=await fetch(`${BASE}/api/projects`,{headers:{origin:ORIGIN,authorization:"Bearer sometoken"}});
ck(bearer.status===401, "bearer token is NOT accepted", `(${bearer.status})`);

// doc claim: blob url expiry is 900s
const {createHash}=await import("node:crypto");
const c="x\n"; const h=createHash("sha256").update(c).digest("hex");
const prep=await call2(`/api/projects/${project.id}/push/prepare`,{method:"POST",body:JSON.stringify({manifest:{"x.txt":h}})});
const pj=await prep.json();
const u=new URL(pj.uploads[h]);
const ttl=Number(u.searchParams.get("expires"))-Math.floor(Date.now()/1000);
ck(ttl>880&&ttl<=900, "blob URL TTL is ~900s (15 min)", `(${ttl}s)`);
ck(pj.direct===false, "direct=false locally (no R2 creds)", `(direct=${pj.direct})`);

// doc claim: reusing a URL for another hash fails
const other=createHash("sha256").update("different").digest("hex");
const swapped=new URL(pj.uploads[h]); swapped.searchParams.set("key", swapped.searchParams.get("key").replace(h, other));
const sw=await fetch(swapped,{method:"PUT",body:"different"});
ck(sw.status===403, "upload URL cannot be reused for another hash", `(${sw.status})`);

await call2(`/api/projects/${project.id}`,{method:"DELETE"});
await call2(`/api/projects/${dupId}`,{method:"DELETE"});
console.log(bad===0?"\nAll documented behaviours verified":`\n${bad} DOC CLAIM(S) WRONG`);
process.exit(bad===0?0:1);
