// Browser checks for the sign-up form.
//
// The password reveal toggle is interactive, so inspecting the HTML is not
// enough — this drives a real browser. The load-bearing assertion is that the
// toggle does not submit the form: a <button> inside a form defaults to
// type="submit", so getting that wrong would post the form every time someone
// tried to peek at their password.
//
// Requires `npm run dev`. Run: node scripts/check-signup-ui.mjs

import { chromium } from "playwright";
let bad = 0;
const ck = (ok, l, d = "") => { console.log(`  ${ok ? "✓" : "✗"} ${l}${d ? "  " + d : ""}`); if (!ok) bad++; };

const b = await chromium.launch();
const p = await b.newPage();
await p.goto("http://localhost:3000/sign-up", { waitUntil: "networkidle" });

const input = p.locator('input[name="password"]');
const toggle = p.locator('button[aria-label="Show password"], button[aria-label="Hide password"]');

ck(await input.getAttribute("type") === "password", "starts masked");
ck(await toggle.getAttribute("aria-pressed") === "false", "aria-pressed starts false");

await input.fill("correct-horse-battery");
await toggle.click();
ck(await input.getAttribute("type") === "text", "click reveals the password");
ck(await toggle.getAttribute("aria-label") === "Hide password", "accessible name updates");
ck(await toggle.getAttribute("aria-pressed") === "true", "aria-pressed updates");
ck(await input.inputValue() === "correct-horse-battery", "typed value survives the toggle");

await toggle.click();
ck(await input.getAttribute("type") === "password", "click again re-masks");

// The critical one: the toggle must not submit the form.
const urlBefore = p.url();
await toggle.click();
await p.waitForTimeout(600);
ck(p.url() === urlBefore, "toggle does NOT submit the form", `(${p.url().split("/").pop()})`);

// Keyboard reachable.
await input.focus();
await p.keyboard.press("Tab");
const focused = await p.evaluate(() => document.activeElement?.getAttribute("aria-label"));
ck(focused === "Show password" || focused === "Hide password", "reachable by keyboard from the input", `(focus: ${focused})`);
await p.keyboard.press("Enter");
await p.waitForTimeout(300);
ck(p.url() === urlBefore, "Enter on the toggle does not submit either");

await b.close();
console.log(bad === 0 ? "\n  password reveal: PASS" : `\n  ${bad} FAILURE(S)`);
// exitCode, not exit(): process.exit() tears the process down while pg
// sockets are still closing, which surfaces as an uncaught "Connection
// terminated unexpectedly" AFTER every assertion has passed — and it
// discards buffered stdout on the way out, so the results vanish too.
// Setting the code lets Node drain and exit on its own.
process.exitCode = bad === 0 ? 0 : 1;
